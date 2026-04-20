/**
 * Database driver abstraction layer.
 * Supports PostgreSQL, MySQL, and SQLite connections.
 */

import { Pool as PgPool } from 'pg'
import type {
  DBCredentials,
  ColumnDefinition,
  ForeignKey,
  TableSchema,
  QueryResultRow,
} from '@/actions/db'

export type DatabaseType =
  | 'postgresql'
  | 'mysql'
  | 'sqlite'
  | 'sqlserver'
  | 'redshift'
  | 'mongodb'
  | 'oracle'
  | 'mariadb'
  | 'snowflake'
  | 'bigquery'
  | 'cockroachdb'
  | 'clickhouse'
  | 'duckdb'
  | 'cassandra'
  | 'db2'
  | 'dynamodb'
  | 'firestore'
  | 'planetscale'
  | 'neon'
  | 'turso'
  | 'magic'

/** Maximum rows returned from any user query. Prevents OOM on huge result sets.
 * ADMIN gets 10,000 rows; regular users get 1,000.
 * Users who need more can export or use LIMIT in their SQL. */
export const MAX_QUERY_ROWS = 1_000
export const MAX_QUERY_ROWS_ADMIN = 10_000

export function getMaxRows(role?: string): number {
  return role === 'ADMIN' ? MAX_QUERY_ROWS_ADMIN : MAX_QUERY_ROWS
}

/** Default statement timeout in milliseconds for user-facing queries. */
export const DEFAULT_QUERY_TIMEOUT_MS = 30_000

export interface DriverResult {
  rows: QueryResultRow[]
  fields: string[]
  rowCount: number
  /** True when the result was capped at MAX_QUERY_ROWS */
  truncated?: boolean
}

export interface DatabaseDriver {
  testConnection(): Promise<void>
  fetchSchema(): Promise<TableSchema[]>
  executeQuery(sql: string, maxRows?: number): Promise<DriverResult>
  close(): Promise<void>
}

// ─── PostgreSQL Driver ───────────────────────────────────────────────

export function createPostgresDriver(credentials: DBCredentials): DatabaseDriver {
  // Allow SSL to be disabled for local/dev databases via host heuristic
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(credentials.host)
  const pool = new PgPool({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
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
      const fkQuery = `
        SELECT
          kcu.table_name AS from_table,
          kcu.column_name AS from_column,
          ccu.table_name AS to_table,
          ccu.column_name AS to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
      `
      const [colResult, fkResult] = await Promise.all([
        pool.query(schemaQuery),
        pool.query(fkQuery),
      ])
      const fkMap = new Map<string, ForeignKey[]>()
      for (const fk of fkResult.rows as {
        from_table: string
        from_column: string
        to_table: string
        to_column: string
      }[]) {
        if (!fkMap.has(fk.from_table)) fkMap.set(fk.from_table, [])
        fkMap
          .get(fk.from_table)!
          .push({
            column: fk.from_column,
            referencedTable: fk.to_table,
            referencedColumn: fk.to_column,
          })
      }
      return groupSchemaRows(colResult.rows, fkMap)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const client = await pool.connect()
      try {
        // Per-statement timeout enforced at the DB level — kills the query server-side
        await client.query(`SET LOCAL statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS}`)
        const result = await client.query(sql)
        const fields = result.fields.map((f: { name: string }) => f.name)
        let rows: QueryResultRow[] = result.rows.map((row: Record<string, unknown>) => {
          const obj: QueryResultRow = {}
          for (const field of fields) obj[field] = row[field]
          return obj
        })
        const totalRowCount = result.rowCount || rows.length
        const truncated = rows.length > limit
        if (truncated) rows = rows.slice(0, limit)
        return { rows, fields, rowCount: totalRowCount, truncated }
      } finally {
        client.release()
      }
    },

    async close() {
      await pool.end()
    },
  }
}

// ─── MySQL Driver ────────────────────────────────────────────────────

export function createMysqlDriver(credentials: DBCredentials): DatabaseDriver {
  // Type for mysql2/promise Pool
  type MysqlPool = {
    getConnection: () => Promise<any>
    query: (sql: string, values?: any[]) => Promise<[any[], any[]]>
    end: () => Promise<void>
  }

  let pool: MysqlPool | null = null

  const getPool = async (): Promise<MysqlPool> => {
    if (!pool) {
      const mysql = await import('mysql2/promise')
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(credentials.host)
      pool = mysql.createPool({
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 20,
        connectTimeout: 10000,
      }) as MysqlPool
    }
    return pool
  }

  return {
    async testConnection() {
      const p = await getPool()
      const conn = await p.getConnection()
      try {
        await conn.query('SELECT 1')
      } finally {
        conn.release()
      }
    },

    async fetchSchema() {
      const p = await getPool()
      const [rows] = await p.query(
        `
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
      `,
        [credentials.database]
      )

      interface MysqlSchemaRow {
        table_name: string
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
        column_key: string
      }

      return groupSchemaRows(
        (rows as MysqlSchemaRow[]).map((r) => ({
          table_name: r.table_name,
          column_name: r.column_name,
          data_type: r.data_type,
          is_nullable: r.is_nullable,
          column_default: r.column_default,
          is_primary_key: r.column_key === 'PRI',
        }))
      )
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const p = await getPool()
      const conn = await p.getConnection()
      try {
        // Enforce query timeout — MySQL uses max_execution_time (ms),
        // MariaDB uses max_statement_time (seconds, float). Try MySQL's first.
        try {
          await conn.query(`SET max_execution_time = ${DEFAULT_QUERY_TIMEOUT_MS}`)
        } catch {
          try {
            await conn.query(`SET max_statement_time = ${DEFAULT_QUERY_TIMEOUT_MS / 1000}`)
          } catch {
            // Neither variable supported — proceed without server-side timeout.
          }
        }
        const [rows, fields] = await conn.query(sql)

        interface MysqlField {
          name: string
        }

        const fieldNames = (fields as MysqlField[]).map((f) => f.name)
        let resultRows = (rows as Record<string, unknown>[]).map((row) => {
          const obj: QueryResultRow = {}
          for (const f of fieldNames) obj[f] = row[f]
          return obj
        })
        const totalRowCount = resultRows.length
        const truncated = resultRows.length > limit
        if (truncated) resultRows = resultRows.slice(0, limit)
        return { rows: resultRows, fields: fieldNames, rowCount: totalRowCount, truncated }
      } finally {
        conn.release()
      }
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
      const tables = d
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .all() as { name: string }[]

      const result: TableSchema[] = []
      for (const { name } of tables) {
        // Validate table name to prevent SQL injection
        // SQLite identifiers can only contain alphanumeric characters and underscores
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          console.warn(`Skipping invalid table name: ${name}`)
          continue
        }

        // Type for SQLite PRAGMA table_info result
        interface SqliteColumnInfo {
          cid: number
          name: string
          type: string
          notnull: number
          dflt_value: string | null
          pk: number
        }

        // Use parameterized query with validated identifier
        const columns = d.prepare(`PRAGMA table_info("${name}")`).all() as SqliteColumnInfo[]
        result.push({
          tableName: name,
          columns: columns.map(
            (c): ColumnDefinition => ({
              name: c.name,
              type: c.type || 'TEXT',
              nullable: c.notnull === 0,
              defaultValue: c.dflt_value,
              isPrimaryKey: c.pk === 1,
            })
          ),
        })
      }
      return result
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const d = getDb()

      // SQLite is synchronous — wrap in a promise with a timeout guard
      // to prevent runaway recursive CTEs from hanging the process
      const queryPromise = new Promise<QueryResultRow[]>((resolve, reject) => {
        try {
          const stmt = d.prepare(sql)
          resolve(stmt.all() as QueryResultRow[])
        } catch (err) {
          reject(err)
        }
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Query timed out after ${DEFAULT_QUERY_TIMEOUT_MS / 1000} seconds. ` +
                  'Try adding filters or a LIMIT clause to reduce the result set.'
              )
            ),
          DEFAULT_QUERY_TIMEOUT_MS
        )
      })

      let rows = await Promise.race([queryPromise, timeoutPromise])
      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const totalRowCount = rows.length
      const truncated = rows.length > limit
      if (truncated) rows = rows.slice(0, limit)
      return { rows, fields, rowCount: totalRowCount, truncated }
    },

    async close() {
      if (db) db.close()
    },
  }
}

// ─── SQL Server Driver ───────────────────────────────────────────────

export function createSqlServerDriver(credentials: DBCredentials): DatabaseDriver {
  let pool: any = null

  const getPool = async () => {
    if (!pool) {
      // Use require for better Next.js compatibility
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sql = require('mssql')
      pool = await sql.connect({
        server: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password,
        options: {
          // SQL Server 2022 requires encryption. trustServerCertificate lets us
          // accept the self-signed cert Docker generates on first boot.
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 15000,
        requestTimeout: 30000,
      })
    }
    return pool
  }

  return {
    async testConnection() {
      const p = await getPool()
      await p.request().query('SELECT 1 AS result')
    },

    async fetchSchema() {
      const p = await getPool()
      const result = await p.request().query(`
        SELECT 
          t.TABLE_NAME as table_name,
          c.COLUMN_NAME as column_name,
          c.DATA_TYPE as data_type,
          c.IS_NULLABLE as is_nullable,
          c.COLUMN_DEFAULT as column_default,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key
        FROM INFORMATION_SCHEMA.TABLES t
        JOIN INFORMATION_SCHEMA.COLUMNS c 
          ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
           AND c.TABLE_NAME = pk.TABLE_NAME 
           AND c.COLUMN_NAME = pk.COLUMN_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
          AND t.TABLE_SCHEMA = 'dbo'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
      `)

      return groupSchemaRows(
        result.recordset.map((r: any) => ({
          table_name: r.table_name,
          column_name: r.column_name,
          data_type: r.data_type,
          is_nullable: r.is_nullable,
          column_default: r.column_default,
          is_primary_key: r.is_primary_key === 1,
        }))
      )
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const p = await getPool()
      // Enforce per-query timeout via the request object
      const request = p.request()
      request.timeout = DEFAULT_QUERY_TIMEOUT_MS
      const result = await request.query(sql)
      let rows = result.recordset || []
      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const totalRowCount = rows.length
      const truncated = rows.length > limit
      if (truncated) rows = rows.slice(0, limit)
      return { rows, fields, rowCount: totalRowCount, truncated }
    },

    async close() {
      if (pool) await pool.close()
    },
  }
}

// ─── Amazon Redshift Driver (PostgreSQL compatible with SSL) ─────────

export function createRedshiftDriver(credentials: DBCredentials): DatabaseDriver {
  const pool = new PgPool({
    host: credentials.host,
    port: credentials.port || 5439,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 60000,
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
      const fkQuery = `
        SELECT
          kcu.table_name AS from_table,
          kcu.column_name AS from_column,
          ccu.table_name AS to_table,
          ccu.column_name AS to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
      `
      const [colResult, fkResult] = await Promise.all([
        pool.query(schemaQuery),
        pool.query(fkQuery),
      ])
      const fkMap = new Map<string, ForeignKey[]>()
      for (const fk of fkResult.rows as {
        from_table: string
        from_column: string
        to_table: string
        to_column: string
      }[]) {
        if (!fkMap.has(fk.from_table)) fkMap.set(fk.from_table, [])
        fkMap
          .get(fk.from_table)!
          .push({
            column: fk.from_column,
            referencedTable: fk.to_table,
            referencedColumn: fk.to_column,
          })
      }
      return groupSchemaRows(colResult.rows, fkMap)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const client = await pool.connect()
      try {
        await client.query(`SET LOCAL statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS}`)
        const result = await client.query(sql)
        const fields = result.fields.map((f: { name: string }) => f.name)
        let rows: QueryResultRow[] = result.rows.map((row: Record<string, unknown>) => {
          const obj: QueryResultRow = {}
          for (const field of fields) obj[field] = row[field]
          return obj
        })
        const totalRowCount = result.rowCount || rows.length
        const truncated = rows.length > limit
        if (truncated) rows = rows.slice(0, limit)
        return { rows, fields, rowCount: totalRowCount, truncated }
      } finally {
        client.release()
      }
    },

    async close() {
      await pool.end()
    },
  }
}

// ─── Snowflake Driver ─────────────────────────────────────────────────

export function createSnowflakeDriver(credentials: DBCredentials): DatabaseDriver {
  let connection: any = null

  // Overloading host to hold Snowflake Account Name, and database might contain 'DB/WH'
  let warehouse: string | undefined = undefined
  let databaseName = credentials.database
  if (databaseName.includes('/')) {
    const parts = databaseName.split('/')
    databaseName = parts[0]
    warehouse = parts[1]
  }

  const getConnection = async () => {
    if (!connection) {
      const snowflake = await import('snowflake-sdk')
      connection = snowflake.createConnection({
        account: credentials.host,
        username: credentials.user,
        password: credentials.password,
        database: databaseName,
        warehouse: warehouse,
        clientSessionKeepAlive: true,
      })
      await new Promise<void>((resolve, reject) => {
        connection.connect((err: any) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
    return connection
  }

  return {
    async testConnection() {
      const conn = await getConnection()
      await new Promise<void>((resolve, reject) => {
        conn.execute({
          sqlText: 'SELECT 1;',
          complete: (err: any) => (err ? reject(err) : resolve()),
        })
      })
    },

    async fetchSchema() {
      const conn = await getConnection()
      const schemaQuery = `
        SELECT 
          TABLE_NAME as "table_name", 
          COLUMN_NAME as "column_name", 
          DATA_TYPE as "data_type", 
          IS_NULLABLE as "is_nullable",
          COLUMN_DEFAULT as "column_default"
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA != 'INFORMATION_SCHEMA' AND TABLE_SCHEMA != 'PERFORMANCE_SCHEMA'
        ORDER BY TABLE_NAME, ORDINAL_POSITION;
      `

      const runQuery = (sql: string): Promise<any[]> =>
        new Promise((resolve, reject) => {
          conn.execute({
            sqlText: sql,
            complete: (err: any, stmt: any, rows: any) => (err ? reject(err) : resolve(rows)),
          })
        })

      const colResult = await runQuery(schemaQuery)

      const lowercaseColResult = colResult.map((r: any) => ({
        table_name: r.table_name,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable === 'YES',
        column_default: r.column_default,
        is_primary_key: false,
      }))

      return groupSchemaRows(lowercaseColResult)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const conn = await getConnection()

      const rows: any[] = await new Promise((resolve, reject) => {
        conn.execute({
          sqlText: sql,
          parameters: { STATEMENT_TIMEOUT_IN_SECONDS: Math.floor(DEFAULT_QUERY_TIMEOUT_MS / 1000) },
          complete: (err: any, stmt: any, _rows: any) => (err ? reject(err) : resolve(_rows)),
        })
      })

      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const truncated = rows.length > limit
      const finalRows = truncated ? rows.slice(0, limit) : rows
      return { rows: finalRows, fields, rowCount: rows.length, truncated }
    },

    async close() {
      if (connection) {
        await new Promise<void>((resolve) => {
          connection.destroy((_err: any) => resolve())
        })
      }
    },
  }
}

// ─── Google BigQuery Driver ──────────────────────────────────────────

export function createBigQueryDriver(credentials: DBCredentials): DatabaseDriver {
  let bigquery: any = null

  const getClient = async () => {
    if (!bigquery) {
      const { BigQuery } = await import('@google-cloud/bigquery')
      bigquery = new BigQuery({
        projectId: credentials.database,
        credentials: {
          client_email: credentials.user,
          private_key: credentials.password.replace(/\\n/g, '\n'), // handle newlines in private keys
        },
      })
    }
    return bigquery
  }

  return {
    async testConnection() {
      const bq = await getClient()
      const query = `SELECT 1 as test`
      await bq.query(query)
    },

    async fetchSchema() {
      const bq = await getClient()
      const [datasets] = await bq.getDatasets()
      if (datasets.length === 0) return []

      const dataset = datasets[0]
      const [tables] = await dataset.getTables()
      const schemaOutput: TableSchema[] = []

      for (const tableObj of tables) {
        const [metadata] = await tableObj.getMetadata()
        const fields = metadata.schema?.fields || []

        schemaOutput.push({
          tableName: tableObj.id || 'unknown',
          columns: fields.map((f: any) => ({
            name: f.name,
            type: f.type,
            nullable: f.mode !== 'REQUIRED',
            defaultValue: null,
            isPrimaryKey: false,
          })),
        })
      }
      return schemaOutput
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const bq = await getClient()

      const options = {
        query: sql,
        timeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
      }

      const [rows] = await bq.query(options)
      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const truncated = rows.length > limit
      const finalRows = truncated ? rows.slice(0, limit) : rows
      return { rows: finalRows, fields, rowCount: rows.length, truncated }
    },

    async close() {},
  }
}

// ─── MongoDB Driver ──────────────────────────────────────────────────

export function createMongoDriver(credentials: DBCredentials): DatabaseDriver {
  let client: any = null

  const getClient = async () => {
    if (!client) {
      const { MongoClient } = await import('mongodb')
      let uri = credentials.host
      if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
        const auth = credentials.user
          ? `${encodeURIComponent(credentials.user)}:${encodeURIComponent(credentials.password)}@`
          : ''
        // Use mongodb+srv only for Atlas-style hosts (no port, contains dots).
        // Direct host:port connections (localhost, IPs, self-hosted) use mongodb://.
        const isSrv =
          !credentials.port && credentials.host.includes('.') && !/^[\d.]+$/.test(credentials.host)
        if (isSrv) {
          uri = `mongodb+srv://${auth}${credentials.host}/${credentials.database}?retryWrites=true&w=majority`
        } else {
          const port = credentials.port || 27017
          uri = `mongodb://${auth}${credentials.host}:${port}/${credentials.database}?authSource=admin`
        }
      }
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })
      await client.connect()
    }
    return client
  }

  return {
    async testConnection() {
      const c = await getClient()
      await c.db(credentials.database).command({ ping: 1 })
    },

    async fetchSchema() {
      const c = await getClient()
      const db = c.db(credentials.database)
      const collections = await db.listCollections().toArray()

      const schemaOutput: TableSchema[] = []
      for (const coll of collections) {
        if (coll.type === 'view' || coll.name.startsWith('system.')) continue
        const sample = await db.collection(coll.name).findOne({})
        const columns: ColumnDefinition[] = []
        if (sample) {
          for (const key of Object.keys(sample)) {
            columns.push({
              name: key,
              type: typeof sample[key],
              nullable: true,
              defaultValue: null,
              isPrimaryKey: key === '_id',
            })
          }
        }
        schemaOutput.push({ tableName: coll.name, columns })
      }
      return schemaOutput
    },

    async executeQuery(mongoQuery: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const c = await getClient()
      const db = c.db(credentials.database)

      let parsed: { collection: string; pipeline: any[] } | null = null
      try {
        parsed = JSON.parse(mongoQuery)
      } catch (e) {
        throw new Error(
          'Invalid MongoDB pipeline generated by AI. It must be valid JSON matching { collection, pipeline }.'
        )
      }

      if (!parsed || !parsed.collection || !Array.isArray(parsed.pipeline)) {
        throw new Error("MongoDB query must have 'collection' and 'pipeline' array.")
      }

      parsed.pipeline.push({ $limit: limit + 1 })

      const cursor = db
        .collection(parsed.collection)
        .aggregate(parsed.pipeline, { maxTimeMS: DEFAULT_QUERY_TIMEOUT_MS })
      const rows = await cursor.toArray()

      const displayRows = rows.map((r: any) => {
        const clean = { ...r }
        for (const k in clean) {
          if (clean[k] && typeof clean[k] === 'object' && clean[k]._bsontype) {
            clean[k] = clean[k].toString()
          }
        }
        return clean
      })

      const truncated = displayRows.length > limit
      const finalRows = truncated ? displayRows.slice(0, limit) : displayRows
      const fields = finalRows.length > 0 ? Object.keys(finalRows[0]) : []
      return { rows: finalRows, fields, rowCount: finalRows.length, truncated }
    },

    async close() {
      if (client) await client.close()
    },
  }
}
// ─── ClickHouse Driver ───────────────────────────────────────────────

export function createClickHouseDriver(credentials: DBCredentials): DatabaseDriver {
  let client: any = null

  const getClient = async () => {
    if (!client) {
      const { createClient } = await import('@clickhouse/client')
      // Map host / port
      const url = `http://${credentials.host}:${credentials.port || 8123}`
      client = createClient({
        url,
        username: credentials.user || 'default',
        password: credentials.password || '',
        database: credentials.database || 'default',
      })
    }
    return client
  }

  return {
    async testConnection() {
      const c = await getClient()
      const result = await c.query({ query: 'SELECT 1' })
      await result.json()
    },

    async fetchSchema() {
      const c = await getClient()
      const safeDb = (credentials.database || '').replace(/'/g, "''")
      const query = `
        SELECT table AS table_name, name AS column_name, type AS data_type, 
               is_in_primary_key AS is_primary_key, default_expression AS column_default
        FROM system.columns
        WHERE database = '${safeDb}'
      `
      const result = await c.query({ query })
      const rows = await result.json()

      const mapped = rows.data.map((r: any) => ({
        table_name: r.table_name,
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.data_type.startsWith('Nullable'),
        column_default: r.column_default || null,
        is_primary_key: r.is_primary_key === 1,
      }))
      return groupSchemaRows(mapped)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const c = await getClient()
      const hasLimit = /\blimit\s+\d+/i.test(sql)
      const safeSql = hasLimit
        ? sql.trim().replace(/;$/, '')
        : sql.trim().replace(/;$/, '') + ` LIMIT ${limit + 1}`

      const result = await c.query({ query: safeSql, format: 'JSONEachRow' })
      let rows = (await result.json()) as QueryResultRow[]

      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const truncated = rows.length > limit
      if (truncated) rows = rows.slice(0, limit)

      return { rows, fields, rowCount: rows.length, truncated }
    },

    async close() {
      if (client) await client.close()
    },
  }
}

// ─── Turso (libSQL) Driver ───────────────────────────────────────────

export function createTursoDriver(credentials: DBCredentials): DatabaseDriver {
  let client: any = null

  const getClient = async () => {
    if (!client) {
      const { createClient } = await import('@libsql/client')
      // Database field acts as the Turso URL (e.g. libsql://my-db.turso.io)
      // Password field acts as the Auth Token
      client = createClient({
        url: credentials.database,
        authToken: credentials.password,
      })
    }
    return client
  }

  return {
    async testConnection() {
      const c = await getClient()
      await c.execute('SELECT 1')
    },

    async fetchSchema() {
      const c = await getClient()
      const tablesResult = await c.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      )
      const tables = tablesResult.rows as unknown as { name: string }[]

      const result: TableSchema[] = []
      for (const { name } of tables) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue
        const colsResult = await c.execute(`PRAGMA table_info("${name}")`)
        const columns = colsResult.rows as any[]

        result.push({
          tableName: name,
          columns: columns.map(
            (col: any): ColumnDefinition => ({
              name: col.name,
              type: col.type || 'TEXT',
              nullable: col.notnull === 0,
              defaultValue: col.dflt_value,
              isPrimaryKey: col.pk === 1,
            })
          ),
        })
      }
      return result
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const c = await getClient()
      const result = await c.execute(sql)

      let rows = result.rows as unknown as QueryResultRow[]
      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const truncated = rows.length > limit
      if (truncated) rows = rows.slice(0, limit)

      return { rows, fields, rowCount: result.rows.length, truncated }
    },

    async close() {
      // libSQL client doesn't require explicit close in HTTP mode, but wait if using websockets
      if (client && typeof client.close === 'function') {
        client.close()
      }
    },
  }
}

// ─── DynamoDB Driver ─────────────────────────────────────────────────

export function createDynamoDBDriver(credentials: DBCredentials): DatabaseDriver {
  let client: any = null

  const getClient = async () => {
    if (!client) {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb')
      // user = AccessKeyId, password = SecretAccessKey, database = Region
      client = new DynamoDBClient({
        region: credentials.database,
        credentials: {
          accessKeyId: credentials.user,
          secretAccessKey: credentials.password,
        },
      })
    }
    return client
  }

  return {
    async testConnection() {
      const c = await getClient()
      const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb')
      await c.send(new ListTablesCommand({ Limit: 1 }))
    },

    async fetchSchema() {
      const c = await getClient()
      const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb')
      const result = await c.send(new ListTablesCommand({}))
      const tables = result.TableNames || []

      // DynamoDB is schemaless, so we just return the table names without columns
      // The AI will generate PartiQL queries (which DynamoDB supports)
      return tables.map((t: string) => ({
        tableName: t,
        columns: [],
      }))
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const c = await getClient()
      const { ExecuteStatementCommand } = await import('@aws-sdk/client-dynamodb')

      // AI will generate PartiQL for DynamoDB
      const result = await c.send(new ExecuteStatementCommand({ Statement: sql }))

      // Convert DynamoDB JSON to standard JSON objects
      let rows: QueryResultRow[] = []
      if (result.Items) {
        // Simple manual unmarshaling for core types (string, number, bool)
        rows = result.Items.map((item: any) => {
          const row: any = {}
          for (const key of Object.keys(item)) {
            const valObj = item[key]
            if (valObj.S !== undefined) row[key] = valObj.S
            else if (valObj.N !== undefined) row[key] = Number(valObj.N)
            else if (valObj.BOOL !== undefined) row[key] = valObj.BOOL
            else row[key] = JSON.stringify(valObj)
          }
          return row
        })
      }

      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const truncated = rows.length > limit
      if (truncated) rows = rows.slice(0, limit)
      return { rows, fields, rowCount: rows.length, truncated }
    },

    async close() {
      if (client) client.destroy()
    },
  }
}

// ─── Firestore Driver ────────────────────────────────────────────────

export function createFirestoreDriver(credentials: DBCredentials): DatabaseDriver {
  let db: any = null

  const getDb = async () => {
    if (!db) {
      const admin = await import('firebase-admin')
      // user = client_email, password = private_key, database = project_id
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: credentials.database,
            clientEmail: credentials.user,
            privateKey: credentials.password.replace(/\\n/g, '\n'),
          }),
        })
      }
      db = admin.firestore()
    }
    return db
  }

  return {
    async testConnection() {
      const d = await getDb()
      await d.listCollections() // Test if we can list collections
    },

    async fetchSchema() {
      const d = await getDb()
      const collections = await d.listCollections()
      const schemaOutput: TableSchema[] = []

      for (const coll of collections) {
        // Fetch 1 document to infer schema
        const snapshot = await coll.limit(1).get()
        const columns: ColumnDefinition[] = []
        if (!snapshot.empty) {
          const doc = snapshot.docs[0].data()
          for (const key of Object.keys(doc)) {
            columns.push({
              name: key,
              type: typeof doc[key],
              nullable: true,
              defaultValue: null,
              isPrimaryKey: false,
            })
          }
        }
        schemaOutput.push({ tableName: coll.id, columns })
      }
      return schemaOutput
    },

    async executeQuery(jsonQuery: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const d = await getDb()

      // Wait for AI to generate JSON format like MongoDB: { collection: "users", conditions: [{ field: "age", op: ">", value: 18 }] }
      let parsed: {
        collection: string
        conditions?: any[]
        orderBy?: string
        desc?: boolean
      } | null = null
      try {
        parsed = JSON.parse(jsonQuery)
      } catch (e) {
        throw new Error('Invalid Firestore query generated by AI. Must be valid JSON.')
      }

      if (!parsed || !parsed.collection) {
        throw new Error("Firestore query must have 'collection'.")
      }

      let query = d.collection(parsed.collection).limit(limit + 1)

      if (parsed.conditions && Array.isArray(parsed.conditions)) {
        for (const cond of parsed.conditions) {
          query = query.where(cond.field, cond.op, cond.value)
        }
      }
      if (parsed.orderBy) {
        query = query.orderBy(parsed.orderBy, parsed.desc ? 'desc' : 'asc')
      }

      const snapshot = await query.get()
      const displayRows = snapshot.docs.map((doc: any) => ({ _id: doc.id, ...doc.data() }))

      const truncated = displayRows.length > limit
      const finalRows = truncated ? displayRows.slice(0, limit) : displayRows
      const fields = finalRows.length > 0 ? Object.keys(finalRows[0]) : []
      return { rows: finalRows, fields, rowCount: finalRows.length, truncated }
    },

    async close() {
      // Firebase Admin does not need explicit connection closure in standard flow
    },
  }
}

// ─── Oracle Driver ─────────────────────────────────────────────────────

export function createOracleDriver(credentials: DBCredentials): DatabaseDriver {
  let connection: any = null

  const getConnection = async () => {
    if (!connection) {
      // oracledb's ESM namespace object has frozen getters — use require to get
      // the mutable CommonJS module, or fall back to the .default export.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const oracledb = require('oracledb')
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

      const connectString = `${credentials.host}:${credentials.port || 1521}/${credentials.database}`
      connection = await oracledb.getConnection({
        user: credentials.user,
        password: credentials.password,
        connectString: connectString,
      })
    }
    return connection
  }

  return {
    async testConnection() {
      const c = await getConnection()
      await c.execute('SELECT 1 FROM DUAL')
    },

    async fetchSchema() {
      const c = await getConnection()
      const query = `
        SELECT t.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.NULLABLE
        FROM USER_TABLES t
        JOIN USER_TAB_COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
      `
      const result = await c.execute(query)
      const rows = result.rows as any[]

      // Basic PK mapping logic can be expanded
      const mapped = rows.map((r: any) => ({
        table_name: r.TABLE_NAME,
        column_name: r.COLUMN_NAME,
        data_type: r.DATA_TYPE,
        is_nullable: r.NULLABLE === 'Y',
        column_default: null,
        is_primary_key: false, // Inferring PKs in Oracle requires complex ALL_CONSTRAINTS queries
      }))
      return groupSchemaRows(mapped)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const c = await getConnection()

      const hasFetchFirst = /\bfetch\s+first\b/i.test(sql)
      const baseSql = sql.replace(/;$/, '')
      const safeSql = hasFetchFirst ? baseSql : baseSql + ` FETCH FIRST ${limit + 1} ROWS ONLY`

      try {
        const result = await c.execute(safeSql)
        let rows = result.rows as QueryResultRow[]

        const fields = result.metaData ? result.metaData.map((m: any) => m.name) : []
        const truncated = rows.length > limit
        if (truncated) rows = rows.slice(0, limit)

        return { rows, fields, rowCount: rows.length, truncated }
      } catch (err: any) {
        // Fallback for pre-12c syntax where FETCH FIRST fails (ORA-00933)
        // We wrap it in a subquery with ROWNUM to ensure limits are still respected
        if (!hasFetchFirst && err.message && err.message.includes('ORA-')) {
          const fallbackSql = `SELECT * FROM (${baseSql}) WHERE ROWNUM <= ${limit + 1}`
          const errResult = await c.execute(fallbackSql)
          let rows = errResult.rows as QueryResultRow[]
          const fields = errResult.metaData ? errResult.metaData.map((m: any) => m.name) : []
          const truncated = rows.length > limit
          if (truncated) rows = rows.slice(0, limit)
          return { rows, fields, rowCount: rows.length, truncated }
        }
        throw err
      }
    },

    async close() {
      if (connection) {
        await connection.close()
      }
    },
  }
}

// ─── Cassandra Driver ────────────────────────────────────────────────

export function createCassandraDriver(credentials: DBCredentials): DatabaseDriver {
  let client: any = null

  const getClient = async () => {
    if (!client) {
      const cassandra = await import('cassandra-driver')
      const authProvider = new cassandra.auth.PlainTextAuthProvider(
        credentials.user,
        credentials.password
      )
      client = new cassandra.Client({
        contactPoints: [credentials.host],
        localDataCenter: credentials.database || 'datacenter1', // Using database field as datacenter
        authProvider,
        keyspace: 'system', // Default connection space
      })
      await client.connect()
    }
    return client
  }

  return {
    async testConnection() {
      const c = await getClient()
      await c.execute('SELECT release_version FROM system.local')
    },

    async fetchSchema() {
      const c = await getClient()
      const query = `
        SELECT keyspace_name, table_name, column_name, type
        FROM system_schema.columns
        WHERE keyspace_name NOT IN ('system', 'system_auth', 'system_distributed', 'system_schema', 'system_traces', 'system_views')
      `
      const result = await c.execute(query)
      const mapped = result.rows.map((r: any) => ({
        table_name: r.keyspace_name + '.' + r.table_name,
        column_name: r.column_name,
        data_type: r.type,
        is_nullable: true,
        column_default: null,
        is_primary_key: false, // CQL primary keys are complex partition/clustering mappings
      }))
      return groupSchemaRows(mapped)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const limit = maxRows ?? MAX_QUERY_ROWS
      const c = await getClient()

      const hasLimit = /\blimit\s+\d+/i.test(sql)
      const safeSql = hasLimit
        ? sql.replace(/;$/, '')
        : sql.replace(/;$/, '') + ` LIMIT ${limit + 1}`

      const result = await c.execute(safeSql, [], { prepare: false })
      let rows = result.rows.map((r: any) => {
        const obj: any = {}
        for (const [key, val] of Object.entries(r)) {
          obj[key] = val && typeof val === 'object' && val.toString ? val.toString() : val
        }
        return obj
      })

      const fields = rows.length > 0 ? Object.keys(rows[0]) : []
      const truncated = rows.length > limit
      if (truncated) rows = rows.slice(0, limit)
      return { rows, fields, rowCount: rows.length, truncated }
    },

    async close() {
      if (client) await client.shutdown()
    },
  }
}

// ─── Magic Dataset Driver ────────────────────────────────────────────
// Backs user-uploaded CSVs. Delegates ingestion + querying to the
// magic-dataset module which owns schema isolation and SQL validation.

export function createMagicDriver(credentials: DBCredentials): DatabaseDriver {
  // For magic connections, the `user` field carries the owning user id (see
  // upload-dataset.ts) and `database` carries the single table created by
  // the most recent ingest for this connection.
  const userId = credentials.user
  const tableName = credentials.database

  return {
    async testConnection() {
      // The backing database is the app's own Postgres — if the app is
      // serving requests, this driver is reachable. Nothing further to probe.
    },

    async fetchSchema() {
      const { fetchMagicSchema } = await import('./magic-dataset')
      const tables = await fetchMagicSchema(userId)
      // Only surface the table that belongs to this connection. Other magic
      // uploads by the same user are separate connections and show up there.
      return tables.filter((t) => t.tableName === tableName)
    },

    async executeQuery(sql: string, maxRows?: number) {
      const { runMagicQuery } = await import('./magic-dataset')
      const limit = maxRows ?? MAX_QUERY_ROWS
      const result = await runMagicQuery({
        userId,
        sql,
        maxRows: limit,
        timeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
      })
      return result
    },

    async close() {
      // The magic-dataset module owns its own pool; nothing per-driver to close.
    },
  }
}

// ─── Factory ─────────────────────────────────────────────────────────

export function createDriver(
  credentials: DBCredentials,
  type: DatabaseType = 'postgresql'
): DatabaseDriver {
  switch (type) {
    case 'mysql':
      return createMysqlDriver(credentials)
    case 'mariadb':
      return createMysqlDriver(credentials)
    case 'sqlite':
      return createSqliteDriver(credentials)
    case 'magic':
      return createMagicDriver(credentials)
    case 'sqlserver':
      return createSqlServerDriver(credentials)
    case 'redshift':
      return createRedshiftDriver(credentials)
    case 'snowflake':
      return createSnowflakeDriver(credentials)
    case 'bigquery':
      return createBigQueryDriver(credentials)
    case 'mongodb':
      return createMongoDriver(credentials)
    case 'clickhouse':
      return createClickHouseDriver(credentials)
    case 'dynamodb':
      return createDynamoDBDriver(credentials)
    case 'firestore':
      return createFirestoreDriver(credentials)
    case 'turso':
      return createTursoDriver(credentials)
    case 'duckdb':
      throw new Error('DuckDB support is coming soon.')
    case 'cassandra':
      return createCassandraDriver(credentials)
    case 'oracle':
      return createOracleDriver(credentials)
    case 'db2':
      throw new Error('IBM Db2 support is coming soon.')
    case 'cockroachdb':
      return createPostgresDriver(credentials)
    case 'neon':
      return createPostgresDriver(credentials)
    case 'planetscale':
      return createMysqlDriver(credentials)
    case 'postgresql':
    default:
      return createPostgresDriver(credentials)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function groupSchemaRows(
  rows: {
    table_name: string
    column_name: string
    data_type: string
    is_nullable: string | boolean
    column_default: string | null
    is_primary_key: boolean
  }[],
  fkMap?: Map<string, ForeignKey[]>
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
    foreignKeys: fkMap?.get(tableName) ?? [],
  }))
}
