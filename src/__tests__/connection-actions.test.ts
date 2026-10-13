// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth', () => ({
  auth: async () => (session.userId ? { user: { id: session.userId, role: 'USER' } } : null),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitAsync: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

import { fetchSchema, testConnection } from '@/actions/db'

const credentials = {
  host: '127.0.0.1',
  port: 5432,
  database: 'app',
  user: 'u',
  password: 'p',
  dbType: 'postgresql' as const,
}

afterEach(() => {
  session.userId = ''
  vi.unstubAllEnvs()
})

describe('connection form actions', () => {
  it('need a signed-in user', async () => {
    const signIn = { success: false, error: 'Please sign in to connect a database.' }
    await expect(testConnection(credentials)).resolves.toEqual(signIn)
    await expect(fetchSchema(credentials)).resolves.toEqual(signIn)
  })

  it('refuse private addresses on the hosted site', async () => {
    session.userId = 'user-a'
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_PRIVATE_DB_HOSTS', '')
    const result = await testConnection(credentials)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/private or local network address/)
  })
})
