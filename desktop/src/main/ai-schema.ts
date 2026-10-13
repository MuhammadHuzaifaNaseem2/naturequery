import type { SchemaSnapshot, TableInfo } from '@shared/types'

/** Table description sent to the NatureQuery AI service: names, types and the allowed
 * values of enum columns (part of the table definition), never row data. */
export interface AiSchemaTable {
  name: string
  kind?: 'table' | 'view' | 'collection'
  rows?: number
  columns: { name: string; type: string; key?: boolean; nullable?: boolean; values?: string[] }[]
  references?: { column: string; table: string; tableColumn: string }[]
}

/** Most tables sent with one question; the service narrows these down further. */
export const MAX_AI_TABLES = 300
const MAX_COLUMNS = 400

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
}

/** Singular form, so "invoices" matches "invoice" and "categories" matches "category". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** Rough relevance of a table to the question, from table and column names. */
function score(table: TableInfo, terms: Set<string>): number {
  let total = 0
  for (const word of words(table.name)) if (terms.has(stem(word))) total += 5
  for (const column of table.columns) {
    for (const word of words(column.name)) if (terms.has(stem(word))) total += 1
  }
  return total + Math.min(table.foreignKeys.length, 3) * 0.2
}

/**
 * Converts a schema snapshot for the AI service. Very large schemas are cut
 * to the tables most related to the question, plus the tables they reference.
 */
export function aiSchema(snapshot: SchemaSnapshot, question: string): AiSchemaTable[] {
  let tables = snapshot.tables
  if (tables.length > MAX_AI_TABLES) {
    const terms = new Set(words(question).map(stem))
    const ranked = tables
      .map((table, index) => ({ table, index, score: score(table, terms) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, MAX_AI_TABLES - 50)
      .map((entry) => entry.table)
    const chosen = new Set(ranked.map((table) => table.qualifiedName))
    const byName = new Map(tables.map((table) => [table.qualifiedName, table]))
    for (const table of [...ranked]) {
      for (const reference of table.foreignKeys) {
        const target = byName.get(reference.referencedTable)
        if (target && !chosen.has(target.qualifiedName) && chosen.size < MAX_AI_TABLES) {
          chosen.add(target.qualifiedName)
          ranked.push(target)
        }
      }
    }
    tables = ranked
  }
  return tables.map((table) => ({
    name: table.qualifiedName,
    kind: table.kind,
    rows:
      typeof table.rowEstimate === 'number' && table.rowEstimate >= 0
        ? Math.round(table.rowEstimate)
        : undefined,
    columns: table.columns.slice(0, MAX_COLUMNS).map((column) => ({
      name: column.name,
      type: column.type.slice(0, 200),
      key: column.isPrimaryKey || undefined,
      nullable: column.nullable,
      values: column.values?.length
        ? column.values.slice(0, 100).map((value) => value.slice(0, 200))
        : undefined,
    })),
    references: table.foreignKeys.length
      ? table.foreignKeys.slice(0, 100).map((reference) => ({
          column: reference.column,
          table: reference.referencedTable,
          tableColumn: reference.referencedColumn,
        }))
      : undefined,
  }))
}

/** Result rows for an AI summary: at most 50, with long values shortened. */
export function sampleRows(rows: unknown[][], limit = 50): unknown[][] {
  return rows.slice(0, limit).map((row) =>
    row.slice(0, 300).map((value) => {
      if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value
      if (value !== null && typeof value === 'object') {
        const text = JSON.stringify(value)
        return text.length > 200 ? `${text.slice(0, 200)}…` : value
      }
      return value
    })
  )
}
