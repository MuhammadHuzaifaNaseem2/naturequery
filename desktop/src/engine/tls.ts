import tls from 'node:tls'
import type { ConnectionConfig, ConnectionSecrets, TlsMode } from '@shared/types'

export interface NodeTlsOptions {
  rejectUnauthorized: boolean
  ca?: string[]
  servername?: string
  checkServerIdentity?: (host: string, cert: tls.PeerCertificate) => Error | undefined
}

export interface ResolvedTls {
  mode: TlsMode
  /** Undefined when the connection should not use TLS at all. */
  options?: NodeTlsOptions
}

let trustedRoots: string[] | null = null

/**
 * Root certificates for verification: Node's bundled list plus the operating
 * system store, so certificates issued by a company's internal certificate
 * authority (installed on the PC by IT) verify without extra setup.
 */
export function trustedCertificates(): string[] {
  if (!trustedRoots) {
    const roots = new Set<string>(tls.getCACertificates('default'))
    try {
      for (const certificate of tls.getCACertificates('system')) roots.add(certificate)
    } catch {
      // Some Linux systems have no readable system store; bundled roots remain.
    }
    trustedRoots = [...roots]
  }
  return trustedRoots
}

export function defaultTlsMode(config: ConnectionConfig): TlsMode {
  return config.tls?.mode ?? 'prefer'
}

/**
 * Translates the connection's security setting into Node TLS options.
 * `servername` is the real host name, needed when connecting through an SSH
 * tunnel to 127.0.0.1 so certificate host checks still use the right name.
 */
export function resolveTls(
  config: ConnectionConfig,
  secrets: ConnectionSecrets,
  servername?: string
): ResolvedTls {
  const mode = defaultTlsMode(config)
  if (mode === 'disable') return { mode }
  const sni = servername && !/^[\d.:[\]]+$/.test(servername) ? servername : undefined
  if (mode === 'prefer' || mode === 'require') {
    return { mode, options: { rejectUnauthorized: false, servername: sni } }
  }
  const ca = secrets.caCertificate
    ? [...trustedCertificates(), secrets.caCertificate]
    : trustedCertificates()
  return {
    mode,
    options: {
      rejectUnauthorized: true,
      ca,
      servername: sni,
      // verify-ca checks the certificate chain but not the host name. verify-full
      // leaves the key out: Node refuses a checkServerIdentity that is undefined.
      ...(mode === 'verify-ca' ? { checkServerIdentity: () => undefined } : {}),
    },
  }
}

/** Errors meaning the server cannot do TLS, so "prefer" should retry without it. */
export function isTlsUnsupportedError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  // mysql2 spells this "secure connnection", so allow any number of n's.
  return /does not support SSL|does(?:n't| not) support secure conn+ection|server does not support (ssl|tls)|SSL is not enabled|not configured for SSL/i.test(
    text
  )
}
