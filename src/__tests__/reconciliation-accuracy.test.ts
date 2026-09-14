import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import {
  reconcileReports,
  parseReconciliationAmount,
  type ReconciliationRow,
} from '@/lib/reconciliation'
import { worksheetToRows } from '@/lib/spreadsheet-import'
import { resolveProfileColumns } from '@/lib/reconciliation-profile'
import { reconciliationMonitorStatus } from '@/lib/reconciliation-monitor'
import { recomputeInvestigation, type InvestigationSnapshot } from '@/lib/investigation-record'
import { wooCommerceOrdersToRows } from '@/lib/woocommerce'
const compare = (
  sourceRows: ReconciliationRow[],
  comparisonRows: ReconciliationRow[],
  currency?: string
) =>
  reconcileReports({
    sourceRows,
    comparisonRows,
    sourceKey: 'id',
    sourceAmount: 'amount',
    comparisonKey: 'id',
    comparisonAmount: 'amount',
    currency,
  })
const snapshot = (
  sourceRows: ReconciliationRow[],
  comparisonRows: ReconciliationRow[]
): InvestigationSnapshot => ({
  version: 1,
  name: 'Test',
  status: 'RESOLVED',
  metric: 'Revenue',
  period: 'September',
  currency: 'USD',
  source: { name: 'A', fields: ['id', 'amount'], rows: sourceRows },
  comparison: { name: 'B', fields: ['id', 'amount'], rows: comparisonRows },
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
  resolvedCount: 999,
})
describe('Money and completion', () => {
  it('preserves offsetting issues in the unexplained amount and monitor alert', () => {
    const left = [
      { id: 'a', amount: 100 },
      { id: 'b', amount: 50 },
    ]
    const right = [
      { id: 'a', amount: 50 },
      { id: 'b', amount: 100 },
    ]
    const result = compare(left, right)
    expect(result.difference).toBe(0)
    expect(result.grossDifference).toBe(100)
    expect(result.allMatched).toBe(false)
    expect(reconciliationMonitorStatus(result, 75)).toBe('alert')
    expect(reconciliationMonitorStatus(result, 150)).toBe('within_threshold')
    expect(recomputeInvestigation(snapshot(left, right))).toMatchObject({
      sourceTotal: 150,
      comparisonTotal: 150,
      difference: 0,
      unresolvedDifference: 100,
      issueCount: 2,
      resolvedCount: 0,
      status: 'OPEN',
    })
  })
  it('compares one cent exactly at the default tolerance', () => {
    expect(compare([{ id: 'a', amount: 1.01 }], [{ id: 'a', amount: 1 }]).allMatched).toBe(true)
    expect(compare([{ id: 'a', amount: 1.02 }], [{ id: 'a', amount: 1 }]).allMatched).toBe(false)
  })
  it('adds decimal money without floating-point discrepancies', () => {
    expect(
      compare(
        [
          { id: 'a', amount: 0.1 },
          { id: 'b', amount: 0.2 },
        ],
        [
          { id: 'a', amount: 0.1 },
          { id: 'b', amount: 0.2 },
        ]
      ).sourceTotal
    ).toBe(0.3)
  })
  it.each(
    [
      [],
      [{ id: 'a', amount: 'invalid' }],
      [{ id: '', amount: 10 }],
      [{ id: 'a', amount: 1.001 }],
    ].map((rows) => ({ rows }))
  )('never reports incomplete rows as matched', ({ rows }) => {
    const result = compare(rows, rows)
    expect(result.isComplete).toBe(false)
    expect(result.allMatched).toBe(false)
    expect(reconciliationMonitorStatus(result, 0)).toBe('failed')
    expect(() => recomputeInvestigation(snapshot(rows, rows))).toThrow()
  })
  it('blocks partial totals if even one row is invalid', () => {
    const result = compare(
      [
        { id: 'a', amount: 10 },
        { id: 'b', amount: 'invalid' },
      ],
      [{ id: 'a', amount: 10 }]
    )
    expect(result.isComplete).toBe(false)
    expect(result.matchedCount).toBe(0)
  })
  it('blocks unsafe money magnitudes', () =>
    expect(compare([{ id: 'a', amount: 1e16 }], [{ id: 'a', amount: 1e16 }]).isComplete).toBe(
      false
    ))
  it.each(['1,23', '12,34.56', '(+10)', '1.2.3', '?10', '1 00'])(
    'rejects ambiguous amount %s',
    (value) => expect(parseReconciliationAmount(value)).toBeNull()
  )
  it('supports currency symbols and accounting negatives', () => {
    expect(parseReconciliationAmount('\u00a31,234.50')).toBe(1234.5)
    expect(parseReconciliationAmount('(\u20ac42.25)')).toBe(-42.25)
  })
})
describe('Currency validation', () => {
  it('rejects conflicting money symbols even without a currency column', () => {
    expect(
      compare([{ id: 'a', amount: '\u00a310' }], [{ id: 'a', amount: '$10' }], 'USD').isComplete
    ).toBe(false)
    expect(
      compare([{ id: 'a', amount: '\u00a310' }], [{ id: 'a', amount: '\u00a310' }], 'GBP')
        .allMatched
    ).toBe(true)
  })

  it('blocks equal numbers in different currencies', () => {
    const result = compare(
      [{ id: 'a', amount: 100, currency: 'USD' }],
      [{ id: 'a', amount: 100, currency: 'PKR' }]
    )
    expect(result.isComplete).toBe(false)
    expect(result.matchedCount).toBe(0)
  })
  it('blocks a currency that conflicts with the selected report currency', () =>
    expect(
      compare(
        [{ id: 'a', amount: 10, currency: 'PKR' }],
        [{ id: 'a', amount: 10, currency: 'PKR' }],
        'USD'
      ).isComplete
    ).toBe(false))
  it('checks currency_code and missing per-row currency values', () =>
    expect(
      compare(
        [
          { id: 'a', amount: 10, currency_code: 'USD' },
          { id: 'b', amount: 10 },
        ],
        [{ id: 'a', amount: 10 }]
      ).isComplete
    ).toBe(false))
  it('uses the selected currency precision', () => {
    expect(compare([{ id: 'a', amount: 1.001 }], [{ id: 'a', amount: 1 }], 'KWD').allMatched).toBe(
      true
    )
    expect(compare([{ id: 'a', amount: 1.1 }], [{ id: 'a', amount: 1.1 }], 'JPY').isComplete).toBe(
      false
    )
  })
})
describe('Structural differences and saved causes', () => {
  it('alerts on equal-total duplicate records', () => {
    const result = compare(
      [
        { id: 'a', amount: 5 },
        { id: 'a', amount: 5 },
      ],
      [{ id: 'a', amount: 10 }]
    )
    expect(result.allMatched).toBe(false)
    expect(reconciliationMonitorStatus(result, 100)).toBe('alert')
  })
  it('ignores invented causes and resolves only known classifications', () => {
    const input = snapshot([{ id: 'a', amount: 10 }], [{ id: 'a', amount: 5 }])
    input.causes = { a: 'invented', nonexistent: 'Duplicate row' }
    expect(recomputeInvestigation(input)).toMatchObject({
      status: 'OPEN',
      resolvedCount: 0,
      unresolvedDifference: 5,
      causes: {},
    })
    input.causes = { a: 'Fee / net vs gross' }
    expect(recomputeInvestigation(input)).toMatchObject({
      status: 'RESOLVED',
      resolvedCount: 1,
      unresolvedDifference: 0,
    })
  })
  it('requires remapping a missing amount column instead of selecting tax', () =>
    expect(resolveProfileColumns(['id', 'tax', 'payout'], 'id', 'net_amount')).toEqual({
      key: 'id',
      amount: '',
    }))
})
describe('Excel and WooCommerce imports', () => {
  it('preserves sparse rows and columns', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('Data')
    sheet.getCell('A1').value = 'id'
    sheet.getCell('D1').value = 'amount'
    sheet.getCell('A2').value = 'a'
    sheet.getCell('D2').value = 10
    sheet.getCell('A5').value = 'b'
    sheet.getCell('D5').value = 20
    expect(worksheetToRows(sheet).rows).toEqual([
      { id: 'a', 'Column 2': null, 'Column 3': null, amount: 10 },
      { id: 'b', 'Column 2': null, 'Column 3': null, amount: 20 },
    ])
  })
  it('does not overwrite naturally suffixed column names', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('Data')
    sheet.addRow(['id', 'amount', 'amount', 'amount (2)'])
    sheet.addRow(['a', 10, 20, 30])
    const result = worksheetToRows(sheet)
    expect(new Set(result.fields).size).toBe(4)
    expect(result.rows[0]).toEqual({ id: 'a', amount: 10, 'amount (3)': 20, 'amount (2)': 30 })
  })
  it('retains invalid WooCommerce totals and refunds as invalid, never zero', () => {
    expect(wooCommerceOrdersToRows([{ id: 1, total: 'invalid' }])[0].net_amount).toBeNull()
    expect(
      wooCommerceOrdersToRows([{ id: 1, total: '10', refunds: [{ total: 'invalid' }] }])[0]
        .net_amount
    ).toBeNull()
    expect(wooCommerceOrdersToRows([{ id: 1, total: '0' }])[0].net_amount).toBe(0)
  })
})
