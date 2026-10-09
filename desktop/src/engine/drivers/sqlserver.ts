import sql from 'mssql'
import { NqError } from '@shared/errors'
import { assertReadOnlySql, maskSql, stripTrailingSemicolon } from '../safety/sql'
import { formatDateTime, normalizeValue } from '../normalize'
import {
  APP_NAME,
  buildTables,
  quoteIdentifier,
  shortVersion,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

/** Accepts "SERVER\INSTANCE" in the host field as well as a separate instance name. */
export function splitServer(host: string | undefined, instance: string | undefined) {
  const value = (host ?? '').trim()
  const slash = value.indexOf('\\')
  if (slash > 0) {
    return {
      server: value.slice(0, slash),
      instance: instance || value.slice(slash + 1) || undefined,
    }
  }
  return { server: value, instance: instance || undefined }
}

/** Accepts "DOMAIN\user" in the user field as well as a separate domain. */
export function splitWindowsUser(user: string | undefined, domain: string | undefined) {
  const value = (user ?? '').trim()
  const slash = value.indexOf('\\')
  if (slash > 0)
    return { domain: domain || value.slice(0, slash), userName: value.slice(slash + 1) }
  return { domain: domain ?? '', userName: value }
}

const CATALOG_COLUMNS = `
  SET ROWCOUNT 0;
  SELECT s.name AS [schema], o.name AS [table],
         CASE WHEN o.type = 'V' THEN 'view' ELSE 'table' END AS kind,
         c.name AS [column],
         CASE
           WHEN ty.name IN ('varchar', 'char', 'varbinary', 'binary')
             THEN ty.name + '(' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CAST(c.max_length AS varchar(10)) END + ')'
           WHEN ty.name IN ('nvarchar', 'nchar')
             THEN ty.name + '(' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CAST(c.max_length / 2 AS varchar(10)) END + ')'
           WHEN ty.name IN ('decimal', 'numeric')
             THEN ty.name + '(' + CAST(c.precision AS varchar(5)) + ',' + CAST(c.scale AS varchar(5)) + ')'
           ELSE ty.name
         END AS type,
         CAST(c.is_nullable AS bit) AS nullable,
         CAST(CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS bit) AS isPrimaryKey,
         rc.row_count AS rowEstimate
  FROM sys.objects o
  JOIN sys.schemas s ON s.schema_id = o.schema_id
  JOIN sys.columns c ON c.object_id = o.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN (
    SELECT ic.object_id, ic.column_id
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    WHERE i.is_primary_key = 1
  ) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
  LEFT JOIN (
    SELECT object_id, SUM(row_count) AS row_count
    FROM sys.dm_db_partition_stats WHERE index_id IN (0, 1) GROUP BY object_id
  ) rc ON rc.object_id = o.object_id
  WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
  ORDER BY s.name, o.name, c.column_id`

// Without VIEW DATABASE STATE permission the row-count view is unavailable.
const CATALOG_COLUMNS_NO_STATS = CATALOG_COLUMNS.replace(
  /LEFT JOIN \(\s*SELECT object_id, SUM\(row_count\)[\s\S]*?\) rc ON rc\.object_id = o\.object_id/,
  ''
).replace('rc.row_count AS rowEstimate', 'NULL AS rowEstimate')

const CATALOG_FOREIGN_KEYS = `
  SET ROWCOUNT 0;
  SELECT ps.name AS [schema], pt.name AS [table], pc.name AS [column],
         rs.name AS referencedSchema, rt.name AS referencedTable, rcol.name AS referencedColumn
  FROM sys.foreign_key_columns fkc
  JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
  JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
  JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
  JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
  JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
  JOIN sys.columns rcol ON rcol.object_id = fkc.referenced_object_id AND rcol.column_id = fkc.referenced_column_id`

interface ColumnMeta {
  name: string
  type?: { declaration?: string }
}

function formatSqlServerValue(value: unknown, declaration: string | undefined): unknown {
  if (value instanceof Date) {
    if (declaration === 'date') return formatDateTime(value, true).slice(0, 10)
    if (declaration === 'time') return formatDateTime(value, true).slice(11)
    if (declaration === 'datetimeoffset') return value.toISOString()
    // datetime, datetime2 and smalldatetime have no time zone; useUTC keeps
    // the stored wall-clock value intact when read back in UTC.
    return formatDateTime(value, true)
  }
  return normalizeValue(value)
}

export const createSqlServerDriver: DriverFactory = (config, secrets, context) => {
  let pool: sql.ConnectionPool | null = null
  let poolReady: Promise<sql.ConnectionPool> | null = null
  const running = new Map<string, sql.Request>()
  const canceled = new Set<string>()
  const settings = config.sqlserver ?? { auth: 'sql', encrypt: true, trustServerCertificate: true }

  function poolConfig(): sql.config {
    const tunneled = !!context.endpoint
    const { server, instance } = splitServer(config.host, settings.instance)
    const base: sql.config = {
      server: tunneled ? context.endpoint!.host : server,
      database: config.database || undefined,
      connectionTimeout: context.connectTimeoutMs,
      // Per-query limits are enforced with a timer that cancels the request.
      requestTimeout: 0,
      pool: { max: 4, min: 0, idleTimeoutMillis: 60_000 },
      options: {
        encrypt: settings.encrypt,
        trustServerCertificate: settings.trustServerCertificate,
        appName: APP_NAME,
        enableArithAbort: true,
        useUTC: true,
        ...(instance && !tunneled ? { instanceName: instance } : {}),
      },
    }
    if (tunneled) base.port = context.endpoint!.port
    else if (!instance) base.port = config.port ?? 1433
    if (settings.auth === 'windows') {
      const { domain, userName } = splitWindowsUser(config.user, settings.domain)
      return { ...base, user: userName, password: secrets.password ?? '', domain }
    }
    return { ...base, user: config.user, password: secrets.password ?? '' }
  }

  async function getPool(): Promise<sql.ConnectionPool> {
    if (pool) return pool
    if (!poolReady) {
      poolReady = (async () => {
        const created = new sql.ConnectionPool(poolConfig())
        created.on('error', () => {})
        await created.connect()
        pool = created
        return created
      })()
      poolReady.catch(() => {
        poolReady = null
      })
    }
    return poolReady
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'bracket')
    return schema ? `${quoteIdentifier(schema, 'bracket')}.${name}` : name
  }

  const driver: Driver = {
    async test() {
      const result = await (await getPool())
        .request()
        .query('SET ROWCOUNT 0; SELECT @@VERSION AS version')
      const banner = String(result.recordset?.[0]?.version ?? '')
      const name = /^(Microsoft SQL (?:Azure|Server)[^-(\n]*)/.exec(banner)?.[1]?.trim()
      return { serverVersion: shortVersion(name ?? banner) }
    },

    async schema() {
      const current = await getPool()
      let columns: CatalogColumnRow[]
      try {
        columns = (await current.request().query(CATALOG_COLUMNS)).recordset
      } catch {
        columns = (await current.request().query(CATALOG_COLUMNS_NO_STATS)).recordset
      }
      let foreignKeys: CatalogForeignKeyRow[] = []
      try {
        foreignKeys = (await current.request().query(CATALOG_FOREIGN_KEYS)).recordset
      } catch {
        foreignKeys = []
      }
      const tables = buildTables(columns, foreignKeys, qualify)
      const truncated = tables.length > SCHEMA_TABLE_LIMIT
      return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
    },

    async query(text, options) {
      const masked = assertReadOnlySql(text, 'sqlserver')
      const statement = stripTrailingSemicolon(text, masked).trim()
      if (/^\s*$/.test(maskSql(statement, 'sqlserver')))
        throw new NqError('VALIDATION', 'Write a query first.')
      canceled.delete(options.queryId)
      const request = (await getPool()).request()
      request.arrayRowMode = true
      running.set(options.queryId, request)
      let timedOut = false
      const timer = setTimeout(
        () => {
          timedOut = true
          request.cancel()
        },
        Math.max(1000, options.timeoutMs)
      )
      try {
        // ROWCOUNT stops reading after the limit without rewriting the query.
        // Every request sets it, so pooled sessions never inherit a stale value.
        const batch = `SET ROWCOUNT ${options.rowLimit + 1};\n${statement}`
        const result = (await request.query(batch)) as unknown as {
          recordset?: unknown[][]
          columns?: ColumnMeta[][]
        }
        const meta = result.columns?.[0] ?? []
        const raw = (result.recordset ?? []) as unknown[][]
        const truncated = raw.length > options.rowLimit
        if (truncated) raw.length = options.rowLimit
        const declarations = meta.map((column) => column.type?.declaration)
        const rows = raw.map((row) =>
          row.map((value, index) => formatSqlServerValue(value, declarations[index]))
        )
        return {
          columns: meta.map((column) => ({ name: column.name, type: column.type?.declaration })),
          rows,
          truncated,
          executedText: statement,
        }
      } catch (error) {
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
        if (timedOut) {
          throw new NqError(
            'TIMEOUT',
            `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
            {
              hint: 'Add filters or a TOP clause to make it faster, or raise the time limit in Settings.',
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
      const request = running.get(queryId)
      if (!request) return
      canceled.add(queryId)
      request.cancel()
    },

    async close() {
      const current = pool ?? (poolReady ? await poolReady.catch(() => null) : null)
      pool = null
      poolReady = null
      await current?.close().catch(() => {})
    },
  }
  return driver
}
