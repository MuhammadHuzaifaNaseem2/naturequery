// Client-side normalization for regional date formats (DD/MM/YYYY, MM/DD/YYYY).
// Runs on parsed CSV/Excel rows BEFORE upload so the server sees ISO YYYY-MM-DD
// strings and can infer DATE/TIMESTAMP column types correctly.

const REGIONAL_DATE_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/
const REGIONAL_TS_RE =
  /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})[T ]\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?$/i

type Layout = 'dmy' | 'mdy' | 'ambiguous' | 'inconsistent' | 'not-regional'

function detectLayout(values: string[]): Layout {
  let sawRegional = false
  let firstBig = false
  let secondBig = false
  for (const v of values) {
    const m = v.match(REGIONAL_DATE_RE) || v.match(REGIONAL_TS_RE)
    if (!m) continue
    sawRegional = true
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12) firstBig = true
    if (b > 12) secondBig = true
    if (firstBig && secondBig) return 'inconsistent'
  }
  if (!sawRegional) return 'not-regional'
  if (firstBig) return 'dmy'
  if (secondBig) return 'mdy'
  return 'ambiguous' // default to DMY for ambiguous (more common globally)
}

function toIso(value: string, layout: 'dmy' | 'mdy'): string | null {
  const dateOnly = value.match(REGIONAL_DATE_RE)
  const tsMatch = value.match(REGIONAL_TS_RE)
  const m = dateOnly || tsMatch
  if (!m) return null

  const part1 = Number(m[1])
  const part2 = Number(m[2])
  const day = layout === 'dmy' ? part1 : part2
  const month = layout === 'dmy' ? part2 : part1
  let year = Number(m[3])
  if (year < 100) year += year >= 70 ? 1900 : 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (tsMatch) {
    const timePart = value.slice(value.search(/[T ]\d/) + 1)
    return `${iso} ${timePart}`
  }
  return iso
}

/**
 * Scan each column. If it's entirely regional dates, convert to ISO in place.
 * Returns the column names that were normalized (mostly for logging/debug).
 */
export function normalizeRegionalDates(
  rows: Record<string, unknown>[],
  headers: string[]
): string[] {
  const normalized: string[] = []
  for (const h of headers) {
    const values = rows
      .map((r) => r[h])
      .filter((v) => v != null && String(v).trim() !== '')
      .map((v) => String(v).trim())
    if (values.length === 0) continue

    const layout = detectLayout(values)
    if (layout === 'not-regional' || layout === 'inconsistent') continue

    const useLayout = layout === 'mdy' ? 'mdy' : 'dmy'
    let didChange = false
    for (const row of rows) {
      const v = row[h]
      if (v == null || String(v).trim() === '') continue
      const iso = toIso(String(v).trim(), useLayout)
      if (iso) {
        row[h] = iso
        didChange = true
      }
    }
    if (didChange) normalized.push(h)
  }
  return normalized
}
