import net from 'node:net'
import crypto from 'node:crypto'
import { Client } from 'ssh2'
import { NqError } from '@shared/errors'
import { DB_TYPE_INFO } from '@shared/db-types'
import type { ConnectionConfig, ConnectionSecrets } from '@shared/types'

export interface Tunnel {
  localPort: number
  /** SHA-256 fingerprint of the server's host key, e.g. "SHA256:abc...". */
  hostKey: string
  close(): Promise<void>
}

export function fingerprintHostKey(key: Buffer): string {
  return `SHA256:${crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`
}

/**
 * Opens an SSH connection and forwards a local port on 127.0.0.1 to the
 * database host as seen from the SSH server.
 */
export async function openTunnel(
  config: ConnectionConfig,
  secrets: ConnectionSecrets,
  timeoutMs: number
): Promise<Tunnel> {
  const ssh = config.ssh
  if (!ssh?.enabled) throw new NqError('VALIDATION', 'SSH is not enabled for this connection.')
  const target = {
    host: config.host || '127.0.0.1',
    port: config.port ?? DB_TYPE_INFO[config.type].defaultPort ?? 0,
  }
  const client = new Client()
  let seenHostKey = ''
  let hostKeyMismatch = false

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error & { level?: string }) => {
      client.removeListener('ready', onReady)
      reject(sshError(error, hostKeyMismatch, ssh.host))
    }
    const onReady = () => {
      client.removeListener('error', onError)
      resolve()
    }
    client.once('ready', onReady)
    client.once('error', onError)
    client.connect({
      host: ssh.host,
      port: ssh.port || 22,
      username: ssh.user,
      password: ssh.auth === 'password' ? secrets.sshPassword : undefined,
      privateKey: ssh.auth === 'key' ? secrets.sshPrivateKey : undefined,
      passphrase: ssh.auth === 'key' ? secrets.sshPassphrase : undefined,
      readyTimeout: timeoutMs,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 4,
      hostVerifier: (key: Buffer) => {
        seenHostKey = fingerprintHostKey(key)
        if (ssh.hostKeyFingerprint && ssh.hostKeyFingerprint !== seenHostKey) {
          hostKeyMismatch = true
          return false
        }
        return true
      },
    })
  })

  const sockets = new Set<net.Socket>()
  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    client.forwardOut(
      '127.0.0.1',
      socket.localPort ?? 0,
      target.host,
      target.port,
      (error, stream) => {
        if (error) {
          socket.destroy()
          return
        }
        socket.pipe(stream).pipe(socket)
        stream.on('close', () => socket.destroy())
        socket.on('close', () => stream.end())
        socket.on('error', () => stream.end())
        stream.on('error', () => socket.destroy())
      }
    )
  })
  server.on('error', () => {})

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  client.on('close', () => server.close())
  client.on('error', () => server.close())

  return {
    localPort: (server.address() as net.AddressInfo).port,
    hostKey: seenHostKey,
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      client.end()
    },
  }
}

function sshError(
  error: Error & { level?: string; code?: string },
  mismatch: boolean,
  host: string
): NqError {
  if (mismatch) {
    return new NqError('SSH', `The identity of the SSH server ${host} has changed.`, {
      hint: 'This can mean the server was reinstalled, or that someone is intercepting the connection. Check with your administrator, then remove and re-add the SSH settings to trust the new key.',
      detail: error.message,
    })
  }
  if (error.level === 'client-authentication') {
    return new NqError('SSH', 'The SSH server rejected the user name, password or key.', {
      hint: 'Check the SSH user and credentials. Key files must be in OpenSSH or PEM format.',
      detail: error.message,
    })
  }
  if (
    /Cannot parse privateKey|Encrypted private (OpenSSH )?key detected|bad passphrase/i.test(
      error.message
    )
  ) {
    return new NqError('SSH', 'The SSH private key could not be read.', {
      hint: 'If the key is protected, enter its passphrase. PuTTY .ppk keys must be converted to OpenSSH format with PuTTYgen.',
      detail: error.message,
    })
  }
  if (
    error.level === 'client-timeout' ||
    /Timed out while waiting for handshake/i.test(error.message)
  ) {
    return new NqError('SSH', `The SSH server ${host} did not respond in time.`, {
      hint: 'Check the SSH host and port, your network or VPN, and that the server allows SSH from this computer.',
      detail: error.message,
    })
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new NqError('SSH', `Could not reach the SSH server ${host}.`, {
      hint: 'Check the SSH host name and port (usually 22).',
      detail: error.message,
    })
  }
  return new NqError('SSH', 'The SSH tunnel could not be opened.', { detail: error.message })
}
