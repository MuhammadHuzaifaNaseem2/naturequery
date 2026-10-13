// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * NatureQuery reaches ClickHouse over HTTPS. A stand-in ClickHouse server with a
 * self-signed certificate runs on this machine: checking the certificate must
 * refuse it, and trusting the certificate must connect. Runs with NQ_WEB_IT=1 when
 * openssl is available to make the throwaway certificate.
 */
function hasOpenssl() {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
const enabled = process.env.NQ_WEB_IT === '1' && hasOpenssl()

describe.skipIf(!enabled)('ClickHouse over HTTPS', () => {
  let dir = ''
  let server: Server | undefined
  let port = 0

  beforeAll(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'nq-clickhouse-tls-'))
    const key = path.join(dir, 'key.pem')
    const cert = path.join(dir, 'cert.pem')
    const args = ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1']
    args.push('-subj', '/CN=localhost', '-keyout', key, '-out', cert)
    execFileSync('openssl', args, { stdio: 'ignore' })
    server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ meta: [{ name: '1', type: 'UInt8' }], data: [{ 1: 1 }], rows: 1 }))
      })
    })
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    server?.closeAllConnections()
    await new Promise((resolve) => server?.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })

  const credentials = (verifyCertificate: boolean) => ({
    host: 'localhost',
    port,
    database: 'default',
    user: 'default',
    password: '',
    verifyCertificate,
  })

  it('refuses a certificate it cannot check, with a plain explanation', async () => {
    const { createDriver } = await import('@/lib/db-drivers')
    const { certificateProblem } = await import('@/lib/driver-tls')
    const driver = createDriver(credentials(true), 'clickhouse')
    const error = await driver.testConnection().then(
      () => null,
      (e: unknown) => e
    )
    await driver.close()
    expect(certificateProblem(error)).toMatch(/Trust this server's certificate/)
  })

  it("connects when the user trusts the server's certificate", async () => {
    const { createDriver } = await import('@/lib/db-drivers')
    const driver = createDriver(credentials(false), 'clickhouse')
    await expect(driver.testConnection()).resolves.toBeUndefined()
    await driver.close()
  })
})
