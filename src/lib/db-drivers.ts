/**
 * Database driver abstraction layer.
 * Supports PostgreSQL, MySQL, and SQLite connections.
 */

import { Pool as PgPool } from 'pg'
import type { DBCredentials, ColumnDefinition, TableSchema, QueryResultRow } from '@/actions/db'

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite'

export interface DriverResult {
  rows: QueryResultRow[]
  fields: string[]
  rowCount: number
}

export interface DatabaseDriver {
  testConnection(): Promise<void>
  fetchSchema(): Promise<TableSchema[]>
  executeQuery(sql: string): Promise<DriverResult>
  close(): Promise<void>
}

// ─── PostgreSQL Driver ───────────────────────────────────────────────

export function createPostgresDriver(credentials: DBCredentials): DatabaseDriver {
  const pool = new PgPool({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    ssl: false,
    connectionTimeoutMillis: 5000,
    query_timeout: 30000,
  })

  return {
    async testConnection() {
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
    },

    async fetchSchema() {
      const schemaQuery = `
        SELECT
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE
            WHEN pk.column_name IS NOT NULL THEN true
            ELSE false
          END as is_primary_key
        FROM information_schema.tables t
        JOIN information_schema.columns c
          ON t.table_name = c.table_name
          AND t.table_schema = c.table_schema
        LEFT JOIN (
          SELECT kcu.table_schema, kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
        ) pk
          ON c.table_schema = pk.table_schema
          AND c.table_name = pk.table_name
          AND c.column_name = pk.column_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position;
      `
      const result = await pool.query(schemaQuery)
      return groupSchemaRows(result.rows)
    },

    async executeQuery(sql: string) {
      const result = await pool.query(sql)
      const fields = result.fields.map((f: { name: string }) => f.name)
      const rows: QueryResultRow[] = result.rows.map((row: Record<string, unknown>) => {
        const obj: QueryResultRow = {}
        for (const field of fields) obj[field] = row[field]
        return obj
      })
      return { rows, fields, rowCount: result.rowCount || rows.length }
    },

    async close() {
      await pool.end()
    },
  }
}

// ─── MySQL Driver ────────────────────────────────────────────────────

export function createMysqlDriver(credentials: DBCredentials): DatabaseDriver {
  let pool: any = null

  const getPool = async () => {
    if (!pool) {
      const mysql = await import('mysql2/promise')
      pool = mysql.createPool({
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password,
        connectionLimit: 5,
        connectTimeout: 5000,
      })
    }
    return pool
  }

  return {
    async testConnection() {
      const p = await getPool()
      const conn = await p.getConnection()
      await conn.query('SELECT 1')
      conn.release()
    },

    async fetchSchema() {
      const p = await getPool()
      const [rows] = await p.query(`
        SELECT
          TABLE_NAME as table_name,
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          COLUMN_KEY as column_key
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `, [credentials.database])

      return groupSchemaRows((rows as any[]).map((r: any) => ({
        table_name: r.table_name,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable,
        column_default: r.column_default,
        is_primary_key: r.column_key === 'PRI',
      })))
    },

    async executeQuery(sql: string) {
      const p = await getPool()
      const [rows, fields] = await p.query(sql)
      const fieldNames = (fields as any[]).map((f: any) => f.name)
      const resultRows = (rows as any[]).map((row: any) => {
        const obj: QueryResultRow = {}
        for (const f of fieldNames) obj[f] = row[f]
        return obj
      })
      return { rows: resultRows, fields: fieldNames, rowCount: resultRows.length }
    },

    async close() {
      if (pool) await pool.end()
    },
  }
}

// ─── SQLite Driver ───────────────────────────────────────────────────

export function createSqliteDriver(credentials: DBCredentials): DatabaseDriver {
  // For SQLite, the "database" field holds the file path
  let db: any = null

  const getDb = () => {
    if (!db) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3')
      db = new Database(credentials.database, { readonly: true })
    }
    return db
  }

  return {
    async testConnection() {
      const d = getDb()
      d.prepare('SELECT 1').get()
    },

    async fetchSchema() {
      const d = getDb()
      const tables = d.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { name: string }[]

      const result: TableSchema[] = []
      for (const { name } of tables) {
        const columns = d.prepare(`PRAGMA table_info("${name}")`).all() as any[]
        result.push({
          tableName: name,
          columns: columns.map((c: any): ColumnDefinition => ({
            name: c.name,
            type: c.type || 'TEXT',
            nullable: c.notnull === 0,
            defaultValue: c.dflt_value,
            isPrimaryKey: c.pk === 1,
          })),
        })
      }
      return result
    },

    async executeQuery(sql: string) {
      const d = getDb()
      const stmt = d.prepare(sql)
      const rows = stmt.all() as QueryResultRow[]
      const fields = rows.length > 0 ? Object.keys(rows[0]) : (stmt.columns?.() ?? []).map((c: any) => c.name)
      return { rows, fields, rowCount: rows.length }
    },

    async close() {
      if (db) db.close()
    },
  }
}

// ─── Factory ─────────────────────────────────────────────────────────

export function createDriver(credentials: DBCredentials, type: DatabaseType = 'postgresql'): DatabaseDriver {
  switch (type) {
    case 'mysql':
      return createMysqlDriver(credentials)
    case 'sqlite':
      return createSqliteDriver(credentials)
    case 'postgresql':
    default:
      return createPostgresDriver(credentials)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function groupSchemaRows(
  rows: { table_name: string; column_name: string; data_type: string; is_nullable: string | boolean; column_default: string | null; is_primary_key: boolean }[]
): TableSchema[] {
  const tablesMap = new Map<string, ColumnDefinition[]>()

  for (const row of rows) {
    const col: ColumnDefinition = {
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES' || row.is_nullable === true,
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key,
    }
    if (!tablesMap.has(row.table_name)) {
      tablesMap.set(row.table_name, [])
    }
    tablesMap.get(row.table_name)!.push(col)
  }

  return Array.from(tablesMap.entries()).map(([tableName, columns]) => ({
    tableName,
    columns,
  }))
}
