import type { QueryResultRow } from '@/actions/db'

/** A copy of a widget's results, stored so a shared dashboard can draw its chart. */
export interface ChartSnapshot {
  fields: string[]
  rows: Record<string, string | number | boolean | null>[]
}

// ResultsChart draws at most the first 100 rows, so a shared copy never needs more.
export const SNAPSHOT_MAX_ROWS = 100
const MAX_FIELDS = 20
const MAX_TEXT = 300
const MAX_BYTES = 512 * 1024

/** Turns query results into plain JSON, keeping only what the chart can show. */
export function toChartSnapshot(rows: QueryResultRow[], fields: string[]): ChartSnapshot {
  const kept = fields.slice(0, MAX_FIELDS)
  const snapshot: ChartSnapshot = {
    fields: kept,
    rows: rows.slice(0, SNAPSHOT_MAX_ROWS).map((row) => {
      const out: ChartSnapshot['rows'][number] = {}
      for (const field of kept) out[field] = toJsonValue(row[field])
      return out
    }),
  }
  // Very wide text columns could still make a large copy; drop rows from the end.
  while (snapshot.rows.length > 1 && JSON.stringify(snapshot).length > MAX_BYTES) {
    snapshot.rows = snapshot.rows.slice(0, Math.floor(snapshot.rows.length / 2))
  }
  return snapshot
}

/** Reads a stored snapshot back, or null when it is missing or not in this shape. */
export function readChartSnapshot(value: unknown): ChartSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const { fields, rows } = value as { fields?: unknown; rows?: unknown }
  if (!Array.isArray(fields) || !Array.isArray(rows)) return null
  if (!fields.every((field) => typeof field === 'string')) return null
  return {
    fields,
    rows: rows.filter(
      (row): row is ChartSnapshot['rows'][number] => !!row && typeof row === 'object'
    ),
  }
}

function toJsonValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString()
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'string') return value.slice(0, MAX_TEXT)
  if (value instanceof Uint8Array) return null
  try {
    return (JSON.stringify(value) ?? '').slice(0, MAX_TEXT)
  } catch {
    return String(value).slice(0, MAX_TEXT)
  }
}
