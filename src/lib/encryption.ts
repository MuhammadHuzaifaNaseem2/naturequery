import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derive a key from the encryption key environment variable
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  
  // Convert hex string to buffer
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
 * Decrypt an encrypted string
 * @param encryptedData - The encrypted string in format: iv:salt:tag:encrypted
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getKey()
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
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
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
 * Generate a random API key
 * @param prefix - Prefix for the key (e.g., 'rp_')
 * @returns Object with key and hashed version
 */
export function generateApiKey(prefix: string = 'rp_'): { key: string; hash: string; prefix: string } {
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
