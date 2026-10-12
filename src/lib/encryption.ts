import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derive a key from the encryption key environment variable.
 * Supports key rotation: ENCRYPTION_KEY is the current key,
 * ENCRYPTION_KEY_PREVIOUS is the old key used only for decryption.
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'hex')
}

function getPreviousKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY_PREVIOUS
  if (!key) return null
  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a string value
 * @param text - The plaintext to encrypt
 * @returns Encrypted string in format: iv:salt:tag:encrypted
 */
export function encrypt(text: string): string {
  try {
    const key = getKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const salt = crypto.randomBytes(SALT_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    // Combine iv, salt, tag, and encrypted data
    return `${iv.toString('hex')}:${salt.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt with a specific key buffer.
 */
function decryptWithKey(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }
  const iv = Buffer.from(parts[0], 'hex')
  // parts[1] is salt (not used in decryption but kept for future key derivation)
  const tag = Buffer.from(parts[2], 'hex')
  const encrypted = parts[3]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Decrypt an encrypted string. Tries the current key first,
 * then falls back to ENCRYPTION_KEY_PREVIOUS for key rotation support.
 * @param encryptedData - The encrypted string in format: iv:salt:tag:encrypted
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  // Try current key first
  try {
    return decryptWithKey(encryptedData, getKey())
  } catch {
    // Fall back to previous key (key rotation)
    const previousKey = getPreviousKey()
    if (previousKey) {
      try {
        return decryptWithKey(encryptedData, previousKey)
      } catch {
        // Both keys failed
      }
    }
    throw new Error('Failed to decrypt data. The encryption key may have changed.')
  }
}

/**
 * Hash a password using bcrypt
 * @param password - The plaintext password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcrypt')
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

/**
 * Verify a password against a hash
 * @param password - The plaintext password
 * @param hash - The hashed password
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcrypt')
  return bcrypt.compare(password, hash)
}

/**
 * New API keys start with nq_ (NatureQuery). Keys made before October 2026 start with
 * rp_ (from the old name, ReportFlow) and keep working. Desktop sign-in tokens start with
 * nqd_, so they never pass for an API key.
 */
export const API_KEY_PREFIX = 'nq_'
const ACCEPTED_API_KEY_PREFIXES = [API_KEY_PREFIX, 'rp_']

/** True when the value has the shape of a NatureQuery API key (new or old prefix). */
export function hasApiKeyPrefix(value: string): boolean {
  return ACCEPTED_API_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))
}

/**
 * Generate a random API key
 * @param prefix - Prefix for the key (new keys use API_KEY_PREFIX)
 * @returns Object with key and hashed version
 */
export function generateApiKey(prefix: string = API_KEY_PREFIX): {
  key: string
  hash: string
  prefix: string
} {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const key = `${prefix}${randomBytes}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const displayPrefix = key.substring(0, prefix.length + 8)

  return {
    key,
    hash,
    prefix: displayPrefix,
  }
}

/**
 * Hash an API key for storage
 * @param key - The API key
 * @returns Hashed key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Validate password complexity.
 * Rules: 8–128 chars, must include at least 3 of 4 categories
 * (uppercase, lowercase, digit, special character).
 */
export function validatePasswordComplexity(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' }
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' }
  }

  const categories = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (categories < 3) {
    return {
      valid: false,
      error: 'Password must contain at least 3 of: uppercase, lowercase, number, special character',
    }
  }

  return { valid: true }
}
