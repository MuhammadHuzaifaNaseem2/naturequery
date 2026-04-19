/**
 * Server-side query result cache backed by Redis (Upstash).
 * Falls back to a no-op when Redis is not configured.
 *
 * Key design decisions:
 * - Cache key = SHA-256(connectionId + sql) → prevents cross-tenant leaks even if
 *   two users run the same SQL on different connections.
 * - TTL is configurable per call (default 5 min, widgets can override).
 * - Invalidation helpers wipe all caches for a connection (e.g. after schema change).
 */

import { Redis } from '@upstash/redis'
import crypto from 'crypto'

const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

export const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// ── Key builders ───────────────────────────────────────────────────────────

function queryCacheKey(connectionId: string, sql: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${connectionId}:${sql.trim()}`)
    .digest('hex')
    .slice(0, 32)
  return `qcache:${connectionId}:${hash}`
}

function schemaCacheKey(connectionId: string): string {
  return `schema:${connectionId}`
}

// ── Query result cache ─────────────────────────────────────────────────────

/**
 * Retrieve cached query results.
 * Returns null on cache miss or when Redis is unavailable.
 */
export async function getCachedQuery<T = unknown>(
  connectionId: string,
  sql: string
): Promise<T | null> {
  if (!redis) return null
  try {
    return await redis.get<T>(queryCacheKey(connectionId, sql))
  } catch (err) {
    console.warn('[query-cache] get error:', err)
    return null
  }
}

/**
 * Store query results in the cache.
 * @param ttlSeconds  Cache lifetime in seconds. Default 300 (5 min).
 *                    Set to 0 to skip caching.
 */
export async function setCachedQuery(
  connectionId: string,
  sql: string,
  data: unknown,
  ttlSeconds = 300
): Promise<void> {
  if (!redis || ttlSeconds <= 0) return
  try {
    await redis.set(queryCacheKey(connectionId, sql), data, { ex: ttlSeconds })
  } catch (err) {
    console.warn('[query-cache] set error:', err)
  }
}

/**
 * Invalidate ALL cached queries for a connection.
 * Call this after a schema change or when a connection is deleted.
 */
export async function invalidateConnectionCache(connectionId: string): Promise<void> {
  if (!redis) return
  try {
    // Scan for all keys matching this connection's prefix
    let cursor = 0
    const pattern = `qcache:${connectionId}:*`
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
      cursor = Number(nextCursor)
      if (keys.length > 0) {
        await redis.del(...(keys as string[]))
      }
    } while (cursor !== 0)
  } catch (err) {
    console.warn('[query-cache] invalidate error:', err)
  }
}

// ── Schema cache ───────────────────────────────────────────────────────────

/** TTL for schema cache: 1 hour. Schema rarely changes. */
const SCHEMA_TTL_SECONDS = 3600

/**
 * Retrieve a cached database schema.
 */
export async function getCachedSchema<T = unknown>(connectionId: string): Promise<T | null> {
  if (!redis) return null
  try {
    return await redis.get<T>(schemaCacheKey(connectionId))
  } catch (err) {
    console.warn('[schema-cache] get error:', err)
    return null
  }
}

/**
 * Store a database schema in the cache.
 */
export async function setCachedSchema(connectionId: string, schema: unknown): Promise<void> {
  if (!redis) return
  try {
    await redis.set(schemaCacheKey(connectionId), schema, { ex: SCHEMA_TTL_SECONDS })
  } catch (err) {
    console.warn('[schema-cache] set error:', err)
  }
}

/**
 * Invalidate the schema cache for a connection.
 * Call this when the user explicitly refreshes the schema.
 */
export async function invalidateSchemaCache(connectionId: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(schemaCacheKey(connectionId))
  } catch (err) {
    console.warn('[schema-cache] invalidate error:', err)
  }
}
