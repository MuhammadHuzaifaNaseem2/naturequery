import { describe, expect, it } from 'vitest'
import { suggestReconciliationCauses } from '@/lib/cause-engine'
import type { ReconciliationItem } from '@/lib/reconciliation'

const missingItem: ReconciliationItem = {
  key: '3',
  sourceAmount: 79.99,
  comparisonAmount: 0,
  difference: 79.99,
  sourceCount: 1,
  comparisonCount: 0,
  status: 'only_in_source',
}

describe('cause engine', () => {
  it('explains a record excluded by the comparison query filter', () => {
    const suggestions = suggestReconciliationCauses({
      items: [missingItem],
      source: {
        rows: [{ id: 3, amount: 79.99, status: 'shipped' }],
        keyColumn: 'id',
        amountColumn: 'amount',
        sql: 'SELECT id, amount FROM orders',
      },
      comparison: {
        rows: [],
        keyColumn: 'id',
        amountColumn: 'amount',
        sql: "SELECT id, amount FROM orders WHERE status = 'completed'",
      },
    })

    expect(suggestions['3']).toEqual({
      cause: 'Filter / scope difference',
      confidence: 'high',
      evidence: 'Report B requires status = completed; this record has status = shipped.',
    })
  })

  it('detects duplicate evidence deterministically', () => {
    const duplicate: ReconciliationItem = {
      ...missingItem,
      key: '42',
      status: 'duplicate_key',
      sourceCount: 2,
      comparisonCount: 1,
    }
    const suggestions = suggestReconciliationCauses({
      items: [duplicate],
      source: { rows: [], keyColumn: 'id', amountColumn: 'amount' },
      comparison: { rows: [], keyColumn: 'id', amountColumn: 'amount' },
    })

    expect(suggestions['42']?.cause).toBe('Duplicate row')
    expect(suggestions['42']?.confidence).toBe('high')
  })

  it('leaves unsupported causes unresolved', () => {
    const suggestions = suggestReconciliationCauses({
      items: [missingItem],
      source: { rows: [{ id: 3, amount: 79.99 }], keyColumn: 'id', amountColumn: 'amount' },
      comparison: { rows: [], keyColumn: 'id', amountColumn: 'amount' },
    })

    expect(suggestions).toEqual({})
  })
})
