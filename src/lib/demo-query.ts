import type { QueryResultRow } from '@/actions/db'
import { DEMO_DATA } from '@/app/dashboard/demo-data'

/**
 * Runs SQL against the sample store: picks the table the SQL names, then applies the
 * filters below. Used in the browser and when the server copies charts for sharing.
 */
export function runDemoQuery(sql: string): { rows: QueryResultRow[]; fields: string[] } {
  const sqlLower = sql.toLowerCase()
  let rows = DEMO_DATA.customers
  let fields = ['id', 'name', 'email', 'city', 'created_at']

  if (sqlLower.includes('orders')) {
    rows = DEMO_DATA.orders
    fields = ['id', 'customer_id', 'product', 'amount', 'status', 'order_date']
  } else if (sqlLower.includes('products')) {
    rows = DEMO_DATA.products
    fields = ['id', 'name', 'price', 'category', 'stock']
  }

  return { rows: applyDemoQueryFilters(rows, sql), fields }
}

/**
 * Apply the small subset of SQL filters supported by the in-browser demo database.
 * Real database connections continue to execute their SQL through the server driver.
 */
export function applyDemoQueryFilters(rows: QueryResultRow[], sql: string): QueryResultRow[] {
  const normalizedSql = sql.toLowerCase()
  let filtered = [...rows]

  const statusEquals = normalizedSql.match(/["`]?status["`]?\s*=\s*['"]([^'"]+)['"]/i)
  if (statusEquals) {
    const expected = statusEquals[1].toLowerCase()
    filtered = filtered.filter((row) => String(row.status ?? '').toLowerCase() === expected)
  } else {
    const statusIn = normalizedSql.match(/["`]?status["`]?\s+in\s*\(([^)]+)\)/i)
    if (statusIn) {
      const expected = new Set(
        Array.from(statusIn[1].matchAll(/['"]([^'"]+)['"]/g), (match) => match[1].toLowerCase())
      )
      if (expected.size > 0) {
        filtered = filtered.filter((row) => expected.has(String(row.status ?? '').toLowerCase()))
      }
    }
  }

  const limitMatch = normalizedSql.match(/\blimit\s+(\d+)/i)
  if (limitMatch) filtered = filtered.slice(0, Number.parseInt(limitMatch[1], 10))

  return filtered
}
