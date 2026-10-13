/**
 * Pure parser for PostgreSQL/postgres connection string URIs.
 * Extracted from SettingsForm so it can be unit-tested independently.
 *
 * Supported format:
 *   postgresql://[user[:password]@]host[:port]/database[?params]
 *   postgres://...   (alias — treated identically)
 *
 * Only postgresql/postgres schemes are supported because that is the only
 * dialect where the "Paste connection string" button is shown.
 */

const CONNECTION_RE =
  /^(?:postgresql|postgres):\/\/([^:@]+)(?::([^@]*))?@([^/:]+)(?::(\d+))?\/([^?#]+)(?:[?#].*)?$/i

export interface ParsedConnection {
  user: string
  /** Empty when the string held a placeholder such as Supabase's [YOUR-PASSWORD] */
  password: string
  /** True when the string held a placeholder instead of the password */
  passwordPlaceholder: boolean
  host: string
  /** null when the port was absent — callers should fall back to their own default */
  port: number | null
  database: string
}

/** Placeholders that providers put where the password goes, e.g. [YOUR-PASSWORD] or <password>. */
const PASSWORD_PLACEHOLDER_RE = /^[[<]\s*(?:your[-_ ]?)?password\s*[\]>]$/i

export type ParseResult =
  | { success: true; data: ParsedConnection }
  | { success: false; error: string }

/**
 * Parse a PostgreSQL connection string URI.
 *
 * Returns `{ success: false, error: '' }` (no error message) for an empty
 * or whitespace-only input so the UI can silently ignore it.
 */
export function parseConnectionString(input: string): ParseResult {
  const trimmed = input.trim()

  // Empty clipboard — ignore silently
  if (!trimmed) {
    return { success: false, error: '' }
  }

  const match = trimmed.match(CONNECTION_RE)
  if (!match) {
    return {
      success: false,
      error:
        'Invalid connection string format. Expected: postgresql://user:password@host:port/database',
    }
  }

  const [, rawUser, rawPassword, host, rawPort, rawDatabase] = match

  let user: string
  let password: string
  try {
    user = decodeURIComponent(rawUser ?? '')
    password = decodeURIComponent(rawPassword ?? '')
  } catch {
    return {
      success: false,
      error: 'Password contains invalid URL-encoding. Re-encode special characters and try again.',
    }
  }

  const passwordPlaceholder = PASSWORD_PLACEHOLDER_RE.test(password)

  return {
    success: true,
    data: {
      user,
      password: passwordPlaceholder ? '' : password,
      passwordPlaceholder,
      host,
      port: rawPort != null ? parseInt(rawPort, 10) : null,
      database: rawDatabase,
    },
  }
}
