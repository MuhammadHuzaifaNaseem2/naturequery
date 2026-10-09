import snowflake from 'snowflake-sdk'
import type { Connection, RowStatement } from 'snowflake-sdk'
import { NqError } from '@shared/errors'
import { assertReadOnlySql, stripTrailingSemicolon } from '../safety/sql'
import { normalizeRows } from '../normalize'
import {
  buildTables,
  quoteIdentifier,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

// Snowflake only accepts letters, digits, dots, dashes and underscores here.
const APPLICATION = 'NatureQuery_Desktop'

let configured = false

/** The SDK writes snowflake.log into the working folder unless told otherwise. */
function configureSdk(): void {
  if (configured) return
  configured = true
  const ignore = () => {}
  snowflake.configure({
    logLevel: 'ERROR',
    additionalLogToConsole: false,
    customLogger: {
      error: (message) => console.error(`[snowflake] ${message}`),
      warn: ignore,
      info: ignore,
      debug: ignore,
      trace: ignore,
    },
  })
}

/**
 * Accepts "myorg-myaccount", "xy12345.eu-central-1" or a pasted URL such as
 * https://myorg-myaccount.snowflakecomputing.com and returns the identifier.
 */
export function normalizeAccount(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.snowflakecomputing\.(com|cn)$/i, '')
}

function connect(connection: Connection): Promise<Connection> {
  return new Promise((resolve, reject) => {
    connection.connect((error, connected) => (error ? reject(error) : resolve(connected)))
  })
}

function execute(
  connection: Connection,
  sqlText: string
): Promise<{ statement: RowStatement; rows: unknown[] }> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      rowMode: 'array',
      fetchAsString: ['Number', 'Date'],
      complete: (error, statement, rows) => {
        if (error) reject(error)
        else resolve({ statement: statement as RowStatement, rows: rows ?? [] })
      },
    })
  })
}

/** Snowflake, with password, programmatic access token or key pair sign-in. */
export const createSnowflakeDriver: DriverFactory = (config, secrets, context) => {
  configureSdk()
  const settings = config.snowflake
  const keyPair = settings?.auth === 'keypair'
  const connection = snowflake.createConnection({
    account: normalizeAccount(settings?.account ?? ''),
    username: config.user,
    ...(keyPair
      ? {
          authenticator: 'SNOWFLAKE_JWT',
          privateKey: secrets.privateKey,
          privateKeyPass: secrets.privateKeyPassphrase || undefined,
        }
      : { password: secrets.password }),
    warehouse: settings?.warehouse,
    database: config.database,
    schema: settings?.schema,
    role: settings?.role,
    application: APPLICATION,
    timeout: context.connectTimeoutMs,
    sfRetryMaxLoginRetries: 2,
    clientSessionKeepAlive: true,
  })
  let ready: Promise<Connection> | null = null
  const running = new Map<string, RowStatement>()
  const canceled = new Set<string>()

  function session(): Promise<Connection> {
    if (!ready) {
      ready = connect(connection)
      ready.catch(() => {
        ready = null
      })
    }
    return ready
  }

  async function objects<T>(sqlText: string): Promise<T[]> {
    const conn = await session()
    const { statement, rows } = await execute(conn, sqlText)
    const names = (statement.getColumns() ?? []).map((column) => column.getName())
    return (rows as unknown[][]).map(
      (row) => Object.fromEntries(names.map((name, index) => [name, row[index]])) as T
    )
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'double', { foldsToUpper: true })
    if (!schema || schema === settings?.schema?.toUpperCase()) return name
    return `${quoteIdentifier(schema, 'double', { foldsToUpper: true })}.${name}`
  }

  const driver: Driver = {
    async test() {
      const [row] = await objects<{ VERSION: string }>('SELECT CURRENT_VERSION() AS VERSION')
      return { serverVersion: `Snowflake ${row?.VERSION ?? ''}`.trim() }
    },

    async schema() {
      let databaseName = config.database
      if (!databaseName) {
        const [row] = await objects<{ DB: string | null }>('SELECT CURRENT_DATABASE() AS DB')
        databaseName = row?.DB ?? undefined
      }
      if (!databaseName) {
        throw new NqError('VALIDATION', 'Choose a database to browse its tables.', {
          hint: 'Edit the connection and enter a database name.',
        })
      }
      // CURRENT_DATABASE() returns the stored (usually upper case) name.
      const database = config.database
        ? quoteIdentifier(databaseName, 'double', { foldsToUpper: true })
        : `"${databaseName.replaceAll('"', '""')}"`
      const prefix = `${database}.`
      const columns = await objects<{
        SCHEMA: string
        TABLE: string
        TABLE_TYPE: string
        COLUMN: string
        TYPE: string
        NULLABLE: string
        ROW_COUNT: string | null
      }>(`
        SELECT c.table_schema AS "SCHEMA", c.table_name AS "TABLE", t.table_type AS "TABLE_TYPE",
               c.column_name AS "COLUMN", c.data_type AS "TYPE", c.is_nullable AS "NULLABLE",
               t.row_count AS "ROW_COUNT"
        FROM ${prefix}INFORMATION_SCHEMA.COLUMNS c
        JOIN ${prefix}INFORMATION_SCHEMA.TABLES t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema <> 'INFORMATION_SCHEMA'
        ORDER BY c.table_schema, c.table_name, c.ordinal_position`)

      const keyScope = `IN DATABASE ${database}`
      const primaryKeys = new Set<string>()
      let foreignKeys: CatalogForeignKeyRow[] = []
      try {
        for (const row of await objects<Record<string, string>>(`SHOW PRIMARY KEYS ${keyScope}`)) {
          primaryKeys.add(`${row.schema_name}.${row.table_name}.${row.column_name}`)
        }
        foreignKeys = (await objects<Record<string, string>>(`SHOW IMPORTED KEYS ${keyScope}`)).map(
          (row) => ({
            schema: row.fk_schema_name,
            table: row.fk_table_name,
            column: row.fk_column_name,
            referencedSchema: row.pk_schema_name,
            referencedTable: row.pk_table_name,
            referencedColumn: row.pk_column_name,
          })
        )
      } catch {
        // Constraints are optional in Snowflake; the schema is still useful.
      }

      const rows: CatalogColumnRow[] = columns.map((column) => ({
        schema: column.SCHEMA,
        table: column.TABLE,
        kind: /VIEW/i.test(column.TABLE_TYPE) ? 'view' : 'table',
        column: column.COLUMN,
        type: column.TYPE,
        nullable: column.NULLABLE === 'YES',
        isPrimaryKey: primaryKeys.has(`${column.SCHEMA}.${column.TABLE}.${column.COLUMN}`),
        rowEstimate: column.ROW_COUNT === null ? null : Number(column.ROW_COUNT),
      }))
      const tables = buildTables(rows, foreignKeys, qualify)
      const truncated = tables.length > SCHEMA_TABLE_LIMIT
      return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
    },

    async query(text, options) {
      const masked = assertReadOnlySql(text, 'snowflake')
      const sqlText = stripTrailingSemicolon(text, masked).trimEnd()
      canceled.delete(options.queryId)
      const conn = await session()
      let timedOut = false
      const timer = setTimeout(
        () => {
          timedOut = true
          running.get(options.queryId)?.cancel()
        },
        Math.max(1000, options.timeoutMs)
      )
      try {
        const statement = await new Promise<RowStatement>((resolve, reject) => {
          const started = conn.execute({
            sqlText,
            rowMode: 'array',
            fetchAsString: ['Number', 'Date'],
            streamResult: true,
            complete: (error, stmt) => (error ? reject(error) : resolve(stmt as RowStatement)),
          }) as RowStatement
          running.set(options.queryId, started)
        })
        const total = statement.getNumRows() ?? 0
        const wanted = Math.min(total, options.rowLimit)
        const rows: unknown[][] = []
        if (wanted > 0) {
          await new Promise<void>((resolve, reject) => {
            statement
              .streamRows({ start: 0, end: wanted - 1 })
              .on('data', (row: unknown[]) => rows.push(row))
              .on('error', reject)
              .on('end', () => resolve())
          })
        }
        return {
          columns: (statement.getColumns() ?? []).map((column) => ({
            name: column.getName(),
            type: column.getType()?.toLowerCase(),
          })),
          rows: normalizeRows(rows),
          truncated: total > options.rowLimit,
          executedText: sqlText,
        }
      } catch (error) {
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
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
      const statement = running.get(queryId)
      if (!statement) return
      canceled.add(queryId)
      await new Promise<void>((resolve) => statement.cancel(() => resolve()))
    },

    async close() {
      if (!ready) return
      await ready.catch(() => null)
      ready = null
      await new Promise<void>((resolve) => connection.destroy(() => resolve()))
    },
  }
  return driver
}
