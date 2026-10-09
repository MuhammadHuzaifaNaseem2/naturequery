import { normalizeValue } from '../normalize'
import type { ColumnInfo } from '@shared/types'

const MAX_COLUMNS = 300

/**
 * Turns documents into table rows. Columns are the top-level fields in order
 * of first appearance; nested objects and arrays stay as structured values.
 */
export function documentsToTable(documents: Record<string, unknown>[]): {
  columns: { name: string }[]
  rows: unknown[][]
} {
  const order: string[] = []
  const seen = new Set<string>()
  for (const document of documents) {
    for (const key of Object.keys(document)) {
      if (!seen.has(key) && order.length < MAX_COLUMNS) {
        seen.add(key)
        order.push(key)
      }
    }
  }
  return {
    columns: order.map((name) => ({ name })),
    rows: documents.map((document) =>
      order.map((key) => (key in document ? normalizeValue(document[key]) : null))
    ),
  }
}

function typeName(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'
  if (typeof value === 'object') {
    const bson = (value as { _bsontype?: string })._bsontype
    if (bson) return bson === 'ObjectId' ? 'objectId' : bson.toLowerCase()
    return 'object'
  }
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double'
  return typeof value
}

/** Infers fields and their types from sample documents. */
export function inferFields(
  samples: Record<string, unknown>[],
  keyFields: string[] = []
): ColumnInfo[] {
  const types = new Map<string, Set<string>>()
  const presence = new Map<string, number>()
  for (const document of samples) {
    for (const [key, value] of Object.entries(document)) {
      if (!types.has(key)) types.set(key, new Set())
      types.get(key)!.add(typeName(value))
      presence.set(key, (presence.get(key) ?? 0) + 1)
    }
  }
  return [...types.entries()].slice(0, MAX_COLUMNS).map(([name, kinds]) => {
    const real = [...kinds].filter((kind) => kind !== 'null')
    return {
      name,
      type: real.length ? real.join(' | ') : 'null',
      nullable: kinds.has('null') || (presence.get(name) ?? 0) < samples.length,
      isPrimaryKey: keyFields.includes(name),
    }
  })
}
