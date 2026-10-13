import { describe, expect, it } from 'vitest'
import { createPostgresDriver } from '../../src/engine/drivers/postgres'
import type { ConnectionConfig } from '../../src/shared/types'

/**
 * Checks the bundled Supabase certificate against Supabase's real pooler with the
 * desktop's own PostgreSQL driver. The account does not exist, so a good check
 * ends at the sign-in step instead of a certificate error. Needs the internet,
 * so it runs only with NQ_NET_IT=1.
 */
const HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'

describe.skipIf(process.env.NQ_NET_IT !== '1')("Supabase's certificate (desktop)", () => {
  it('passes "Verify certificate and host name" and reaches the sign-in step', async () => {
    const config = {
      id: 'live-check',
      name: 'Supabase check',
      type: 'supabase',
      host: HOST,
      port: 5432,
      database: 'postgres',
      user: 'postgres.nqtlscheck0000000000',
      tls: { mode: 'verify-full' },
    } as ConnectionConfig
    const driver = createPostgresDriver(
      config,
      { password: 'not-a-real-password' },
      { connectTimeoutMs: 15_000 }
    )
    try {
      const error = await driver.test().then(
        () => new Error('connected, which a made-up account should never do'),
        (reason: unknown) => reason
      )
      const text = String((error as Error)?.message ?? error)
      expect(text).not.toMatch(/certificate|self[- ]signed/i)
      expect(text).toMatch(/tenant|not found|password authentication/i)
    } finally {
      await driver.close()
    }
  }, 30_000)
})
