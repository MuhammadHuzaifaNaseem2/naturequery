import { NqError } from '@shared/errors'

/** An encrypted value as stored on disk. Format shared with desktop 0.2.x. */
export interface SealedSecret {
  method: 'os'
  value: string
}

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
  getSelectedStorageBackend?: () => string
}

/**
 * Seals secrets with the operating system's credential protection (DPAPI on
 * Windows, Keychain on macOS, libsecret on Linux). Refuses to store anything
 * if only Electron's plain-text fallback is available.
 */
export function createSecretBox(safeStorage: SafeStorageLike) {
  function available(): boolean {
    return (
      safeStorage.isEncryptionAvailable() &&
      safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
    )
  }

  function seal(plainText: string): SealedSecret {
    if (!available()) {
      throw new NqError('SECURE_STORAGE', 'Secure credential storage is unavailable.', {
        hint: 'Unlock your system keychain or sign in to your desktop session, then try again.',
      })
    }
    return { method: 'os', value: safeStorage.encryptString(plainText).toString('base64') }
  }

  function open(sealed: SealedSecret | undefined): string {
    if (!sealed || sealed.method !== 'os' || typeof sealed.value !== 'string' || !available()) {
      throw new NqError('SECURE_STORAGE', 'A saved credential could not be unlocked.', {
        hint: 'Edit the connection and enter the password again.',
      })
    }
    try {
      return safeStorage.decryptString(Buffer.from(sealed.value, 'base64'))
    } catch {
      throw new NqError('SECURE_STORAGE', 'A saved credential could not be unlocked.', {
        hint: 'This can happen after moving your profile to another computer or user. Edit the connection and enter the password again.',
      })
    }
  }

  return { available, seal, open }
}

export type SecretBox = ReturnType<typeof createSecretBox>
