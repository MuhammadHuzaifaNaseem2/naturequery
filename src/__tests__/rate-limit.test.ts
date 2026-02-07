import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { rateLimit } from '@/lib/rate-limit'

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests within limit', () => {
    const result = rateLimit('test-1', { maxRequests: 3, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('blocks requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('test-2', { maxRequests: 5, windowSeconds: 60 })
    }
    const result = rateLimit('test-2', { maxRequests: 5, windowSeconds: 60 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after window expires', () => {
    for (let i = 0; i < 3; i++) {
      rateLimit('test-3', { maxRequests: 3, windowSeconds: 10 })
    }
    // Should be blocked
    expect(rateLimit('test-3', { maxRequests: 3, windowSeconds: 10 }).allowed).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(11_000)

    // Should be allowed again
    const result = rateLimit('test-3', { maxRequests: 3, windowSeconds: 10 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('tracks different identifiers independently', () => {
    for (let i = 0; i < 2; i++) {
      rateLimit('user-a', { maxRequests: 2, windowSeconds: 60 })
    }
    expect(rateLimit('user-a', { maxRequests: 2, windowSeconds: 60 }).allowed).toBe(false)
    expect(rateLimit('user-b', { maxRequests: 2, windowSeconds: 60 }).allowed).toBe(true)
  })

  it('provides retryAfter when blocked', () => {
    for (let i = 0; i < 2; i++) {
      rateLimit('test-5', { maxRequests: 2, windowSeconds: 30 })
    }
    const result = rateLimit('test-5', { maxRequests: 2, windowSeconds: 30 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30)
  })
})
