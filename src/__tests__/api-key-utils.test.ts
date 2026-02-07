import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the utility functions from encryption.ts that back the API key feature
// (generateApiKey, hashApiKey) — the server actions themselves require DB access.

describe('API Key Utilities', () => {
  const TEST_KEY = 'a'.repeat(64) // 32 bytes in hex

  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
  })

  it('generates API key with correct prefix', async () => {
    const { generateApiKey } = await import('@/lib/encryption')
    const result = generateApiKey('rp_')
    expect(result.key).toMatch(/^rp_[a-f0-9]{64}$/)
    expect(result.prefix).toMatch(/^rp_[a-f0-9]{8}$/)
    expect(result.hash).toHaveLength(64) // SHA-256 hex
  })

  it('generates unique keys each call', async () => {
    const { generateApiKey } = await import('@/lib/encryption')
    const key1 = generateApiKey('rp_')
    const key2 = generateApiKey('rp_')
    expect(key1.key).not.toBe(key2.key)
    expect(key1.hash).not.toBe(key2.hash)
  })

  it('hash matches when hashing the same key', async () => {
    const { generateApiKey, hashApiKey } = await import('@/lib/encryption')
    const result = generateApiKey('rp_')
    expect(hashApiKey(result.key)).toBe(result.hash)
  })

  it('hash does not match for different keys', async () => {
    const { generateApiKey, hashApiKey } = await import('@/lib/encryption')
    const result1 = generateApiKey('rp_')
    const result2 = generateApiKey('rp_')
    expect(hashApiKey(result1.key)).not.toBe(hashApiKey(result2.key))
  })

  it('supports custom prefix', async () => {
    const { generateApiKey } = await import('@/lib/encryption')
    const result = generateApiKey('test_')
    expect(result.key).toMatch(/^test_[a-f0-9]{64}$/)
    expect(result.prefix).toMatch(/^test_[a-f0-9]{8}$/)
  })

  it('hash is deterministic', async () => {
    const { hashApiKey } = await import('@/lib/encryption')
    const key = 'rp_abc123'
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })
})
