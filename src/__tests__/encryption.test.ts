import { describe, it, expect, beforeEach, vi } from 'vitest'

// Set a valid 32-byte hex key before importing the module
const TEST_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

describe('Encryption', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_KEY', TEST_KEY)
  })

  it('encrypts and decrypts a string correctly', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const plaintext = 'my-secret-password-123!'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertexts for the same input (random IV)', async () => {
    const { encrypt } = await import('@/lib/encryption')
    const plaintext = 'same-input'
    const encrypted1 = encrypt(plaintext)
    const encrypted2 = encrypt(plaintext)
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('encrypted output has correct format (iv:salt:tag:data)', async () => {
    const { encrypt } = await import('@/lib/encryption')
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(4)
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32)
    // Salt is 64 bytes = 128 hex chars
    expect(parts[1]).toHaveLength(128)
    // Tag is 16 bytes = 32 hex chars
    expect(parts[2]).toHaveLength(32)
    // Encrypted data is non-empty
    expect(parts[3].length).toBeGreaterThan(0)
  })

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const encrypted = encrypt('test')
    const tampered = encrypted.slice(0, -2) + 'ff'
    expect(() => decrypt(tampered)).toThrow('Failed to decrypt data')
  })

  it('throws on invalid format', async () => {
    const { decrypt } = await import('@/lib/encryption')
    expect(() => decrypt('not-valid-format')).toThrow('Failed to decrypt data')
  })

  it('throws when ENCRYPTION_KEY is missing', async () => {
    vi.stubEnv('ENCRYPTION_KEY', '')
    // Re-import to get fresh module
    vi.resetModules()
    const { encrypt } = await import('@/lib/encryption')
    expect(() => encrypt('test')).toThrow()
  })

  it('handles empty string encryption', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const encrypted = encrypt('')
    expect(decrypt(encrypted)).toBe('')
  })

  it('handles unicode characters', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const plaintext = 'p@$$w0rd!#%^&*()日本語'
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })
})

describe('API Key Generation', () => {
  it('generates a key with the correct prefix', async () => {
    const { generateApiKey } = await import('@/lib/encryption')
    const result = generateApiKey('rp_')
    expect(result.key.startsWith('rp_')).toBe(true)
  })

  it('generates unique keys each time', async () => {
    const { generateApiKey } = await import('@/lib/encryption')
    const key1 = generateApiKey()
    const key2 = generateApiKey()
    expect(key1.key).not.toBe(key2.key)
    expect(key1.hash).not.toBe(key2.hash)
  })

  it('hash is consistent for the same key', async () => {
    const { hashApiKey } = await import('@/lib/encryption')
    const hash1 = hashApiKey('test-key')
    const hash2 = hashApiKey('test-key')
    expect(hash1).toBe(hash2)
  })
})
