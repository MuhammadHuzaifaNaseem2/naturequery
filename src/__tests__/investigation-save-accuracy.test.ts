import { it, expect, vi } from 'vitest'
import type { InvestigationSnapshot } from '@/lib/investigation-record'
const mocks = vi.hoisted(() => ({ audit: vi.fn(), findMany: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'owner' } }) }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { findMany: mocks.findMany } } }))
vi.mock('@/lib/audit-immutable', () => ({ writeImmutableAuditLog: mocks.audit }))
import { saveInvestigation, getSavedInvestigations } from '@/actions/investigations'
const input = (): InvestigationSnapshot => ({
  version: 1,
  name: 'Audit test',
  status: 'RESOLVED',
  metric: 'Revenue',
  period: 'September',
  currency: 'USD',
  source: { name: 'A', fields: ['id', 'amount'], rows: [{ id: 'a', amount: 10 }] },
  comparison: { name: 'B', fields: ['id', 'amount'], rows: [{ id: 'a', amount: 5 }] },
  sourceKey: 'id',
  sourceAmount: 'amount',
  comparisonKey: 'id',
  comparisonAmount: 'amount',
  causes: {},
  sourceTotal: 999999,
  comparisonTotal: 0,
  difference: 999999,
  unresolvedDifference: 0,
  issueCount: 0,
  resolvedCount: 100,
})
it('stores recomputed evidence instead of client-supplied totals and resolution', async () => {
  mocks.audit.mockClear()
  const result = await saveInvestigation({ snapshot: input() })
  expect(result.success).toBe(true)
  expect(mocks.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      metadata: {
        snapshot: expect.objectContaining({
          sourceTotal: 10,
          comparisonTotal: 5,
          difference: 5,
          unresolvedDifference: 5,
          issueCount: 1,
          resolvedCount: 0,
          status: 'OPEN',
        }),
      },
    })
  )
})
it('refuses to save invalid rows as a completed comparison', async () => {
  mocks.audit.mockClear()
  const snapshot = input()
  snapshot.source.rows = [{ id: 'a', amount: 'invalid' }]
  expect((await saveInvestigation({ snapshot })).success).toBe(false)
  expect(mocks.audit).not.toHaveBeenCalled()
})

it('flags old invalid snapshots for review instead of displaying their stored totals', async () => {
  const snapshot = input()
  snapshot.source.rows = [{ id: 'a', amount: 'invalid' }]
  mocks.findMany.mockResolvedValue([
    { resourceId: 'old-case', createdAt: new Date('2026-09-14'), metadata: { snapshot } },
  ])
  const result = await getSavedInvestigations()
  expect(result.data?.[0]).toMatchObject({ id: 'old-case', status: 'OPEN', needsReview: true })
})
