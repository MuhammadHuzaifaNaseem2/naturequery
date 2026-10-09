import { createClient, type Client, type Row } from '@libsql/client/web'
import { NqError } from '@shared/errors'
import { applyRowLimit, assertReadOnlySql } from '../safety/sql'
import { normalizeRows } from '../normalize'
import {
  buildTables,
  quoteIdentifier,
  withDeadline,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const CATALOG_COLUMNS = `
  SELECT m.name AS "table", CASE WHEN m.type = 'view' THEN 'view' ELSE 'table' END AS kind,
         p.name AS "column", COALESCE(NULLIF(p.type, ''), 'ANY') AS type,
         p."notnull" = 0 AS nullable, p.pk > 0 AS isPrimaryKey
  FROM sqlite_schema m JOIN pragma_table_xinfo(m.name) p
  WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND m.name NOT LIKE '\\_litestream%' ESCAPE '\\'
  ORDER BY m.name, p.cid`

const CATALOG_FOREIGN_KEYS = `
  SELECT m.name AS "table", f."from" AS "column", f."table" AS referencedTable, f."to" AS referencedColumn
  FROM sqlite_schema m JOIN pragma_foreign_key_list(m.name) f WHERE m.type = 'table'`

/** Integers arrive as bigint so large ones stay exact; small ones become numbers. */
function plainValue(value: unknown): unknown {
  if (typeof value !== 'bigint') return value
  const safe = value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
  return safe ? Number(value) : value.toString()
}

function rowArray(row: Row, width: number): unknown[] {
  return Array.from({ length: width }, (_, index) => plainValue(row[index]))
}

/** Turso and other libSQL servers, over HTTPS. */
export const createLibsqlDriver: DriverFactory = (config, secrets) => {
  const url = config.turso?.url
  if (!url) throw new NqError('VALIDATION', 'Enter the database URL.')
  const client: Client = createClient({
    url,
    authToken: secrets.authToken || undefined,
    // The default "number" mode throws on integers above 2^53.
    intMode: 'bigint',
  })
  const canceled = new Set<string>()

  async function objects<T>(sql: string): Promise<T[]> {
    const result = await client.execute(sql)
    return result.rows.map((row) =>
      Object.fromEntries(result.columns.map((name, index) => [name, plainValue(row[index])]))
    ) as T[]
  }

  const driver: Driver = {
    async test() {
      const [row] = await objects<{ version: string }>('SELECT sqlite_version() AS version')
      return { serverVersion: `libSQL (SQLite ${row?.version ?? ''})`.trim() }
    },

    async schema() {
      const columns = await objects<
        Omit<CatalogColumnRow, 'nullable' | 'isPrimaryKey'> & {
          nullable: number
          isPrimaryKey: number
        }
      >(CATALOG_COLUMNS)
      let foreignKeys: CatalogForeignKeyRow[] = []
      try {
        foreignKeys = await objects<CatalogForeignKeyRow>(CATALOG_FOREIGN_KEYS)
      } catch {
        foreignKeys = []
      }
      const tables = buildTables(
        columns.map((column) => ({
          ...column,
          nullable: !!Number(column.nullable),
          isPrimaryKey: !!Number(column.isPrimaryKey),
        })),
        foreignKeys,
        (_schema, table) => quoteIdentifier(table, 'double')
      )
      const truncated = tables.length > SCHEMA_TABLE_LIMIT
      return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
    },

    async query(text, options) {
      assertReadOnlySql(text, 'sqlite')
      const statement = applyRowLimit(text, options.rowLimit + 1, 'sqlite')
      canceled.delete(options.queryId)
      const work = async () => {
        const transaction = await client.transaction('read')
        try {
          return await transaction.execute(statement)
        } finally {
          transaction.close()
        }
      }
      const result = await withDeadline(work(), options.timeoutMs, 'timeout').catch((error) => {
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
        if ((error as Error).message === 'timeout') {
          throw new NqError(
            'TIMEOUT',
            `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
            {
              hint: 'Add filters or a LIMIT to make it faster, or raise the time limit in Settings.',
            }
          )
        }
        throw error
      })
      if (canceled.delete(options.queryId)) throw new NqError('CANCELED', 'The query was canceled.')
      const rows = result.rows.map((row) => rowArray(row, result.columns.length))
      const truncated = rows.length > options.rowLimit
      if (truncated) rows.length = options.rowLimit
      return {
        columns: result.columns.map((name, index) => ({
          name,
          type: result.columnTypes[index]?.toLowerCase() || undefined,
        })),
        rows: normalizeRows(rows),
        truncated,
        executedText: statement,
      }
    },

    async cancel(queryId) {
      // libSQL over HTTP cannot interrupt a statement; the result is discarded.
      canceled.add(queryId)
    },

    async close() {
      client.close()
    },
  }
  return driver
}
