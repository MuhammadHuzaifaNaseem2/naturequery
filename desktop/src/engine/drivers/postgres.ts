import pg from 'pg'
import type { PoolClient, PoolConfig } from 'pg'
import { NqError } from '@shared/errors'
import { assertReadOnlySql, maskSql, stripTrailingSemicolon, topLevel } from '../safety/sql'
import { normalizeRows } from '../normalize'
import { isTlsUnsupportedError, resolveTls } from '../tls'
import {
  APP_NAME,
  buildTables,
  quoteIdentifier,
  shortVersion,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const { Pool, Client, types: pgTypes } = pg

// Dates and times are returned exactly as the server formats them, so values
// are never shifted by this computer's time zone.
const RAW_TEXT_TYPES = new Set([
  1082, 1083, 1114, 1184, 1186, 1266, 1182, 1115, 1185, 1183, 1187, 1270,
])

const TYPE_NAMES: Record<number, string> = {
  16: 'boolean',
  17: 'bytea',
  18: 'char',
  19: 'name',
  20: 'bigint',
  21: 'smallint',
  23: 'integer',
  25: 'text',
  26: 'oid',
  114: 'json',
  700: 'real',
  701: 'double precision',
  790: 'money',
  1042: 'char',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1266: 'timetz',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
}

const SYSTEM_SCHEMAS = [
  'pg_catalog',
  'information_schema',
  'crdb_internal',
  'pg_extension',
  'pg_internal',
  'pg_automv',
]

/** bigint (int8): a number when it fits exactly, otherwise the exact text. */
function parseBigInt(value: string): number | string {
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : value
}

function typeParsers(): PoolConfig['types'] {
  return {
    getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
      if (RAW_TEXT_TYPES.has(oid)) return (value: string) => value
      if (oid === 20) return parseBigInt
      return pgTypes.getTypeParser(oid, format as 'text')
    }) as never,
  }
}

const CATALOG_COLUMNS = `
  SELECT n.nspname AS schema, c.relname AS table,
         CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind,
         a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type,
         NOT a.attnotnull AS nullable,
         COALESCE(a.attnum = ANY (pk.indkey::int2[]), false) AS "isPrimaryKey",
         CASE WHEN c.reltuples >= 0 THEN c.reltuples::bigint END AS "rowEstimate"
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_catalog.pg_index pk ON pk.indrelid = c.oid AND pk.indisprimary
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND n.nspname <> ALL ($1::text[])
    AND n.nspname NOT LIKE 'pg\\_toast%' AND n.nspname NOT LIKE 'pg\\_temp%'
    AND has_table_privilege(c.oid, 'SELECT')
  ORDER BY n.nspname, c.relname, a.attnum`

const CATALOG_FOREIGN_KEYS = `
  SELECT n.nspname AS schema, cl.relname AS table, a.attname AS column,
         fn.nspname AS "referencedSchema", fcl.relname AS "referencedTable", fa.attname AS "referencedColumn"
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class cl ON cl.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_catalog.pg_class fcl ON fcl.oid = con.confrelid
  JOIN pg_catalog.pg_namespace fn ON fn.oid = fcl.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = con.confkey[1]
  WHERE con.contype = 'f' AND n.nspname <> ALL ($1::text[])`

const INFO_SCHEMA_COLUMNS = `
  SELECT c.table_schema AS schema, c.table_name AS table,
         CASE WHEN t.table_type = 'VIEW' THEN 'view' ELSE 'table' END AS kind,
         c.column_name AS column, c.data_type AS type, c.is_nullable = 'YES' AS nullable,
         false AS "isPrimaryKey"
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema <> ALL ($1::text[])
  ORDER BY c.table_schema, c.table_name, c.ordinal_position`

export const createPostgresDriver: DriverFactory = (config, secrets, context) => {
  let pool: pg.Pool | null = null
  let poolReady: Promise<pg.Pool> | null = null
  let useTls = (config.tls?.mode ?? 'prefer') !== 'disable'
  const running = new Map<string, PoolClient & { processID?: number }>()
  const canceled = new Set<string>()

  function clientConfig(withTls: boolean): pg.ClientConfig {
    const endpoint = context.endpoint
    const tls = resolveTls(config, secrets, config.host)
    return {
      host: endpoint?.host ?? config.host,
      port: endpoint?.port ?? config.port ?? 5432,
      database: config.database || undefined,
      user: config.user,
      password: secrets.password ?? '',
      ssl: withTls && tls.options ? tls.options : false,
      connectionTimeoutMillis: context.connectTimeoutMs,
      keepAlive: true,
      application_name: APP_NAME,
      types: typeParsers(),
    }
  }

  function createPool(withTls: boolean): pg.Pool {
    const created = new Pool({ ...clientConfig(withTls), max: 4, idleTimeoutMillis: 60_000 })
    // Idle-client errors (server restart, network drop) must not crash the engine.
    created.on('error', () => {})
    return created
  }

  /** Connects once, falling back to plain TCP when "prefer" meets a non-TLS server. */
  async function getPool(): Promise<pg.Pool> {
    if (pool) return pool
    if (!poolReady) {
      poolReady = (async () => {
        const tlsMode = config.tls?.mode ?? 'prefer'
        let candidate = createPool(useTls)
        try {
          const client = await candidate.connect()
          client.release()
        } catch (error) {
          await candidate.end().catch(() => {})
          if (tlsMode !== 'prefer' || !isTlsUnsupportedError(error)) throw error
          useTls = false
          candidate = createPool(false)
          const client = await candidate.connect()
          client.release()
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

  async function withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await (await getPool()).connect()
    let broken = false
    try {
      return await work(client)
    } catch (error) {
      broken = isConnectionLevelError(error)
      throw error
    } finally {
      client.release(broken)
    }
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'double', { foldsToLower: true })
    if (!schema || schema === 'public') return name
    return `${quoteIdentifier(schema, 'double', { foldsToLower: true })}.${name}`
  }

  const driver: Driver = {
    async test() {
      return withClient(async (client) => {
        const result = await client.query('SELECT version() AS version')
        const banner = String(result.rows[0]?.version ?? '')
        const redshift = /Redshift ([\d.]+)/.exec(banner)
        if (redshift) return { serverVersion: `Amazon Redshift ${redshift[1]}` }
        const cockroach = /CockroachDB \w+ (v[\d.]+)/.exec(banner)
        if (cockroach) return { serverVersion: `CockroachDB ${cockroach[1]}` }
        return { serverVersion: shortVersion(banner.split(' on ')[0]) }
      })
    },

    async schema() {
      return withClient(async (client) => {
        await client.query('SET statement_timeout = 120000').catch(() => {})
        let columns: CatalogColumnRow[]
        let foreignKeys: CatalogForeignKeyRow[] = []
        try {
          columns = (await client.query(CATALOG_COLUMNS, [SYSTEM_SCHEMAS])).rows
        } catch {
          // Some PostgreSQL-compatible engines expose only information_schema.
          columns = (await client.query(INFO_SCHEMA_COLUMNS, [SYSTEM_SCHEMAS])).rows
        }
        try {
          foreignKeys = (await client.query(CATALOG_FOREIGN_KEYS, [SYSTEM_SCHEMAS])).rows
        } catch {
          foreignKeys = []
        }
        // Reserve unqualified names for "public" only when they are unique.
        const tables = buildTables(columns, foreignKeys, qualify)
        const truncated = tables.length > SCHEMA_TABLE_LIMIT
        return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
      })
    },

    async query(text, options) {
      const masked = assertReadOnlySql(text, 'postgresql')
      const statement = stripTrailingSemicolon(text, masked).trim()
      const first = /^\s*\(*\s*([A-Za-z]+)/
        .exec(topLevel(maskSql(statement, 'postgresql')))?.[1]
        ?.toUpperCase()
      const useCursor =
        first === 'SELECT' || first === 'WITH' || first === 'VALUES' || first === 'TABLE'
      canceled.delete(options.queryId)

      return withClient(async (client) => {
        running.set(options.queryId, client)
        try {
          // Session level, before the transaction: a failed SET inside a
          // transaction would abort it on engines that do not support it.
          await client
            .query(`SET statement_timeout = ${Math.max(1000, Math.floor(options.timeoutMs))}`)
            .catch(() => {})
          await client.query('BEGIN TRANSACTION READ ONLY')
          let result: pg.QueryArrayResult
          if (useCursor) {
            await client.query(`DECLARE nq_results NO SCROLL CURSOR FOR ${statement}`)
            result = await client.query({
              text: `FETCH FORWARD ${options.rowLimit + 1} FROM nq_results`,
              rowMode: 'array',
            })
          } else {
            result = await client.query({ text: statement, rowMode: 'array' })
          }
          const rows = result.rows as unknown[][]
          const truncated = rows.length > options.rowLimit
          if (truncated) rows.length = options.rowLimit
          return {
            columns: (result.fields ?? []).map((field) => ({
              name: field.name,
              type: TYPE_NAMES[field.dataTypeID],
            })),
            rows: normalizeRows(rows),
            truncated,
            executedText: statement,
          }
        } finally {
          running.delete(options.queryId)
          await client.query('ROLLBACK').catch(() => {})
        }
      }).catch((error) => {
        if (canceled.delete(options.queryId)) {
          throw new NqError('CANCELED', 'The query was canceled.')
        }
        throw error
      })
    },

    async cancel(queryId) {
      const client = running.get(queryId)
      if (!client) return
      canceled.add(queryId)
      const pid = client.processID
      try {
        if (!pid) throw new Error('no backend pid')
        const helper = new Client(clientConfig(useTls))
        await helper.connect()
        try {
          await helper.query('SELECT pg_cancel_backend($1)', [pid])
        } finally {
          await helper.end().catch(() => {})
        }
      } catch {
        // If the server will not accept a cancel request, drop the connection.
        ;(
          client as unknown as { connection?: { stream?: { destroy(): void } } }
        ).connection?.stream?.destroy()
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

function isConnectionLevelError(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? ''
  return ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', '57P01', '57P02', '57P03', '08006', '08003'].includes(
    code
  )
}
