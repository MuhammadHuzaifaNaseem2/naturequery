/**
 * Connection Driver Pool — LRU Cache
 *
 * Reuses database driver instances across requests to prevent
 * connection storms. Each unique set of credentials maps to a
 * single cached driver with an idle timeout.
 *
 * Key behaviors:
 * - Max 50 cached drivers globally (prevents memory leaks)
 * - Idle timeout: 5 minutes (auto-closes unused connections)
 * - Thread-safe: concurrent requests to the same DB reuse one driver
 * - Credentials are hashed (never stored in plaintext in the cache key)
 */

import { createHash } from 'crypto'
import { createDriver, type DatabaseType, type DatabaseDriver } from './db-drivers'
import type { DBCredentials } from '@/actions/db'

interface PoolEntry {
  driver: DatabaseDriver
  lastUsed: number
  credentialHash: string
}

const MAX_POOL_SIZE = 50
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

const pool = new Map<string, PoolEntry>()

/**
 * Build a deterministic, non-reversible key from credentials.
 * Uses SHA-256 so plaintext passwords never appear in the cache map.
 */
function hashCredentials(credentials: DBCredentials, dbType: DatabaseType): string {
  const raw = JSON.stringify({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    dbType,
  })
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

/**
 * Get (or create) a cached driver for the given credentials.
 * The returned driver should NOT be closed by the caller — the pool manages lifecycle.
 */
export function getOrCreateDriver(
  credentials: DBCredentials,
  dbType: DatabaseType = 'postgresql'
): DatabaseDriver {
  const key = hashCredentials(credentials, dbType)

  const existing = pool.get(key)
  if (existing) {
    existing.lastUsed = Date.now()
    return existing.driver
  }

  // Evict oldest entry if pool is full
  if (pool.size >= MAX_POOL_SIZE) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [k, entry] of pool.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed
        oldestKey = k
      }
    }
    if (oldestKey) {
      const evicted = pool.get(oldestKey)
      pool.delete(oldestKey)
      evicted?.driver.close().catch(() => {})
    }
  }

  const driver = createDriver(credentials, dbType)
  pool.set(key, {
    driver,
    lastUsed: Date.now(),
    credentialHash: key,
  })

  return driver
}

/**
 * Explicitly remove a driver from the pool (e.g. when a connection is deleted).
 */
export function evictDriver(credentials: DBCredentials, dbType: DatabaseType = 'postgresql'): void {
  const key = hashCredentials(credentials, dbType)
  const entry = pool.get(key)
  if (entry) {
    pool.delete(key)
    entry.driver.close().catch(() => {})
  }
}

/**
 * Periodic cleanup — close idle connections.
 * Runs every 60 seconds.
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of pool.entries()) {
      if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        pool.delete(key)
        entry.driver.close().catch(() => {})
      }
    }
  }, 60_000)
}

/** Current pool size (for monitoring/debugging) */
export function poolSize(): number {
  return pool.size
}
