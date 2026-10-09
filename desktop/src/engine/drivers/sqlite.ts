import { Worker } from 'node:worker_threads'
import { NqError } from '@shared/errors'
import { assertReadOnlySql } from '../safety/sql'
import { normalizeRows } from '../normalize'
import {
  buildTables,
  quoteIdentifier,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

// SQLite runs synchronously, so each connection gets its own worker thread.
// A slow query never blocks other connections, and canceling simply stops
// the worker. The source is inlined so it also loads from the app archive.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { DatabaseSync } = require('node:sqlite')
let db = null
function open() {
  if (!db) {
    db = new DatabaseSync(workerData.path, { readOnly: true })
    db.exec('PRAGMA busy_timeout = 5000')
  }
  return db
}
parentPort.on('message', (message) => {
  try {
    const database = open()
    const statement = database.prepare(message.sql)
    if (message.kind === 'rows') {
      statement.setReturnArrays(true)
      const columns = statement.columns().map((c) => ({ name: c.name, type: c.type || undefined }))
      const rows = []
      let truncated = false
      for (const row of statement.iterate(...(message.params || []))) {
        if (rows.length >= message.limit) { truncated = true; break }
        rows.push(row)
      }
      parentPort.postMessage({ id: message.id, ok: true, value: { columns, rows, truncated } })
    } else {
      parentPort.postMessage({ id: message.id, ok: true, value: statement.all(...(message.params || [])) })
    }
  } catch (error) {
    parentPort.postMessage({ id: message.id, ok: false, error: { message: String(error && error.message || error), code: error && error.code } })
  }
})
`

interface WorkerReply {
  id: number
  ok: boolean
  value?: unknown
  error?: { message: string; code?: string }
}

const CATALOG_COLUMNS = `
  SELECT m.name AS "table", CASE WHEN m.type = 'view' THEN 'view' ELSE 'table' END AS kind,
         p.name AS "column", COALESCE(NULLIF(p.type, ''), 'ANY') AS type,
         p."notnull" = 0 AS nullable, p.pk > 0 AS isPrimaryKey, p.dflt_value AS defaultValue
  FROM sqlite_schema m
  JOIN pragma_table_xinfo(m.name) p
  WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
  ORDER BY m.name, p.cid`

const CATALOG_FOREIGN_KEYS = `
  SELECT m.name AS "table", f."from" AS "column", f."table" AS referencedTable, f."to" AS referencedColumn
  FROM sqlite_schema m
  JOIN pragma_foreign_key_list(m.name) f
  WHERE m.type = 'table'`

export const createSqliteDriver: DriverFactory = (config) => {
  const file = config.sqlite?.path
  if (!file) throw new NqError('VALIDATION', 'Choose a SQLite database file.')

  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >()
  const running = new Map<string, () => void>()

  function getWorker(): Worker {
    if (worker) return worker
    const created = new Worker(WORKER_SOURCE, { eval: true, workerData: { path: file } })
    created.on('message', (reply: WorkerReply) => {
      const entry = pending.get(reply.id)
      if (!entry) return
      pending.delete(reply.id)
      if (reply.ok) entry.resolve(reply.value)
      else entry.reject(Object.assign(new Error(reply.error?.message), { code: reply.error?.code }))
    })
    const failAll = (error: unknown) => {
      for (const entry of pending.values()) entry.reject(error)
      pending.clear()
      if (worker === created) worker = null
    }
    created.on('error', failAll)
    created.on('exit', () => failAll(new NqError('CANCELED', 'The query was canceled.')))
    worker = created
    return created
  }

  function stopWorker(reason: unknown) {
    const current = worker
    worker = null
    for (const entry of pending.values()) entry.reject(reason)
    pending.clear()
    void current?.terminate()
  }

  function call<T>(message: Record<string, unknown>): Promise<T> {
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      getWorker().postMessage({ ...message, id })
    })
  }

  function qualify(_schema: string | null | undefined, table: string): string {
    return quoteIdentifier(table, 'double')
  }

  const driver: Driver = {
    async test() {
      const rows = await call<{ version: string }[]>({
        kind: 'all',
        sql: 'SELECT sqlite_version() AS version',
      })
      return { serverVersion: `SQLite ${rows[0]?.version ?? ''}`.trim() }
    },

    async schema() {
      // SQLite returns booleans as 0 or 1.
      type SqliteColumnRow = Omit<CatalogColumnRow, 'nullable' | 'isPrimaryKey'> & {
        nullable: number
        isPrimaryKey: number
      }
      const columns = await call<SqliteColumnRow[]>({
        kind: 'all',
        sql: CATALOG_COLUMNS,
      })
      let foreignKeys: CatalogForeignKeyRow[] = []
      try {
        foreignKeys = await call<CatalogForeignKeyRow[]>({ kind: 'all', sql: CATALOG_FOREIGN_KEYS })
      } catch {
        foreignKeys = []
      }
      // A foreign key without a target column refers to the parent's primary key.
      const primaryKeys = new Map<string, string>()
      for (const column of columns)
        if (column.isPrimaryKey) primaryKeys.set(column.table, column.column)
      for (const fk of foreignKeys) {
        fk.referencedColumn ||= primaryKeys.get(fk.referencedTable) ?? 'rowid'
      }
      const tables = buildTables(
        columns.map((column) => ({
          ...column,
          nullable: !!column.nullable,
          isPrimaryKey: !!column.isPrimaryKey,
        })),
        foreignKeys,
        qualify
      )
      const truncated = tables.length > SCHEMA_TABLE_LIMIT
      return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
    },

    async query(text, options) {
      assertReadOnlySql(text, 'sqlite')
      let timedOut = false
      let canceled = false
      const timer = setTimeout(
        () => {
          timedOut = true
          stopWorker(new Error('timeout'))
        },
        Math.max(1000, options.timeoutMs)
      )
      running.set(options.queryId, () => {
        canceled = true
        stopWorker(new Error('canceled'))
      })
      try {
        const result = await call<{
          columns: { name: string; type?: string }[]
          rows: unknown[][]
          truncated: boolean
        }>({
          kind: 'rows',
          sql: text,
          limit: options.rowLimit,
        })
        return {
          columns: result.columns,
          rows: normalizeRows(result.rows),
          truncated: result.truncated,
          executedText: text,
        }
      } catch (error) {
        if (canceled) throw new NqError('CANCELED', 'The query was canceled.')
        if (timedOut) {
          throw new NqError(
            'TIMEOUT',
            `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
            {
              hint: 'Add filters or a LIMIT to make it faster, or raise the time limit in Settings.',
            }
          )
        }
        throw error
      } finally {
        clearTimeout(timer)
        running.delete(options.queryId)
      }
    },

    async cancel(queryId) {
      running.get(queryId)?.()
    },

    async close() {
      const current = worker
      worker = null
      await current?.terminate()
    },
  }
  return driver
}
