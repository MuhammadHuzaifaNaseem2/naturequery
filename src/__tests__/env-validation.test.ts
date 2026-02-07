import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Environment Validation', () => {
  beforeEach(() => {
    vi.resetModules()
    // Set valid defaults
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test')
    vi.stubEnv('NEXTAUTH_SECRET', 'real-secret-value')
    vi.stubEnv('ENCRYPTION_KEY', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')
    vi.stubEnv('GROQ_API_KEY', 'gsk_test')
    vi.stubEnv('NODE_ENV', 'development')
  })

  it('returns no warnings when all env vars are properly set', async () => {
    const { validateEnv } = await import('@/lib/env')
    const warnings = validateEnv()
    expect(warnings).toHaveLength(0)
  })

  it('warns when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const { validateEnv } = await import('@/lib/env')
    const warnings = validateEnv()
    expect(warnings.some((w) => w.includes('DATABASE_URL'))).toBe(true)
  })

  it('warns when NEXTAUTH_SECRET uses placeholder in development', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'development-only-secret-do-not-use-in-production')
    const { validateEnv } = await import('@/lib/env')
    const warnings = validateEnv()
    expect(warnings.some((w) => w.includes('NEXTAUTH_SECRET'))).toBe(true)
  })

  it('throws when NEXTAUTH_SECRET uses placeholder in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', 'development-only-secret-do-not-use-in-production')
    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).toThrow('CRITICAL')
  })

  it('warns when ENCRYPTION_KEY uses placeholder in development', async () => {
    vi.stubEnv('ENCRYPTION_KEY', '0000000000000000000000000000000000000000000000000000000000000000')
    const { validateEnv } = await import('@/lib/env')
    const warnings = validateEnv()
    expect(warnings.some((w) => w.includes('ENCRYPTION_KEY'))).toBe(true)
  })

  it('throws when ENCRYPTION_KEY uses placeholder in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ENCRYPTION_KEY', '0000000000000000000000000000000000000000000000000000000000000000')
    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).toThrow('CRITICAL')
  })

  it('warns when GROQ_API_KEY is missing (mock mode)', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    const { validateEnv } = await import('@/lib/env')
    const warnings = validateEnv()
    expect(warnings.some((w) => w.includes('mock mode'))).toBe(true)
  })
})
