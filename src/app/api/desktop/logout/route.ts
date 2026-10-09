import { z } from 'zod'
import { desktopError, isResponse, limitByIp, readJson } from '@/lib/desktop/http'
import {
  authenticateAccessToken,
  revokeByRefreshToken,
  revokeDesktopSession,
} from '@/lib/desktop/sessions'
import { REFRESH_TOKEN_PREFIX, bearerToken } from '@/lib/desktop/tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  refresh_token: z.string().startsWith(REFRESH_TOKEN_PREFIX).max(200).optional(),
})

/**
 * Signs NatureQuery Desktop out. Accepts the access token, or the refresh
 * token when the access token has already expired. Always succeeds, so the
 * app can sign out offline and retry later without telling the user.
 */
export async function POST(request: Request) {
  const limited = await limitByIp(request, 'logout', 30, 60)
  if (limited) return limited

  const token = bearerToken(request.headers.get('authorization'))
  if (token) {
    const principal = await authenticateAccessToken(token)
    if (principal) await revokeDesktopSession(principal.sessionId)
  }

  const hasBody = Number(request.headers.get('content-length') ?? 0) > 0
  if (hasBody) {
    const body = await readJson(request, bodySchema, 2_000)
    if (isResponse(body)) return body
    if (body.refresh_token) await revokeByRefreshToken(body.refresh_token)
  } else if (!token) {
    return desktopError(400, 'invalid_request', 'Nothing to sign out.')
  }

  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
