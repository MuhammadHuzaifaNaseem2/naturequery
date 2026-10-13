import type { ColumnInfo, ForeignKeyInfo, TableInfo } from '@shared/types'

export const APP_NAME = 'NatureQuery Desktop'

/** Quote an identifier only when needed, using the dialect's quote style. */
export function quoteIdentifier(
  name: string,
  style: 'double' | 'backtick' | 'bracket',
  options: { foldsToLower?: boolean; foldsToUpper?: boolean } = {}
): string {
  const simple = /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)
  const caseOk = options.foldsToLower
    ? name === name.toLowerCase()
    : options.foldsToUpper
      ? name === name.toUpperCase()
      : true
  if (simple && caseOk && !RESERVED.has(name.toUpperCase())) return name
  if (style === 'backtick') return `\`${name.replaceAll('`', '``')}\``
  if (style === 'bracket') return `[${name.replaceAll(']', ']]')}]`
  return `"${name.replaceAll('"', '""')}"`
}

const RESERVED = new Set([
  'ALL',
  'AND',
  'ANY',
  'AS',
  'ASC',
  'BETWEEN',
  'BY',
  'CASE',
  'CAST',
  'CHECK',
  'COLUMN',
  'CONSTRAINT',
  'CREATE',
  'CROSS',
  'CURRENT',
  'DEFAULT',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'ELSE',
  'END',
  'EXCEPT',
  'EXISTS',
  'FALSE',
  'FETCH',
  'FOR',
  'FOREIGN',
  'FROM',
  'FULL',
  'GRANT',
  'GROUP',
  'HAVING',
  'IN',
  'INNER',
  'INSERT',
  'INTERSECT',
  'INTO',
  'IS',
  'JOIN',
  'KEY',
  'LEFT',
  'LIKE',
  'LIMIT',
  'NOT',
  'NULL',
  'OFFSET',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'PRIMARY',
  'REFERENCES',
  'RIGHT',
  'SELECT',
  'SET',
  'TABLE',
  'THEN',
  'TO',
  'TRUE',
  'UNION',
  'UNIQUE',
  'UPDATE',
  'USER',
  'USING',
  'VALUES',
  'VIEW',
  'WHEN',
  'WHERE',
  'WITH',
  'ORDER',
  'GROUP',
  'RANGE',
  'ROWS',
  'WINDOW',
  'OVER',
  'PARTITION',
  'INDEX',
  'DATE',
])

export interface CatalogColumnRow {
  schema?: string | null
  table: string
  kind: 'table' | 'view' | 'collection'
  column: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  defaultValue?: string | null
  rowEstimate?: number | null
  values?: string[] | null
}

export interface CatalogForeignKeyRow {
  schema?: string | null
  table: string
  column: string
  referencedSchema?: string | null
  referencedTable: string
  referencedColumn: string
}

/** Groups catalog rows into tables with columns and foreign keys. */
export function buildTables(
  columns: CatalogColumnRow[],
  foreignKeys: CatalogForeignKeyRow[],
  qualify: (schema: string | null | undefined, table: string) => string,
  displayTable: (schema: string | null | undefined, table: string) => string = qualify
): TableInfo[] {
  const tables = new Map<string, TableInfo>()
  const key = (schema: string | null | undefined, table: string) => `${schema ?? ''}\u0000${table}`
  for (const row of columns) {
    const id = key(row.schema, row.table)
    let table = tables.get(id)
    if (!table) {
      table = {
        schema: row.schema ?? undefined,
        name: row.table,
        kind: row.kind,
        columns: [],
        foreignKeys: [],
        qualifiedName: qualify(row.schema, row.table),
        rowEstimate:
          row.rowEstimate !== null && row.rowEstimate !== undefined && Number(row.rowEstimate) >= 0
            ? Number(row.rowEstimate)
            : undefined,
      }
      tables.set(id, table)
    }
    const column: ColumnInfo = {
      name: row.column,
      type: row.type,
      nullable: !!row.nullable,
      isPrimaryKey: !!row.isPrimaryKey,
      defaultValue: row.defaultValue ?? null,
      ...(row.values?.length ? { values: row.values } : {}),
    }
    table.columns.push(column)
  }
  for (const fk of foreignKeys) {
    const table = tables.get(key(fk.schema, fk.table))
    if (!table) continue
    const reference: ForeignKeyInfo = {
      column: fk.column,
      referencedTable: displayTable(fk.referencedSchema, fk.referencedTable),
      referencedColumn: fk.referencedColumn,
    }
    table.foreignKeys.push(reference)
  }
  return [...tables.values()]
}

type ExactReviver = (key: string, value: unknown, context?: { source?: string }) => unknown

/**
 * Parses JSON without losing precision: numbers a JavaScript number cannot
 * hold exactly (large integers, or decimals such as 1235.50) keep their
 * original text. Small numbers stay numbers.
 */
export function parseJsonExact(text: string): unknown {
  const reviver: ExactReviver = (_key, value, context) =>
    typeof value === 'number' && context?.source !== undefined && String(value) !== context.source
      ? context.source
      : value
  return JSON.parse(text, reviver as (key: string, value: unknown) => unknown)
}

/** Runs an operation with a deadline, rejecting with a timeout error. */
export async function withDeadline<T>(
  operation: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error(message), { code: 'ETIMEDOUT' })),
          ms
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Short server description from a version banner, e.g. "PostgreSQL 16.4". */
export function shortVersion(banner: string | undefined | null, max = 60): string | undefined {
  if (!banner) return undefined
  const firstLine = String(banner).split('\n')[0].trim()
  return firstLine.length > max ? `${firstLine.slice(0, max)}…` : firstLine
}
