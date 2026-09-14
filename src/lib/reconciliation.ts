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
  validationErrors: string[]
  isComplete: boolean
  allMatched: boolean
  grossDifference: number
  minorUnit: number
}

interface ReconcileOptions {
  sourceRows: ReconciliationRow[]
  comparisonRows: ReconciliationRow[]
  sourceKey: string
  sourceAmount: string
  comparisonKey: string
  comparisonAmount: string
  tolerance?: number
  currency?: string
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
  const unsigned = negative ? trimmed.slice(1, -1).trim() : trimmed
  // Commas must be thousands separators; never reinterpret decimal-comma exports.
  const normalized = unsigned.replace(/^([+-]?)[$\u00a3\u20ac\u00a5]\s*/, '$1')
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+|\d*\.\d+)(?:\.\d+)?$/.test(normalized)) return null
  if (negative && /^[+-]/.test(normalized)) return null
  const amount = Number(normalized.replace(/,/g, ''))
  if (!Number.isFinite(amount)) return null
  return negative ? -amount : amount
}

function aggregateRows(
  rows: ReconciliationRow[],
  keyColumn: string,
  amountColumn: string,
  scale: number
): { values: Map<string, Aggregate>; invalidRows: number } {
  const values = new Map<string, Aggregate>()
  let invalidRows = 0

  for (const row of rows) {
    const rawKey = row[keyColumn]
    const key = rawKey == null ? '' : String(rawKey).trim()
    const amount = parseReconciliationAmount(row[amountColumn])

    const units = amount === null ? NaN : amount * scale
    const rounded = Math.round(units)
    if (
      !key ||
      amount === null ||
      !Number.isSafeInteger(rounded) ||
      Math.abs(units - rounded) > Math.max(1e-7, Math.abs(units) * Number.EPSILON * 2)
    ) {
      invalidRows += 1
      continue
    }

    const current = values.get(key) ?? { amount: 0, count: 0 }
    if (!Number.isSafeInteger(current.amount + rounded)) {
      invalidRows += 1
      continue
    }
    values.set(key, { amount: current.amount + rounded, count: current.count + 1 })
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
  tolerance,
  currency,
}: ReconcileOptions): ReconciliationResult {
  const validationErrors: string[] = []
  const currencies = new Set<string>()
  for (const [label, rows] of [
    ['Report A', sourceRows],
    ['Report B', comparisonRows],
  ] as const) {
    if (!rows.length)
      validationErrors.push(`${label} has no rows. Import a report before comparing.`)
    const currencyColumns = new Set(
      rows.flatMap((row) =>
        Object.keys(row).filter((key) => /^(currency|currency_code)$/i.test(key))
      )
    )
    for (const row of rows) {
      for (const column of currencyColumns) {
        const value = String(row[column] ?? '')
          .trim()
          .toUpperCase()
        if (!/^[A-Z]{3}$/.test(value)) {
          validationErrors.push(`${label} contains a missing or invalid currency code.`)
        } else currencies.add(value)
      }
    }
  }
  const selectedCurrency = currency?.trim().toUpperCase()
  if (currency !== undefined && !/^[A-Z]{3}$/.test(selectedCurrency || ''))
    validationErrors.push('Use a three-letter currency code.')
  if (
    currencies.size > 1 ||
    (selectedCurrency && [...currencies].some((code) => code !== selectedCurrency))
  ) {
    validationErrors.push(
      'Currency mismatch: compare reports in the same currency. No currency conversion is performed.'
    )
  }
  let digits = 2
  try {
    digits =
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: selectedCurrency || [...currencies][0] || 'USD',
      }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    validationErrors.push('Invalid currency.')
  }

  // A visible money symbol must agree with the chosen currency, even without a currency column.
  const effectiveCurrency = selectedCurrency || [...currencies][0] || 'USD'
  let expectedSymbol = ''
  try {
    expectedSymbol =
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: effectiveCurrency,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value || ''
  } catch {
    /* Invalid currency is already reported above. */
  }
  for (const [rows, amountColumn] of [
    [sourceRows, sourceAmount],
    [comparisonRows, comparisonAmount],
  ] as const) {
    if (
      rows.some(
        (row) =>
          typeof row[amountColumn] === 'string' &&
          /[$\u00a3\u20ac\u00a5]/.test(String(row[amountColumn])) &&
          String(row[amountColumn]).match(/[$\u00a3\u20ac\u00a5]/)?.[0] !== expectedSymbol
      )
    ) {
      validationErrors.push(
        'An amount currency symbol differs from the selected currency. Check both reports and the currency setting.'
      )
    }
  }
  const scale = 10 ** digits
  const minorUnit = 1 / scale
  const toleranceUnits = Math.round((tolerance ?? minorUnit) * scale)
  if (!Number.isSafeInteger(toleranceUnits) || toleranceUnits < 0)
    validationErrors.push('Tolerance must be finite and non-negative.')
  if (!sourceKey || !sourceAmount || !comparisonKey || !comparisonAmount)
    validationErrors.push('Select the record ID and amount columns for both reports.')
  const source = aggregateRows(sourceRows, sourceKey, sourceAmount, scale)
  const comparison = aggregateRows(comparisonRows, comparisonKey, comparisonAmount, scale)
  if (source.invalidRows || comparison.invalidRows)
    validationErrors.push(
      `${source.invalidRows} invalid row(s) in Report A and ${comparison.invalidRows} in Report B. Check IDs, amounts, and currency decimal precision. Totals are incomplete.`
    )
  const keys = new Set([...source.values.keys(), ...comparison.values.keys()])

  const items = [...keys].map((key): ReconciliationItem => {
    const left = source.values.get(key)
    const right = comparison.values.get(key)
    const sourceValue = left?.amount ?? 0
    const comparisonValue = right?.amount ?? 0
    const differenceUnits = sourceValue - comparisonValue
    if (!Number.isSafeInteger(differenceUnits))
      validationErrors.push('A record difference exceeds the supported safe precision.')
    const difference = differenceUnits / scale

    let status: ReconciliationStatus
    if ((left?.count ?? 0) > 1 || (right?.count ?? 0) > 1) status = 'duplicate_key'
    else if (!left) status = 'only_in_comparison'
    else if (!right) status = 'only_in_source'
    else if (Math.abs(differenceUnits) <= toleranceUnits) status = 'matched'
    else status = 'amount_mismatch'

    return {
      key,
      sourceAmount: sourceValue / scale,
      comparisonAmount: comparisonValue / scale,
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

  const total = (values: Map<string, Aggregate>) =>
    [...values.values()].reduce((sum, row) => {
      const next = sum + row.amount
      if (!Number.isSafeInteger(next))
        validationErrors.push('Amounts exceed the supported safe precision.')
      return next
    }, 0)
  const sourceTotal = total(source.values)
  const comparisonTotal = total(comparison.values)

  if (![sourceTotal, comparisonTotal, sourceTotal - comparisonTotal].every(Number.isSafeInteger))
    validationErrors.push('Amounts exceed the supported safe precision.')
  const issueCount = items.filter((item) => item.status !== 'matched').length
  const grossUnits = items
    .filter((item) => item.status !== 'matched')
    .reduce((sum, item) => sum + Math.abs(Math.round(item.difference * scale)), 0)
  if (!Number.isSafeInteger(grossUnits))
    validationErrors.push('Discrepancies exceed the supported safe precision.')
  const isComplete = validationErrors.length === 0
  return {
    validationErrors: [...new Set(validationErrors)],
    isComplete,
    allMatched: isComplete && issueCount === 0,
    grossDifference: grossUnits / scale,
    minorUnit,
    sourceTotal: sourceTotal / scale,
    comparisonTotal: comparisonTotal / scale,
    difference: (sourceTotal - comparisonTotal) / scale,
    matchedCount: isComplete ? items.filter((item) => item.status === 'matched').length : 0,
    issueCount: items.filter((item) => item.status !== 'matched').length,
    invalidSourceRows: source.invalidRows,
    invalidComparisonRows: comparison.invalidRows,
    items,
  }
}
