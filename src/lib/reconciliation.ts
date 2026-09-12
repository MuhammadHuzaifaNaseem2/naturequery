export type ReconciliationValue = string | number | boolean | null | undefined

export type ReconciliationRow = Record<string, ReconciliationValue>

export type ReconciliationStatus =
  | 'matched'
  | 'amount_mismatch'
  | 'only_in_source'
  | 'only_in_comparison'
  | 'duplicate_key'

export interface ReconciliationItem {
  key: string
  sourceAmount: number
  comparisonAmount: number
  difference: number
  sourceCount: number
  comparisonCount: number
  status: ReconciliationStatus
}

export interface ReconciliationResult {
  sourceTotal: number
  comparisonTotal: number
  difference: number
  matchedCount: number
  issueCount: number
  invalidSourceRows: number
  invalidComparisonRows: number
  items: ReconciliationItem[]
}

interface ReconcileOptions {
  sourceRows: ReconciliationRow[]
  comparisonRows: ReconciliationRow[]
  sourceKey: string
  sourceAmount: string
  comparisonKey: string
  comparisonAmount: string
  tolerance?: number
}

interface Aggregate {
  amount: number
  count: number
}

export function parseReconciliationAmount(value: ReconciliationValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const negative = /^\(.*\)$/.test(trimmed)
  const normalized = trimmed.replace(/[,$£€¥\s()]/g, '')
  if (!normalized || !/^[+-]?\d*\.?\d+$/.test(normalized)) return null

  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return negative ? -Math.abs(amount) : amount
}

function aggregateRows(
  rows: ReconciliationRow[],
  keyColumn: string,
  amountColumn: string
): { values: Map<string, Aggregate>; invalidRows: number } {
  const values = new Map<string, Aggregate>()
  let invalidRows = 0

  for (const row of rows) {
    const rawKey = row[keyColumn]
    const key = rawKey == null ? '' : String(rawKey).trim()
    const amount = parseReconciliationAmount(row[amountColumn])

    if (!key || amount === null) {
      invalidRows += 1
      continue
    }

    const current = values.get(key) ?? { amount: 0, count: 0 }
    values.set(key, { amount: current.amount + amount, count: current.count + 1 })
  }

  return { values, invalidRows }
}

export function reconcileReports({
  sourceRows,
  comparisonRows,
  sourceKey,
  sourceAmount,
  comparisonKey,
  comparisonAmount,
  tolerance = 0.01,
}: ReconcileOptions): ReconciliationResult {
  const source = aggregateRows(sourceRows, sourceKey, sourceAmount)
  const comparison = aggregateRows(comparisonRows, comparisonKey, comparisonAmount)
  const keys = new Set([...source.values.keys(), ...comparison.values.keys()])

  const items = [...keys].map((key): ReconciliationItem => {
    const left = source.values.get(key)
    const right = comparison.values.get(key)
    const sourceValue = left?.amount ?? 0
    const comparisonValue = right?.amount ?? 0
    const difference = sourceValue - comparisonValue

    let status: ReconciliationStatus
    if ((left?.count ?? 0) > 1 || (right?.count ?? 0) > 1) status = 'duplicate_key'
    else if (!left) status = 'only_in_comparison'
    else if (!right) status = 'only_in_source'
    else if (Math.abs(difference) <= tolerance) status = 'matched'
    else status = 'amount_mismatch'

    return {
      key,
      sourceAmount: sourceValue,
      comparisonAmount: comparisonValue,
      difference,
      sourceCount: left?.count ?? 0,
      comparisonCount: right?.count ?? 0,
      status,
    }
  })

  items.sort((a, b) => {
    if (a.status === 'matched' && b.status !== 'matched') return 1
    if (a.status !== 'matched' && b.status === 'matched') return -1
    return Math.abs(b.difference) - Math.abs(a.difference) || a.key.localeCompare(b.key)
  })

  const sourceTotal = [...source.values.values()].reduce((sum, row) => sum + row.amount, 0)
  const comparisonTotal = [...comparison.values.values()].reduce((sum, row) => sum + row.amount, 0)

  return {
    sourceTotal,
    comparisonTotal,
    difference: sourceTotal - comparisonTotal,
    matchedCount: items.filter((item) => item.status === 'matched').length,
    issueCount: items.filter((item) => item.status !== 'matched').length,
    invalidSourceRows: source.invalidRows,
    invalidComparisonRows: comparison.invalidRows,
    items,
  }
}
