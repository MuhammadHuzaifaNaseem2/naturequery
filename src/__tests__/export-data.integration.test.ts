// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * "Download my data" against a disposable PostgreSQL database with all migrations
 * applied (NQ_WEB_IT=1 and a DATABASE_URL on localhost, never production). The
 * signed-in user is mocked; everything else is real.
 */
const enabled =
  process.env.NQ_WEB_IT === '1' && /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe.skipIf(!enabled)('Download my data', async () => {
  const { prisma } = await import('@/lib/prisma')
  const { auth } = await import('@/lib/auth')
  const { GET } = await import('@/app/api/account/export-data/route')

  const secrets = {
    passwordHash: `hash-${crypto.randomUUID()}`,
    twoFactorSecret: `totp-${crypto.randomUUID()}`,
    aiKey: `gsk-${crypto.randomUUID()}`,
    dbPassword: `dbpw-${crypto.randomUUID()}`,
    storeCredentials: `store-${crypto.randomUUID()}`,
    tokenHash: `token-${crypto.randomUUID()}`,
  }
  let userId = ''

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `export-it-${crypto.randomUUID()}@example.com`,
        name: 'Export Tester',
        password: secrets.passwordHash,
        twoFactorSecret: secrets.twoFactorSecret,
        groqApiKey: secrets.aiKey,
        weeklySummaryEmail: false,
      },
    })
    userId = user.id
    await prisma.databaseConnection.create({
      data: {
        userId,
        name: 'Shop',
        host: 'db.example.com',
        port: 5432,
        database: 'shop',
        user: 'reader',
        password: secrets.dbPassword,
        dbType: 'supabase',
      },
    })
    await prisma.commerceConnection.create({
      data: {
        userId,
        name: 'Store',
        provider: 'woocommerce',
        storeUrl: 'https://store.example.com',
        credentials: secrets.storeCredentials,
      },
    })
    await prisma.desktopSession.create({
      data: {
        userId,
        accessTokenHash: `${secrets.tokenHash}-a`,
        accessExpiresAt: new Date(Date.now() + 60_000),
        refreshTokenHash: `${secrets.tokenHash}-r`,
        refreshExpiresAt: new Date(Date.now() + 60_000),
        deviceName: 'Office PC',
        platform: 'win32',
      },
    })
    await prisma.notification.create({
      data: { userId, type: 'system', title: 'Hello', message: 'Welcome' },
    })
    vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never)
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('includes connections, settings and sign-ins, and never a secret', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="naturequery-data-export-/
    )
    const text = await res.text()
    for (const [name, secret] of Object.entries(secrets)) {
      expect(text.includes(secret), `${name} must not be in the export`).toBe(false)
    }
    const data = JSON.parse(text)
    expect(data.databaseConnections.connections).toEqual([
      expect.objectContaining({ name: 'Shop', dbType: 'supabase', host: 'db.example.com' }),
    ])
    expect(data.databaseConnections.connections[0]).not.toHaveProperty('password')
    expect(data.storeConnections.connections).toEqual([
      expect.objectContaining({ name: 'Store', storeUrl: 'https://store.example.com' }),
    ])
    expect(data.settings).toMatchObject({ weeklySummaryEmail: false, ownAiKeySaved: true })
    expect(data.profile).not.toHaveProperty('groqApiKey')
    expect(data.desktopSignIns.sessions).toEqual([
      expect.objectContaining({ deviceName: 'Office PC', platform: 'win32' }),
    ])
    expect(data.notifications.entries).toHaveLength(1)

    // Recorded in the tamper-evident audit trail.
    const audit = await prisma.auditLog.findFirst({ where: { userId, action: 'DATA_EXPORT' } })
    expect(audit?.hash).toBeTruthy()
  })

  it('asks people to wait instead of exporting twice in ten minutes', async () => {
    const res = await GET()
    expect(res.status).toBe(429)
    expect((await res.json()).error).toMatch(/You can download it again in \d+ minutes?\./)
  })
})
