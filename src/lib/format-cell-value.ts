/**
 * Smart cell-value formatting for the results table.
 * Only used for DISPLAY — exports always receive raw values.
 *
 * classifyColumn() uses the field name to pick a formatting strategy:
 *   id        → raw (no separators)
 *   currency  → $1,234.56
 *   count     → 1,234  (integer, no currency symbol)
 *   percent   → 12.50%
 *   default   → locale integer for ≥10 000, 2-dp decimal otherwise
 */

// Tokens that indicate a money column when found in a field name.
// "total" is NOT here — it's ambiguous (total_products vs total_revenue).
const CURRENCY_TOKENS = new Set([
  'revenue',
  'amount',
  'price',
  'cost',
  'salary',
  'fee',
  'balance',
  'earnings',
  'income',
  'budget',
  'payment',
  'charge',
  'spend',
  'spent',
  'discount',
  'subtotal',
  'cash',
  'value',
])

// Tokens that indicate a count / quantity column.
const COUNT_TOKENS = new Set([
  'count',
  'quantity',
  'qty',
  'stock',
  'inventory',
  'items',
  'orders',
  'users',
  'customers',
  'products',
  'records',
  'entries',
  'rows',
  'transactions',
  'num',
  'number',
])

const PERCENT_TOKENS = new Set(['percent', 'pct', 'ratio', 'rate'])

export type ColumnKind = 'id' | 'currency' | 'count' | 'percent' | 'default'

/**
 * Classify a column by name into a formatting category.
 * Priority: id → percent → currency → count → default
 */
export function classifyColumn(field: string): ColumnKind {
  const lf = field.toLowerCase()

  // ID: exactly "id" or any field ending in "_id"
  if (lf === 'id' || lf.endsWith('_id')) return 'id'

  const words = lf.split(/[_\s]+/).filter(Boolean)

  // Percentage
  if (words.some((w) => PERCENT_TOKENS.has(w))) return 'percent'

  // Currency: any word is a known money noun
  if (words.some((w) => CURRENCY_TOKENS.has(w))) return 'currency'
  // "total" or "grand_total" / "order_total" endings are also currency
  if (lf === 'total' || lf.endsWith('_total')) return 'currency'

  // Count: any word is a known quantity noun, or field starts with total_/num_
  // (total_ without a currency word landed here, so it's a count-style total)
  if (words.some((w) => COUNT_TOKENS.has(w))) return 'count'
  if (/^(total|num)_/.test(lf)) return 'count'

  return 'default'
}

// Reusable formatters — created once for performance
const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const DEC2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatDateValue(d: Date, hasTime = false): string {
  if (hasTime && (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0)) {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Format a single cell value for display.
 * @param value  The raw database value
 * @param field  The column name (used for classification)
 */
export function formatCellValue(value: unknown, field?: string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') {
    if (value instanceof Date) return formatDateValue(value)
    return JSON.stringify(value)
  }

  // ISO date strings from PostgreSQL (e.g. "2025-01-15" or "2025-01-15T10:30:00.000Z")
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) return formatDateValue(d, value.includes('T'))
    }
  }

  // Resolve to a JS number — pg returns NUMERIC/DECIMAL/BIGINT as strings
  const numericValue: number | null =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && isFinite(Number(value))
        ? Number(value)
        : null

  if (numericValue !== null) {
    const kind = field ? classifyColumn(field) : 'default'
    switch (kind) {
      case 'id':
        return String(value)
      case 'currency':
        return USD.format(numericValue)
      case 'count':
        return INT.format(Math.round(numericValue))
      case 'percent': {
        // Treat values ≤ 1 as ratios (0.155 → 15.50%), values > 1 as already-percent (45 → 45.00%)
        const pct = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue
        return `${DEC2.format(pct)}%`
      }
      case 'default':
        // Show whole numbers without decimals regardless of whether value arrived as string or number
        if (Number.isInteger(numericValue)) {
          return Math.abs(numericValue) >= 10000 ? INT.format(numericValue) : String(numericValue)
        }
        return DEC2.format(numericValue)
    }
  }

  return String(value)
}
