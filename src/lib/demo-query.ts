import type { QueryResultRow } from '@/actions/db'

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
