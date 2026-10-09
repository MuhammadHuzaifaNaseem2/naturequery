import mysql from 'mysql2/promise'
import type {
  ConnectionOptions,
  FieldPacket,
  Pool,
  PoolConnection,
  PoolOptions,
  SslOptions,
} from 'mysql2/promise'
import { NqError } from '@shared/errors'
import { applyRowLimit, assertReadOnlySql } from '../safety/sql'
import { normalizeRows } from '../normalize'
import { isTlsUnsupportedError, resolveTls } from '../tls'
import {
  APP_NAME,
  buildTables,
  quoteIdentifier,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const SYSTEM_SCHEMAS = ['mysql', 'information_schema', 'performance_schema', 'sys']

const FIELD_TYPES: Record<number, string> = {
  0: 'decimal',
  1: 'tinyint',
  2: 'smallint',
  3: 'int',
  4: 'float',
  5: 'double',
  7: 'timestamp',
  8: 'bigint',
  9: 'mediumint',
  10: 'date',
  11: 'time',
  12: 'datetime',
  13: 'year',
  15: 'varchar',
  16: 'bit',
  245: 'json',
  246: 'decimal',
  247: 'enum',
  248: 'set',
  252: 'blob',
  253: 'varchar',
  254: 'char',
  255: 'geometry',
}

export const createMysqlDriver: DriverFactory = (config, secrets, context) => {
  let pool: Pool | null = null
  let poolReady: Promise<Pool> | null = null
  let useTls = (config.tls?.mode ?? 'prefer') !== 'disable'
  let flavor: 'mysql' | 'mariadb' | null = null
  const running = new Map<string, number>()
  const canceled = new Set<string>()

  function ssl(): SslOptions | undefined {
    if (!useTls) return undefined
    const tls = resolveTls(config, secrets, config.host)
    if (!tls.options) return undefined
    return {
      rejectUnauthorized: tls.options.rejectUnauthorized,
      ca: tls.options.ca,
      // mysql2 checks the host name only when asked to.
      verifyIdentity: tls.mode === 'verify-full',
    } as SslOptions
  }

  function connectionOptions(): ConnectionOptions {
    return {
      host: context.endpoint?.host ?? config.host,
      port: context.endpoint?.port ?? config.port ?? 3306,
      user: config.user,
      password: secrets.password ?? '',
      database: config.database || undefined,
      ssl: ssl(),
      connectTimeout: context.connectTimeoutMs,
      enableKeepAlive: true,
      multipleStatements: false,
      dateStrings: true,
      supportBigNumbers: true,
      // Numbers that fit exactly stay numbers; larger ones arrive as text.
      bigNumberStrings: false,
      charset: 'utf8mb4',
      connectAttributes: { program_name: APP_NAME },
    }
  }

  function options(): PoolOptions {
    return {
      ...connectionOptions(),
      connectionLimit: 4,
      maxIdle: 2,
      idleTimeout: 60_000,
      waitForConnections: true,
    }
  }

  async function getPool(): Promise<Pool> {
    if (pool) return pool
    if (!poolReady) {
      poolReady = (async () => {
        let candidate = mysql.createPool(options())
        try {
          const connection = await candidate.getConnection()
          connection.release()
        } catch (error) {
          await candidate.end().catch(() => {})
          if ((config.tls?.mode ?? 'prefer') !== 'prefer' || !isTlsUnsupportedError(error))
            throw error
          useTls = false
          candidate = mysql.createPool(options())
          const connection = await candidate.getConnection()
          connection.release()
        }
        pool = candidate
        return candidate
      })()
      poolReady.catch(() => {
        poolReady = null
      })
    }
    return poolReady
  }

  async function detectFlavor(connection: PoolConnection): Promise<'mysql' | 'mariadb'> {
    if (flavor) return flavor
    const [rows] = await connection.query('SELECT VERSION() AS version')
    flavor = /mariadb/i.test(String((rows as { version: string }[])[0]?.version))
      ? 'mariadb'
      : 'mysql'
    return flavor
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'backtick')
    if (!schema || schema === config.database) return name
    return `${quoteIdentifier(schema, 'backtick')}.${name}`
  }

  const driver: Driver = {
    async test() {
      const connection = await (await getPool()).getConnection()
      try {
        const [rows] = await connection.query('SELECT VERSION() AS version')
        const version = String((rows as { version: string }[])[0]?.version ?? '')
        const mariadb = /^([\d.]+)-MariaDB/i.exec(version)
        return {
          serverVersion: mariadb ? `MariaDB ${mariadb[1]}` : `MySQL ${version.split('-')[0]}`,
        }
      } finally {
        connection.release()
      }
    },

    async schema() {
      const connection = await (await getPool()).getConnection()
      try {
        const filter = config.database
          ? { sql: 'c.TABLE_SCHEMA = ?', params: [config.database] }
          : { sql: 'c.TABLE_SCHEMA NOT IN (?)', params: [SYSTEM_SCHEMAS] }
        const [columns] = await connection.query(
          `SELECT c.TABLE_SCHEMA AS \`schema\`, c.TABLE_NAME AS \`table\`,
                  CASE WHEN t.TABLE_TYPE = 'VIEW' THEN 'view' ELSE 'table' END AS kind,
                  c.COLUMN_NAME AS \`column\`, c.COLUMN_TYPE AS type,
                  c.IS_NULLABLE = 'YES' AS nullable, c.COLUMN_KEY = 'PRI' AS isPrimaryKey,
                  c.COLUMN_DEFAULT AS defaultValue, t.TABLE_ROWS AS rowEstimate
           FROM information_schema.COLUMNS c
           JOIN information_schema.TABLES t
             ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
           WHERE ${filter.sql}
           ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`,
          filter.params
        )
        let foreignKeys: CatalogForeignKeyRow[] = []
        try {
          const [rows] = await connection.query(
            `SELECT c.TABLE_SCHEMA AS \`schema\`, c.TABLE_NAME AS \`table\`, c.COLUMN_NAME AS \`column\`,
                    c.REFERENCED_TABLE_SCHEMA AS referencedSchema, c.REFERENCED_TABLE_NAME AS referencedTable,
                    c.REFERENCED_COLUMN_NAME AS referencedColumn
             FROM information_schema.KEY_COLUMN_USAGE c
             WHERE c.REFERENCED_TABLE_NAME IS NOT NULL AND ${filter.sql}`,
            filter.params
          )
          foreignKeys = rows as CatalogForeignKeyRow[]
        } catch {
          foreignKeys = []
        }
        const tables = buildTables(columns as CatalogColumnRow[], foreignKeys, qualify)
        const truncated = tables.length > SCHEMA_TABLE_LIMIT
        return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
      } finally {
        connection.release()
      }
    },

    async query(text, opts) {
      assertReadOnlySql(text, 'mysql')
      const statement = applyRowLimit(text, opts.rowLimit + 1, 'mysql')
      canceled.delete(opts.queryId)
      const connection = await (await getPool()).getConnection()
      running.set(opts.queryId, connection.threadId)
      let inTransaction = false
      try {
        const kind = await detectFlavor(connection)
        const ms = Math.max(1000, Math.floor(opts.timeoutMs))
        await connection
          .query(
            kind === 'mariadb'
              ? `SET SESSION max_statement_time = ${ms / 1000}`
              : `SET SESSION max_execution_time = ${ms}`
          )
          .catch(() => {})
        try {
          await connection.query('START TRANSACTION READ ONLY')
          inTransaction = true
        } catch {
          // Some MySQL-compatible services do not support read-only transactions.
        }
        const [rows, fields] = await connection.query({
          sql: statement,
          rowsAsArray: true,
          timeout: ms + 5000,
        })
        const data = Array.isArray(rows) ? (rows as unknown[][]) : []
        const truncated = data.length > opts.rowLimit
        if (truncated) data.length = opts.rowLimit
        return {
          columns: ((fields as FieldPacket[] | undefined) ?? []).map((field) => ({
            name: field.name,
            type: FIELD_TYPES[field.columnType ?? field.type ?? -1],
          })),
          rows: normalizeRows(data),
          truncated,
          executedText: statement,
        }
      } catch (error) {
        if (canceled.delete(opts.queryId)) throw new NqError('CANCELED', 'The query was canceled.')
        throw error
      } finally {
        running.delete(opts.queryId)
        if (inTransaction) await connection.query('ROLLBACK').catch(() => {})
        connection.release()
      }
    },

    async cancel(queryId) {
      const threadId = running.get(queryId)
      if (threadId === undefined) return
      canceled.add(queryId)
      // KILL QUERY must come from a separate connection; the pool may be busy.
      const helper = await mysql.createConnection(connectionOptions())
      try {
        await helper.query(`KILL QUERY ${Number(threadId)}`)
      } finally {
        await helper.end().catch(() => {})
      }
    },

    async close() {
      const current = pool ?? (poolReady ? await poolReady.catch(() => null) : null)
      pool = null
      poolReady = null
      await current?.end().catch(() => {})
    },
  }
  return driver
}
