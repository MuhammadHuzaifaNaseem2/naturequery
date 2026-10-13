/**
 * Encryption settings for database drivers.
 *
 * Connections are encrypted. New connections also check the server's certificate
 * against the public certificate authorities. A connection saved with "Trust this
 * server's certificate" (and every connection saved before that setting existed)
 * stays encrypted but accepts the server's certificate as it is, which some
 * providers need because they sign certificates themselves (Amazon RDS, Heroku,
 * Aiven, Supabase's direct connection).
 */
import { isIP } from 'node:net'
import type { DBCredentials } from '@/actions/db'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Databases on this machine (development) usually have no encryption set up. */
export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host)
}

export function checksCertificate(credentials: DBCredentials): boolean {
  return credentials.verifyCertificate === true
}

/** node-postgres `ssl` option. It sends the host name for the certificate check. */
export function postgresTls(credentials: DBCredentials): false | { rejectUnauthorized: boolean } {
  if (isLocalHost(credentials.host)) return false
  return { rejectUnauthorized: checksCertificate(credentials) }
}

/** mysql2 `ssl` option. mysql2 checks the host name only with verifyIdentity. */
export function mysqlTls(
  credentials: DBCredentials
): undefined | { rejectUnauthorized: boolean; verifyIdentity?: boolean } {
  if (isLocalHost(credentials.host)) return undefined
  return checksCertificate(credentials)
    ? { rejectUnauthorized: true, verifyIdentity: true }
    : { rejectUnauthorized: false }
}

/** ClickHouse's plain HTTP ports. connection-target.ts refuses them on the hosted site. */
export const CLICKHOUSE_HTTP_PORTS = [8123, 80]

/** ClickHouse is reached over HTTPS (port 8443 unless another is given). */
export function clickHouseUrl(credentials: DBCredentials): string {
  const port = credentials.port || 8443
  const scheme = CLICKHOUSE_HTTP_PORTS.includes(port) ? 'http' : 'https'
  const host = isIP(credentials.host) === 6 ? `[${credentials.host}]` : credentials.host
  return `${scheme}://${host}:${port}`
}

const CERTIFICATE_ERROR =
  /self[- _]signed|unable to verify the first certificate|unable to get local issuer certificate|certificate has expired|does not match certificate|altnames|CERT_|_CERT\b|LEAF_SIGNATURE|certificate verify failed/i

/** A plain explanation when the server's certificate could not be checked. */
export function certificateProblem(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: unknown } | null)?.code
  if (!CERTIFICATE_ERROR.test(`${message} ${typeof code === 'string' ? code : ''}`)) return null
  return (
    "This database's certificate couldn't be checked. If you trust this server (for example Amazon RDS, " +
    'Heroku, Aiven or Supabase\'s direct connection), turn on "Trust this server\'s certificate". ' +
    'The connection stays encrypted.'
  )
}
