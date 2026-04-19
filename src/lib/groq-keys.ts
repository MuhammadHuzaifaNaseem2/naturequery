import Groq from 'groq-sdk'

/**
 * Groq API Key Rotation
 *
 * Supports multiple Groq API keys to avoid rate limits on the free tier.
 * Each key gets its own rate-limit bucket on Groq's servers.
 *
 * Config in .env.local:
 *   GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3   (preferred — multiple keys)
 *   GROQ_API_KEY=gsk_single_key                  (fallback — single key)
 *
 * On each call, picks the next key round-robin. If a request fails with 429,
 * that key is marked as exhausted for a cooldown period and the next key is tried.
 */

interface KeyState {
  key: string
  exhaustedUntil: number // timestamp — 0 means available
}

let keys: KeyState[] | null = null
let roundRobinIndex = 0

function loadKeys(): KeyState[] {
  if (keys) return keys

  const multi = process.env.GROQ_API_KEYS
  if (multi) {
    keys = multi
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .map((key) => ({ key, exhaustedUntil: 0 }))
  }

  if (!keys || keys.length === 0) {
    const single = process.env.GROQ_API_KEY
    keys = single ? [{ key: single.trim(), exhaustedUntil: 0 }] : []
  }

  return keys
}

const COOLDOWN_MS = 60_000 // 60s cooldown for exhausted keys

/**
 * Get the next available Groq API key (round-robin, skipping exhausted keys).
 * Returns null if no keys are configured or all are exhausted.
 */
function getNextKey(): string | null {
  const pool = loadKeys()
  if (pool.length === 0) return null

  const now = Date.now()

  // Try each key in round-robin order
  for (let i = 0; i < pool.length; i++) {
    const idx = (roundRobinIndex + i) % pool.length
    const entry = pool[idx]

    if (entry.exhaustedUntil <= now) {
      roundRobinIndex = (idx + 1) % pool.length
      return entry.key
    }
  }

  // All keys exhausted — return the one that recovers soonest
  const soonest = pool.reduce((a, b) =>
    a.exhaustedUntil < b.exhaustedUntil ? a : b
  )
  return soonest.key
}

/**
 * Mark a key as rate-limited so it's skipped for the cooldown period.
 */
export function markKeyExhausted(apiKey: string): void {
  const pool = loadKeys()
  const entry = pool.find((k) => k.key === apiKey)
  if (entry) {
    entry.exhaustedUntil = Date.now() + COOLDOWN_MS
  }
}

/**
 * Check if an error is a Groq rate limit (429).
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message
  return (
    msg.includes('rate_limit_exceeded') ||
    msg.includes('Rate limit') ||
    msg.startsWith('429')
  )
}

/**
 * Create a Groq client using the next available key.
 * Returns null if no keys are configured (mock mode).
 */
export function getGroqClient(): { client: Groq; apiKey: string } | null {
  const key = getNextKey()
  if (!key) return null
  return { client: new Groq({ apiKey: key }), apiKey: key }
}

/**
 * Execute a function with automatic key rotation on rate limit errors.
 * If the current key is rate-limited, marks it exhausted and retries with the next key.
 * Tries up to `maxRetries` different keys before giving up.
 */
export async function withKeyRotation<T>(
  fn: (groq: Groq) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const pool = loadKeys()
  const attempts = Math.min(maxRetries, pool.length)

  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    const entry = getGroqClient()
    if (!entry) {
      throw new Error('No Groq API keys configured. AI features are in mock mode.')
    }

    try {
      return await fn(entry.client)
    } catch (error) {
      lastError = error
      if (isRateLimitError(error)) {
        markKeyExhausted(entry.apiKey)
        // Try the next key
        continue
      }
      // Non-rate-limit error — don't retry
      throw error
    }
  }

  // All keys exhausted
  throw lastError
}

/**
 * Get total number of configured keys (for diagnostics).
 */
export function getKeyCount(): number {
  return loadKeys().length
}
