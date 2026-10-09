import type { QueryResult } from '@shared/types'

export interface TableData {
  fields: string[]
  rows: Record<string, unknown>[]
}

const NUMERIC_TYPE =
  /^(int|integer|bigint|smallint|tinyint|mediumint|int2|int4|int8|serial|bigserial|decimal|numeric|real|float|float4|float8|double|double precision|money|smallmoney|number)\b/i

/**
 * Converts a result (arrays of values) into row objects for the shared
 * table and chart components. Duplicate column names get a suffix so no
 * value is lost, and exact numeric strings become numbers when that is
 * lossless, so sorting and charts treat them as numbers.
 */
export function toTableData(result: Pick<QueryResult, 'columns' | 'rows'>): TableData {
  const seen = new Map<string, number>()
  const fields = result.columns.map((column) => {
    const count = seen.get(column.name) ?? 0
    seen.set(column.name, count + 1)
    return count === 0 ? column.name : `${column.name} (${count + 1})`
  })
  const numeric = result.columns.map((column) => !!column.type && NUMERIC_TYPE.test(column.type))
  const rows = result.rows.map((values) => {
    const row: Record<string, unknown> = {}
    fields.forEach((field, index) => {
      const value = values[index]
      row[field] = numeric[index] ? toNumberIfLossless(value) : value
    })
    return row
  })
  return { fields, rows }
}

export function toNumberIfLossless(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return value
  const digits = trimmed.replace(/^-/, '').replace('.', '').replace(/^0+/, '')
  if (digits.length > 15) return value
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : value
}

/** Tab-separated text with a header row, for pasting into spreadsheets. */
export function toTsv(fields: string[], rows: unknown[][]): string {
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return text.replace(/[\t\r\n]+/g, ' ')
  }
  return [fields.map(cell).join('\t'), ...rows.map((row) => row.map(cell).join('\t'))].join('\r\n')
}
