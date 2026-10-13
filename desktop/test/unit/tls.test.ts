import { connect } from 'node:tls'
import { describe, expect, it } from 'vitest'
import { resolveTls } from '../../src/engine/tls'
import type { ConnectionConfig } from '../../src/shared/types'

const config = (host: string, mode: 'verify-ca' | 'verify-full'): ConnectionConfig =>
  ({
    id: 'c1',
    name: 'Test',
    type: 'postgresql',
    host,
    port: 5432,
    tls: { mode },
  }) as ConnectionConfig

describe('certificate checks', () => {
  it('give Node options it accepts in every verifying mode', async () => {
    for (const mode of ['verify-ca', 'verify-full'] as const) {
      const host = 'db.example.com'
      const { options } = resolveTls(config(host, mode), {}, host)
      // Node throws at once on checkServerIdentity: undefined, before connecting.
      if (mode === 'verify-full') expect(options && 'checkServerIdentity' in options).toBe(false)
      const socket = connect({ ...options, host: '127.0.0.1', port: 9 })
      await new Promise((resolve) => socket.once('error', resolve).once('secureConnect', resolve))
      socket.destroy()
    }
  })
})
