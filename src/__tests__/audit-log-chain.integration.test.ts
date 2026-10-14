// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The audit writer inside a real database transaction, as the admin actions use it:
 * the change and its entry are saved together or not at all, and the chain stays
 * verifiable. Runs with NQ_WEB_IT=1 against a throwaway database on localhost.
 */
const enabled =
  process.env.NQ_WEB_IT === '1' && /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')

describe.skipIf(!enabled)('audit entries inside a transaction', async () => {
  const { prisma } = await import('@/lib/prisma')
  const { writeImmutableAuditLog, verifyChainIntegrity } = await import('@/lib/audit-immutable')
  let userId = ''

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `audit-it-${crypto.randomUUID()}@example.com`, name: 'Before' },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('saves the change and its entry together, and chains the next entry to it', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { name: 'After' } })
      await writeImmutableAuditLog(
        { userId, action: 'CHANGE_USER_ROLE', resource: 'user', resourceId: userId },
        tx
      )
    })
    const second = await writeImmutableAuditLog({ userId, action: 'CREATE_API_KEY' })

    const entries = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    expect(entries.map((entry) => entry.action)).toEqual(['CHANGE_USER_ROLE', 'CREATE_API_KEY'])
    expect(entries[1].previousHash).toBe(entries[0].hash)
    expect(second.hash).toBe(entries[1].hash)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe('After')
    expect(await verifyChainIntegrity(userId)).toMatchObject({ valid: true })
  })

  it('keeps neither the change nor the entry when the transaction fails', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { name: 'Never saved' } })
        await writeImmutableAuditLog({ userId, action: 'ADMIN_DELETE_CONNECTION' }, tx)
        throw new Error('the change failed')
      })
    ).rejects.toThrow('the change failed')

    expect(
      await prisma.auditLog.count({ where: { userId, action: 'ADMIN_DELETE_CONNECTION' } })
    ).toBe(0)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe('After')
    expect(await verifyChainIntegrity(userId)).toMatchObject({ valid: true })
  })
})
