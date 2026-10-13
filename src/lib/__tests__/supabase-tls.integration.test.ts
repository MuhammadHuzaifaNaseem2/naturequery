// @vitest-environment node
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { createPostgresDriver } from '../db-drivers'
import { certificateProblem } from '../driver-tls'

/**
 * Checks the bundled Supabase certificate against Supabase's real pooler. The
 * account does not exist, so a good certificate check ends at the sign-in step
 * ("tenant/user ... not found") instead of a certificate error. Needs the
 * internet, so it runs only with NQ_NET_IT=1.
 */
const HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'
const NO_SUCH_USER = {
  host: HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres.nqtlscheck0000000000',
  password: 'not-a-real-password',
}

async function connectionError(connect: () => Promise<unknown>): Promise<unknown> {
  try {
    await connect()
  } catch (error) {
    return error
  }
  throw new Error('connected, which a made-up account should never do')
}

describe.skipIf(process.env.NQ_NET_IT !== '1')("Supabase's certificate", () => {
  it('passes the full check and reaches the sign-in step', async () => {
    const driver = createPostgresDriver({ ...NO_SUCH_USER, verifyCertificate: true })
    try {
      const error = await connectionError(() => driver.testConnection())
      expect(certificateProblem(error)).toBeNull()
      expect(String(error)).toMatch(/tenant|not found|password authentication/i)
    } finally {
      await driver.close()
    }
  }, 30_000)

  it('fails the check without the bundled authority', async () => {
    const client = new Client({ ...NO_SUCH_USER, ssl: { rejectUnauthorized: true } })
    const error = await connectionError(() => client.connect())
    await client.end().catch(() => {})
    expect(certificateProblem(error)).not.toBeNull()
  }, 30_000)
})
