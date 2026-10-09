import { desktopPlanUsage, desktopUser } from '@/lib/desktop/account'
import { desktopError, desktopJson, isResponse, requireDesktopUser } from '@/lib/desktop/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The signed-in user and their plan, shown in NatureQuery Desktop. */
export async function GET(request: Request) {
  const principal = await requireDesktopUser(request, {
    name: 'me',
    maxRequests: 60,
    windowSeconds: 60,
  })
  if (isResponse(principal)) return principal

  const [user, plan] = await Promise.all([
    desktopUser(principal.userId),
    desktopPlanUsage(principal.userId),
  ])
  if (!user) return desktopError(401, 'invalid_token', 'This account no longer exists.')
  return desktopJson({ user, plan })
}
