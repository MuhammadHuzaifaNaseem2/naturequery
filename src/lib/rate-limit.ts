/**
 * Rate limiter with Redis (Upstash) support for production
 * and in-memory fallback for development.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// --- Configuration ---

const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

// Warn loudly in production if Redis is not configured
if (
  process.env.NODE_ENV === 'production' &&
  !isRedisConfigured &&
  typeof console !== 'undefined'
) {
  console.warn(
    '[SECURITY] Rate limiting is running in-memory mode in production. ' +
    'This provides NO protection in multi-instance/serverless deployments. ' +
    'Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting.'
  )
}

const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// --- In-memory fallback (development) ---

interface RateLimitEntry {
  timestamps: number[]
}

const memoryStore = new Map<string, RateLimitEntry>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000)
      if (entry.timestamps.length === 0) memoryStore.delete(key)
    }
  }, 5 * 60 * 1000)
}

// --- Types ---

interface RateLimitOptions {
  maxRequests: number
  windowSeconds: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

// --- Upstash limiter cache ---

const limiterCache = new Map<string, Ratelimit>()

function getOrCreateLimiter(options: RateLimitOptions): Ratelimit {
  const key = `${options.maxRequests}:${options.windowSeconds}`
  let limiter = limiterCache.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(options.maxRequests, `${options.windowSeconds} s`),
      analytics: false,
    })
    limiterCache.set(key, limiter)
  }
  return limiter
}

// --- In-memory implementation ---

function memoryRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const windowMs = options.windowSeconds * 1000

  let entry = memoryStore.get(identifier)
  if (!entry) {
    entry = { timestamps: [] }
    memoryStore.set(identifier, entry)
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= options.maxRequests) {
    const oldest = entry.timestamps[0]
    const retryAfterMs = windowMs - (now - oldest)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: options.maxRequests - entry.timestamps.length,
    retryAfterSeconds: 0,
  }
}

// --- Public API ---

/**
 * Synchronous rate limiter (in-memory only).
 * Kept for backward compatibility with existing callers.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 5, windowSeconds: 60 }
): RateLimitResult {
  return memoryRateLimit(identifier, options)
}

/**
 * Async rate limiter that uses Redis when available, in-memory otherwise.
 * Preferred for all new code and async contexts.
 */
export async function rateLimitAsync(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 5, windowSeconds: 60 }
): Promise<RateLimitResult> {
  // 1. Always prioritize memory for zero-latency in development
  // 2. Fall back to memory if Redis is not configured
  if (process.env.NODE_ENV === 'development' || !redis) {
    return memoryRateLimit(identifier, options)
  }

  // 3. In production, attempt Redis with a strict 1s timeout
  let timeoutId: NodeJS.Timeout | undefined
  try {
    const limiter = getOrCreateLimiter(options)
    
    // Create a timeout promise that we can clear
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Redis timeout')), 1000)
    })

    const result = await Promise.race([
      limiter.limit(identifier),
      timeoutPromise
    ])

    if (timeoutId) clearTimeout(timeoutId)

    return {
      allowed: result.success,
      remaining: result.remaining,
      retryAfterSeconds: result.success
        ? 0
        : Math.ceil((result.reset - Date.now()) / 1000),
    }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    // Redis failed or timed out — fall back to memory
    console.warn(`[rate-limit] Redis failure for ${identifier}, using memory fallback:`, (err as Error).message)
    return memoryRateLimit(identifier, options)
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}
