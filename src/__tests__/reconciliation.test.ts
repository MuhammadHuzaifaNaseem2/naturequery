import { describe, expect, it } from 'vitest'
import { parseReconciliationAmount, reconcileReports } from '@/lib/reconciliation'

describe('parseReconciliationAmount', () => {
  it('parses common exported currency formats', () => {
    expect(parseReconciliationAmount('$1,234.50')).toBe(1234.5)
    expect(parseReconciliationAmount('(42.25)')).toBe(-42.25)
    expect(parseReconciliationAmount('not a number')).toBeNull()
  })
})

describe('reconcileReports', () => {
  it('isolates duplicates, missing IDs, amount mismatches, and invalid rows', () => {
    const result = reconcileReports({
      sourceRows: [
        { id: 'A', amount: 10 },
        { id: 'B', amount: 20 },
        { id: 'B', amount: 20 },
        { id: 'C', amount: 30 },
        { id: '', amount: 99 },
      ],
      comparisonRows: [
        { ref: 'A', net: 10 },
        { ref: 'B', net: 20 },
        { ref: 'C', net: 25 },
        { ref: 'D', net: 4 },
      ],
      sourceKey: 'id',
      sourceAmount: 'amount',
      comparisonKey: 'ref',
      comparisonAmount: 'net',
    })

    expect(result.sourceTotal).toBe(80)
    expect(result.comparisonTotal).toBe(59)
    expect(result.difference).toBe(21)
    expect(result.invalidSourceRows).toBe(1)
    expect(result.items.find((item) => item.key === 'A')?.status).toBe('matched')
    expect(result.items.find((item) => item.key === 'B')?.status).toBe('duplicate_key')
    expect(result.items.find((item) => item.key === 'C')?.status).toBe('amount_mismatch')
    expect(result.items.find((item) => item.key === 'D')?.status).toBe('only_in_comparison')
  })
})
