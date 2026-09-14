import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { resolveProfileColumns } from '@/lib/reconciliation-profile'
import { parseXlsxBuffer } from '@/lib/spreadsheet-import'

describe('resolveProfileColumns', () => {
  it('reuses saved columns and requires remapping when a header changed', () => {
    expect(resolveProfileColumns(['order_id', 'gross', 'net'], 'order_id', 'net')).toEqual({
      key: 'order_id',
      amount: 'net',
    })
    expect(resolveProfileColumns(['reference', 'total'], 'order_id', 'net')).toEqual({
      key: '',
      amount: '',
    })
  })
})

describe('parseXlsxBuffer', () => {
  it('reads the first worksheet, formulas, dates, and duplicate headers', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Revenue')
    worksheet.addRow(['order_id', 'amount', 'amount', 'paid_at'])
    worksheet.addRow(['ORD-1', 40, { formula: '20+22', result: 42 }, new Date('2026-09-01')])
    worksheet.addRow([])
    const buffer = await workbook.xlsx.writeBuffer()

    const result = await parseXlsxBuffer(buffer as ArrayBuffer)

    expect(result.sheetName).toBe('Revenue')
    expect(result.fields).toEqual(['order_id', 'amount', 'amount (2)', 'paid_at'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      order_id: 'ORD-1',
      amount: 40,
      'amount (2)': 42,
      paid_at: '2026-09-01T00:00:00.000Z',
    })
  })
})
