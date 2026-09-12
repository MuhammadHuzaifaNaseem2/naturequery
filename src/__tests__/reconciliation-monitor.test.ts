import { describe, expect, it } from 'vitest'
import { isMonitorDefinition, nextMonitorRun } from '@/lib/reconciliation-monitor'

describe('reconciliation monitor definition', () => {
  it('calculates daily, weekly, and monthly runs in UTC', () => {
    const now = new Date('2026-09-12T02:00:00.000Z')
    expect(nextMonitorRun('DAILY', now).toISOString()).toBe('2026-09-13T02:00:00.000Z')
    expect(nextMonitorRun('WEEKLY', now).toISOString()).toBe('2026-09-19T02:00:00.000Z')
    expect(nextMonitorRun('MONTHLY', now).toISOString()).toBe('2026-10-12T02:00:00.000Z')
  })

  it('rejects an incomplete monitor', () => {
    expect(isMonitorDefinition({ version: 1, name: 'Missing reports' })).toBe(false)
  })
})
