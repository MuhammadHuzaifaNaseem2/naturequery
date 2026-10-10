// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Runs the desktop sign-in flow and API routes against a disposable
 * PostgreSQL database with all migrations applied. Enable with NQ_WEB_IT=1 and
 * a DATABASE_URL pointing at a throwaway database (never production):
 *
 *   docker run -d --name nq-web-db -e POSTGRES_PASSWORD=webtest_pw -e POSTGRES_DB=naturequery_test -p 55442:5432 postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:webtest_pw@127.0.0.1:55442/naturequery_test npx prisma migrate deploy
 *   NQ_WEB_IT=1 DATABASE_URL=... npx vitest run src/lib/desktop
 */
const enabled =
  process.env.NQ_WEB_IT === '1' && /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  const text = JSON.stringify(body)
  return {
    method: 'POST',
    body: text,
    headers: {
      'content-type': 'application/json',
      'content-length': String(text.length),
      ...headers,
    },
  }
}

describe.skipIf(!enabled)('desktop sign-in', async () => {
  const { prisma } = await import('@/lib/prisma')
  const sessions = await import('../sessions')
  const tokenRoute = await import('@/app/api/desktop/token/route')
  const meRoute = await import('@/app/api/desktop/me/route')
  const logoutRoute = await import('@/app/api/desktop/logout/route')
  const generateRoute = await import('@/app/api/desktop/ai/generate/route')
  const reportRoute = await import('@/app/api/desktop/ai/report/route')

  let userId = ''

  beforeAll(async () => {
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEYS
    const user = await prisma.user.create({
      data: { email: `desktop-it-${crypto.randomUUID()}@example.com`, name: 'Desktop Tester' },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('exchanges a code once, and only with the right verifier', async () => {
    const { verifier, challenge } = pkcePair()
    const code = await sessions.createAuthCode(userId, challenge, 'Test PC')
    await expect(sessions.exchangeAuthCode(code, pkcePair().verifier, {})).rejects.toMatchObject({
      code: 'invalid_grant',
    })
    const tokens = await sessions.exchangeAuthCode(code, verifier, { platform: 'win32' })
    expect(tokens.accessToken).toMatch(/^nqd_at_/)
    expect(tokens.refreshToken).toMatch(/^nqd_rt_/)
    expect(tokens.user).toMatchObject({ id: userId, name: 'Desktop Tester' })
    await expect(sessions.exchangeAuthCode(code, verifier, {})).rejects.toMatchObject({
      code: 'invalid_grant',
    })
    expect(await sessions.authenticateAccessToken(tokens.accessToken)).toMatchObject({ userId })
  })

  it('refuses expired codes', async () => {
    const { verifier, challenge } = pkcePair()
    const code = await sessions.createAuthCode(userId, challenge, null)
    await prisma.desktopAuthCode.updateMany({
      where: { userId, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    await expect(sessions.exchangeAuthCode(code, verifier, {})).rejects.toThrow(/expired/)
  })

  it('rotates refresh tokens, tolerates a quick retry and ends stolen sessions', async () => {
    const { verifier, challenge } = pkcePair()
    const first = await sessions.exchangeAuthCode(
      await sessions.createAuthCode(userId, challenge, null),
      verifier,
      {}
    )
    const second = await sessions.refreshDesktopSession(first.refreshToken, {})
    expect(second.refreshToken).not.toBe(first.refreshToken)
    expect(await sessions.authenticateAccessToken(first.accessToken)).toBeNull()
    expect(await sessions.authenticateAccessToken(second.accessToken)).not.toBeNull()

    // The app retries with the old token right away (its response was lost).
    const retried = await sessions.refreshDesktopSession(first.refreshToken, {})
    expect(await sessions.authenticateAccessToken(retried.accessToken)).not.toBeNull()

    // Much later, the old token shows up again: someone copied it.
    await prisma.desktopSession.updateMany({
      where: { userId, revokedAt: null },
      data: { refreshedAt: new Date(Date.now() - 5 * 60 * 1000) },
    })
    await expect(sessions.refreshDesktopSession(first.refreshToken, {})).rejects.toThrow(
      /signed out/
    )
    expect(await sessions.authenticateAccessToken(retried.accessToken)).toBeNull()
    await expect(sessions.refreshDesktopSession(retried.refreshToken, {})).rejects.toThrow(
      /signed out/
    )
  })

  it('signs out desktop sessions created before a password change', async () => {
    const { verifier, challenge } = pkcePair()
    const tokens = await sessions.exchangeAuthCode(
      await sessions.createAuthCode(userId, challenge, null),
      verifier,
      {}
    )
    await prisma.user.update({
      where: { id: userId },
      data: { passwordChangedAt: new Date(Date.now() + 1000) },
    })
    expect(await sessions.authenticateAccessToken(tokens.accessToken)).toBeNull()
    await expect(sessions.refreshDesktopSession(tokens.refreshToken, {})).rejects.toThrow()
    await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: null } })
  })

  it('serves the token, account, AI and sign-out routes', async () => {
    const { verifier, challenge } = pkcePair()
    const code = await sessions.createAuthCode(userId, challenge, 'Route PC')

    const bad = await tokenRoute.POST(
      new Request('http://localhost/api/desktop/token', json({ grant_type: 'password' }))
    )
    expect(bad.status).toBe(400)

    const response = await tokenRoute.POST(
      new Request(
        'http://localhost/api/desktop/token',
        json({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          device_name: 'Route PC',
          platform: 'win32',
          app_version: '0.9.0',
        })
      )
    )
    expect(response.status).toBe(200)
    const tokens = await response.json()
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600 })
    expect(tokens.plan).toMatchObject({ planName: 'Free', queryLimit: 50, queriesUsed: 0 })
    const auth = { authorization: `Bearer ${tokens.access_token}` }

    const me = await meRoute.GET(new Request('http://localhost/api/desktop/me', { headers: auth }))
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({ user: { id: userId }, plan: { planName: 'Free' } })

    const anonymous = await meRoute.GET(new Request('http://localhost/api/desktop/me'))
    expect(anonymous.status).toBe(401)

    const generate = (question: string) =>
      generateRoute.POST(
        new Request(
          'http://localhost/api/desktop/ai/generate',
          json({ question, dialect: 'postgresql', schema: [] }, auth)
        )
      )
    // No AI provider is configured in tests.
    const unavailable = await generate('How many customers?')
    expect(unavailable.status).toBe(503)
    expect((await unavailable.json()).error).toBe('ai_unavailable')

    // At the monthly limit, the request is refused before calling the AI.
    await prisma.usageRecord.createMany({
      data: Array.from({ length: 50 }, () => ({ userId, action: 'QUERY' })),
    })
    const overLimit = await generate('How many customers?')
    expect(overLimit.status).toBe(402)
    expect(await overLimit.json()).toMatchObject({
      error: 'plan_limit',
      plan: { queryLimit: 50, queriesUsed: 50 },
    })

    // Reporting an AI answer is kept in the audit log for review.
    const report = (body: unknown, headers: Record<string, string> = auth) =>
      reportRoute.POST(new Request('http://localhost/api/desktop/ai/report', json(body, headers)))
    const reported = {
      kind: 'summary',
      reason: 'offensive',
      comment: 'Rude wording',
      question: 'How many customers?',
      content: 'An inappropriate summary',
    }
    expect((await report(reported, {})).status).toBe(401)
    expect((await report({ ...reported, reason: 'boring' })).status).toBe(400)
    expect((await report({ ...reported, content: ' ' })).status).toBe(400)
    const accepted = await report(reported)
    expect(accepted.status).toBe(202)
    expect(await accepted.json()).toEqual({ received: true })
    const entry = await prisma.auditLog.findFirst({
      where: { userId, action: 'AI_OUTPUT_REPORTED' },
    })
    expect(entry).toMatchObject({ resource: 'desktopAi' })
    expect(entry?.metadata).toMatchObject({
      kind: 'summary',
      reason: 'offensive',
      comment: 'Rude wording',
      content: 'An inappropriate summary',
    })

    const logout = await logoutRoute.POST(
      new Request('http://localhost/api/desktop/logout', { method: 'POST', headers: auth })
    )
    expect(logout.status).toBe(204)
    const after = await meRoute.GET(
      new Request('http://localhost/api/desktop/me', { headers: auth })
    )
    expect(after.status).toBe(401)
  })
})
