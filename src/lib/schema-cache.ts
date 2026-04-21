/**
 * Client-side schema cache with TTL.
 * Avoids refetching database schema on every connection switch.
 *
 * Keyed by connectionId. Previously keyed by host:port/database, but that
 * collided for Magic Dataset connections (all have host=magic, port=0) and
 * also leaked across users sharing a DB host.
 */

import { DatabaseSchema } from '@/actions/db'

interface CacheEntry {
  schema: DatabaseSchema
  timestamp: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

class SchemaCache {
  private cache = new Map<string, CacheEntry>()
  private ttl: number

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttl = ttlMs
  }

  /**
   * Get a cached schema if it exists and hasn't expired.
   */
  get(connectionId: string): DatabaseSchema | null {
    const entry = this.cache.get(connectionId)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(connectionId)
      return null
    }

    return entry.schema
  }

  /**
   * Store a schema in the cache.
   */
  set(connectionId: string, schema: DatabaseSchema): void {
    this.cache.set(connectionId, { schema, timestamp: Date.now() })
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(connectionId: string): void {
    this.cache.delete(connectionId)
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear()
  }
}

// Singleton instance
export const schemaCache = new SchemaCache()
