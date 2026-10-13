// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth', () => ({
  auth: async () => (session.userId ? { user: { id: session.userId, role: 'USER' } } : null),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitAsync: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

import { exportToCSV, exportToExcel } from '@/actions/export'
import { analyzeResults } from '@/actions/insights'

const rows = [{ region: 'North', total: 17 }]
const fields = ['region', 'total']

afterEach(() => {
  session.userId = ''
})

describe('dashboard actions the browser calls', () => {
  it('refuse callers who are not signed in', async () => {
    const refused = { success: false, error: 'Not authenticated' }
    await expect(
      analyzeResults({ rows, fields, originalQuestion: 'Totals by region' })
    ).resolves.toEqual(refused)
    await expect(exportToCSV({ rows, fields })).resolves.toEqual(refused)
    await expect(exportToExcel({ rows, fields })).resolves.toEqual(refused)
  })

  it('export for a signed-in user', async () => {
    session.userId = 'user-a'
    const csv = await exportToCSV({ rows, fields, filename: 'totals.csv' })
    expect(csv.success).toBe(true)
    expect(Buffer.from(csv.data ?? '', 'base64').toString('utf8')).toContain('North')
  })
})
