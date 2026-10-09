// Converts driver values into plain, structured-clone-safe values for the UI.

const BINARY_PREVIEW_BYTES = 64

function binaryPreview(bytes: Uint8Array): string {
  const hex = Buffer.from(bytes.subarray(0, BINARY_PREVIEW_BYTES)).toString('hex')
  return bytes.length > BINARY_PREVIEW_BYTES ? `0x${hex}… (${bytes.length} bytes)` : `0x${hex}`
}

/** Formats a Date as wall-clock text without a time zone shift. */
export function formatDateTime(date: Date, utc: boolean): string {
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  const parts = utc
    ? [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
      ]
    : [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
      ]
  const [year, month, day, hour, minute, second, ms] = parts
  const time = `${pad(hour)}:${pad(minute)}:${pad(second)}${ms ? `.${pad(ms, 3)}` : ''}`
  return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${time}`
}

export function normalizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      return Number.isFinite(value) ? value : String(value)
    case 'bigint':
      return value.toString()
    case 'object':
      break
    default:
      return String(value)
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (value instanceof Uint8Array) return binaryPreview(value)
  if (value instanceof ArrayBuffer) return binaryPreview(new Uint8Array(value))
  if (depth > 8) return '[nested value]'
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item, depth + 1))

  const candidate = value as {
    _bsontype?: string
    toHexString?: () => string
    toString(): string
    toJSON?: () => unknown
  }
  // MongoDB ObjectId, Decimal128, Long and similar wrapper types.
  if (candidate._bsontype) {
    return typeof candidate.toHexString === 'function'
      ? candidate.toHexString()
      : candidate.toString()
  }
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([k, v]) => [String(k), normalizeValue(v, depth + 1)]))
  if (value instanceof Set) return [...value].map((item) => normalizeValue(item, depth + 1))

  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) {
    if (typeof candidate.toJSON === 'function') return normalizeValue(candidate.toJSON(), depth + 1)
    const text = candidate.toString()
    if (text !== '[object Object]') return text
  }
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = normalizeValue(item, depth + 1)
  }
  return output
}

export function normalizeRows(rows: unknown[][]): unknown[][] {
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) row[i] = normalizeValue(row[i])
  }
  return rows
}
