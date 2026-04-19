import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/actions/api-keys'
import { rateLimitAsync } from '@/lib/rate-limit'

export interface ApiAuthResult {
  userId: string
}

/**
 * Authenticate an API v1 request via Bearer token.
 * Returns { userId } on success, or a NextResponse error to return immediately.
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<ApiAuthResult | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid Authorization header. Use: Bearer rp_xxx' },
      { status: 401 }
    )
  }

  const rawKey = authHeader.slice(7)
  if (!rawKey || !rawKey.startsWith('rp_')) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key format' },
      { status: 401 }
    )
  }

  const userId = await validateApiKey(rawKey)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired API key' },
      { status: 401 }
    )
  }

  const rateLimit = await rateLimitAsync(`api:${userId}`, {
    maxRequests: 60,
    windowSeconds: 60,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return { userId }
}

/** Type guard to check if auth result is an error response */
export function isAuthError(result: ApiAuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
