// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * "Sign out of all devices" against a disposable PostgreSQL database with all
 * migrations applied (NQ_WEB_IT=1 and a DATABASE_URL on localhost, never
 * production). The signed-in user is mocked; everything else is real.
 */
const enabled =
  process.env.NQ_WEB_IT === '1' && /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

describe.skipIf(!enabled)('Sign out of all devices', async () => {
  const { prisma } = await import('@/lib/prisma')
  const { auth } = await import('@/lib/auth')
  const sessions = await import('@/lib/desktop/sessions')
  const { signOutEverywhere } = await import('@/actions/sessions')
  const { startedBeforeSignOutLine } = await import('@/lib/session-revocation')

  let userId = ''

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `sign-out-it-${crypto.randomUUID()}@example.com`, name: 'Sign-out Tester' },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('ends browser and desktop sessions, and lets the person sign in again', async () => {
    const { verifier, challenge } = pkcePair()
    const desktop = await sessions.exchangeAuthCode(
      await sessions.createAuthCode(userId, challenge, 'Office PC'),
      verifier,
      { platform: 'win32' }
    )
    expect(await sessions.authenticateAccessToken(desktop.accessToken)).not.toBeNull()
    const browserSignedInAt = Date.now() - 1000

    vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never)
    expect(await signOutEverywhere()).toEqual({ ok: true })

    const { passwordChangedAt: line } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordChangedAt: true },
    })
    expect(line).toBeInstanceOf(Date)
    // A browser that signed in before is signed out at its next check; a new sign-in is not.
    expect(startedBeforeSignOutLine({ signedInAt: browserSignedInAt }, line!)).toBe(true)
    expect(startedBeforeSignOutLine({ signedInAt: Date.now() + 1 }, line!)).toBe(false)
    // The desktop app is signed out at once, and disappears from the list.
    expect(await sessions.authenticateAccessToken(desktop.accessToken)).toBeNull()
    await expect(sessions.refreshDesktopSession(desktop.refreshToken, {})).rejects.toThrow()
    expect(await sessions.listDesktopSessions(userId)).toHaveLength(0)

    const audit = await prisma.auditLog.findFirst({
      where: { userId, action: 'SIGNED_OUT_EVERYWHERE' },
    })
    expect(audit).not.toBeNull()
  })

  it('does nothing for someone who is not signed in', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect(await signOutEverywhere()).toEqual({ ok: false })
  })
})
