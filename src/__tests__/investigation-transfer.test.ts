import { describe, expect, it } from 'vitest'
import {
  createInvestigationReport,
  isInvestigationTransfer,
  suggestInvestigationColumns,
} from '@/lib/investigation-transfer'

describe('query result investigation transfer', () => {
  it('keeps only result fields and serializes browser-unsafe values', () => {
    const report = createInvestigationReport({
      name: 'Revenue by order',
      question: 'Show revenue',
      connectionName: 'Production',
      fields: ['order_id', 'net_amount', 'created_at'],
      rows: [
        {
          order_id: BigInt(42),
          net_amount: 125.5,
          created_at: new Date('2026-09-12T00:00:00.000Z'),
          hidden: 'not transferred',
        },
      ],
    })

    expect(report.rows[0]).toEqual({
      order_id: '42',
      net_amount: 125.5,
      created_at: '2026-09-12T00:00:00.000Z',
    })
    expect(() => JSON.stringify(report)).not.toThrow()
  })

  it('suggests likely identifier and amount columns', () => {
    expect(suggestInvestigationColumns(['created_at', 'transaction_id', 'gross_total'])).toEqual({
      key: 'transaction_id',
      amount: 'gross_total',
    })
  })

  it('rejects an incomplete comparison payload', () => {
    expect(isInvestigationTransfer({ source: { rows: [] }, comparison: null })).toBe(false)
  })
})
