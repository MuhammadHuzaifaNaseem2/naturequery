/**
 * Client-side schema cache with TTL.
 * Avoids refetching database schema on every connection switch.
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
   * Generate a cache key from connection parameters.
   */
  private key(host: string, port: number, database: string): string {
    return `${host}:${port}/${database}`
  }

  /**
   * Get a cached schema if it exists and hasn't expired.
   */
  get(host: string, port: number, database: string): DatabaseSchema | null {
    const k = this.key(host, port, database)
    const entry = this.cache.get(k)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(k)
      return null
    }

    return entry.schema
  }

  /**
   * Store a schema in the cache.
   */
  set(host: string, port: number, database: string, schema: DatabaseSchema): void {
    const k = this.key(host, port, database)
    this.cache.set(k, { schema, timestamp: Date.now() })
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(host: string, port: number, database: string): void {
    const k = this.key(host, port, database)
    this.cache.delete(k)
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
