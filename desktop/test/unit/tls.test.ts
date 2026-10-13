import { X509Certificate } from 'node:crypto'
import { connect } from 'node:tls'
import { describe, expect, it } from 'vitest'
import { isSupabaseHost, resolveTls, trustedCertificates } from '../../src/engine/tls'
import { SUPABASE_ROOT_CA } from '../../src/engine/supabase-certificate'
import type { ConnectionConfig } from '../../src/shared/types'

const config = (host: string, mode: 'require' | 'verify-full'): ConnectionConfig =>
  ({
    id: 'c1',
    name: 'Test',
    type: 'supabase',
    host,
    port: 5432,
    tls: { mode },
  }) as ConnectionConfig

describe('certificate checks', () => {
  it('give Node options it accepts in every verifying mode', async () => {
    for (const mode of ['verify-ca', 'verify-full'] as const) {
      const host = 'db.example.com'
      const { options } = resolveTls({ ...config(host, 'verify-full'), tls: { mode } }, {}, host)
      // Node throws at once on checkServerIdentity: undefined, before connecting.
      if (mode === 'verify-full') expect(options && 'checkServerIdentity' in options).toBe(false)
      const socket = connect({ ...options, host: '127.0.0.1', port: 9 })
      await new Promise((resolve) => socket.once('error', resolve).once('secureConnect', resolve))
      socket.destroy()
    }
  })
})

describe('Supabase certificates', () => {
  it("trust Supabase's own authority for Supabase hosts", () => {
    for (const host of [
      'aws-0-ap-southeast-1.pooler.supabase.com',
      'db.abcdefghijkl.supabase.co',
    ]) {
      const { options } = resolveTls(config(host, 'verify-full'), {}, host)
      expect(options?.rejectUnauthorized).toBe(true)
      expect(options?.ca).toContain(SUPABASE_ROOT_CA)
      expect(options?.ca?.length).toBe(trustedCertificates().length + 1)
    }
  })

  it('never trust it for other servers', () => {
    for (const host of ['db.example.com', 'supabase.com.example.net', 'notsupabase.co']) {
      expect(isSupabaseHost(host), host).toBe(false)
      const { options } = resolveTls(config(host, 'verify-full'), {}, host)
      expect(options?.ca).not.toContain(SUPABASE_ROOT_CA)
    }
  })

  it('leave "require" as it was: encrypted, certificate accepted as it is', () => {
    const host = 'aws-0-us-east-1.pooler.supabase.com'
    expect(resolveTls(config(host, 'require'), {}, host).options).toEqual({
      rejectUnauthorized: false,
      servername: host,
    })
  })

  it('bundle the root Supabase publishes', () => {
    expect(new X509Certificate(SUPABASE_ROOT_CA).fingerprint256).toBe(
      '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA'
    )
  })
})
