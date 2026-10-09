import oracledb from 'oracledb'
import { NqError } from '@shared/errors'
import { assertReadOnlySql, stripTrailingSemicolon, maskSql } from '../safety/sql'
import { normalizeRows } from '../normalize'
import {
  buildTables,
  quoteIdentifier,
  shortVersion,
  type CatalogColumnRow,
  type CatalogForeignKeyRow,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

// Dates and times arrive as text in an unambiguous format instead of Oracle's
// default DD-MON-RR, and without time zone conversion on this computer.
const SESSION_SETUP = `ALTER SESSION SET
  NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'
  NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'
  NLS_TIMESTAMP_TZ_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF TZH:TZM'`

const TEXT_TYPES = new Set<unknown>([
  oracledb.DB_TYPE_DATE,
  oracledb.DB_TYPE_TIMESTAMP,
  oracledb.DB_TYPE_TIMESTAMP_TZ,
  oracledb.DB_TYPE_TIMESTAMP_LTZ,
  oracledb.DB_TYPE_CLOB,
  oracledb.DB_TYPE_NCLOB,
])

/** Keeps large NUMBER values exact by fetching them as text. */
function fetchTypeHandler(
  meta: oracledb.Metadata<unknown>
): oracledb.FetchTypeResponse | undefined {
  if (TEXT_TYPES.has(meta.dbType)) return { type: oracledb.STRING }
  if (meta.dbType === oracledb.DB_TYPE_NUMBER && (meta.precision ?? 0) > 15)
    return { type: oracledb.STRING }
  return undefined
}

const CATALOG_COLUMNS = `
  SELECT c.owner AS "schema", c.table_name AS "table",
         CASE WHEN o.object_type = 'VIEW' THEN 'view' ELSE 'table' END AS "kind",
         c.column_name AS "column",
         CASE
           WHEN c.data_type IN ('VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR') THEN c.data_type || '(' || c.char_length || ')'
           WHEN c.data_type = 'NUMBER' AND c.data_precision IS NOT NULL
             THEN 'NUMBER(' || c.data_precision || CASE WHEN c.data_scale > 0 THEN ',' || c.data_scale END || ')'
           ELSE c.data_type
         END AS "type",
         CASE WHEN c.nullable = 'Y' THEN 1 ELSE 0 END AS "nullable",
         CASE WHEN pk.column_name IS NULL THEN 0 ELSE 1 END AS "isPrimaryKey",
         t.num_rows AS "rowEstimate"
  FROM all_tab_columns c
  JOIN all_objects o ON o.owner = c.owner AND o.object_name = c.table_name AND o.object_type IN ('TABLE', 'VIEW')
  LEFT JOIN all_tables t ON t.owner = c.owner AND t.table_name = c.table_name
  LEFT JOIN (
    SELECT cc.owner, cc.table_name, cc.column_name
    FROM all_constraints k
    JOIN all_cons_columns cc ON cc.owner = k.owner AND cc.constraint_name = k.constraint_name
    WHERE k.constraint_type = 'P'
  ) pk ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
  WHERE c.owner NOT IN (SELECT username FROM all_users WHERE oracle_maintained = 'Y')
  ORDER BY c.owner, c.table_name, c.column_id`

const CATALOG_FOREIGN_KEYS = `
  SELECT a.owner AS "schema", a.table_name AS "table", a.column_name AS "column",
         rc.owner AS "referencedSchema", rc.table_name AS "referencedTable", rc.column_name AS "referencedColumn"
  FROM all_constraints k
  JOIN all_cons_columns a ON a.owner = k.owner AND a.constraint_name = k.constraint_name
  JOIN all_cons_columns rc ON rc.owner = k.r_owner AND rc.constraint_name = k.r_constraint_name AND rc.position = a.position
  WHERE k.constraint_type = 'R'
    AND k.owner NOT IN (SELECT username FROM all_users WHERE oracle_maintained = 'Y')`

export const createOracleDriver: DriverFactory = (config, secrets, context) => {
  let pool: oracledb.Pool | null = null
  let poolReady: Promise<oracledb.Pool> | null = null
  const running = new Map<string, oracledb.Connection>()
  const canceled = new Set<string>()
  const owner = (config.user ?? '').toUpperCase()

  function connectString(): string {
    const host = context.endpoint?.host ?? config.host
    const port = context.endpoint?.port ?? config.port ?? 1521
    const name = config.database ?? ''
    if (config.oracle?.connectAs === 'sid') {
      return `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SID=${name})))`
    }
    return `${host}:${port}/${name}`
  }

  async function getPool(): Promise<oracledb.Pool> {
    if (pool) return pool
    if (!poolReady) {
      poolReady = oracledb
        .createPool({
          user: config.user,
          password: secrets.password,
          connectString: connectString(),
          poolMin: 0,
          poolMax: 4,
          poolIncrement: 1,
          poolTimeout: 60,
          connectTimeout: Math.ceil(context.connectTimeoutMs / 1000),
          transportConnectTimeout: Math.ceil(context.connectTimeoutMs / 1000),
          sessionCallback: (connection, _tag, done) => {
            connection.execute(SESSION_SETUP).then(
              () => done(),
              (error) => done(error)
            )
          },
        })
        .then(async (created) => {
          // Fail fast on bad credentials instead of on the first query.
          const connection = await created.getConnection()
          await connection.close()
          pool = created
          return created
        })
      poolReady.catch(() => {
        poolReady = null
      })
    }
    return poolReady
  }

  async function withConnection<T>(
    work: (connection: oracledb.Connection) => Promise<T>
  ): Promise<T> {
    const connection = await (await getPool()).getConnection()
    try {
      return await work(connection)
    } finally {
      await connection.close().catch(() => {})
    }
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'double', { foldsToUpper: true })
    if (!schema || schema === owner) return name
    return `${quoteIdentifier(schema, 'double', { foldsToUpper: true })}.${name}`
  }

  const driver: Driver = {
    async test() {
      return withConnection(async (connection) => {
        const version = connection.oracleServerVersionString
        return {
          serverVersion: shortVersion(version ? `Oracle Database ${version}` : 'Oracle Database'),
        }
      })
    },

    async schema() {
      return withConnection(async (connection) => {
        connection.callTimeout = 120_000
        const options = { outFormat: oracledb.OUT_FORMAT_OBJECT }
        const columns = ((await connection.execute(CATALOG_COLUMNS, [], options)).rows ??
          []) as (Omit<CatalogColumnRow, 'nullable' | 'isPrimaryKey'> & {
          nullable: number
          isPrimaryKey: number
        })[]
        let foreignKeys: CatalogForeignKeyRow[] = []
        try {
          foreignKeys = ((await connection.execute(CATALOG_FOREIGN_KEYS, [], options)).rows ??
            []) as CatalogForeignKeyRow[]
        } catch {
          foreignKeys = []
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
      })
    },

    async query(text, options) {
      const masked = assertReadOnlySql(text, 'oracle')
      // Oracle rejects a trailing semicolon in a single statement.
      const statement = stripTrailingSemicolon(text, masked).trim()
      if (!maskSql(statement, 'oracle').trim())
        throw new NqError('VALIDATION', 'Write a query first.')
      canceled.delete(options.queryId)
      return withConnection(async (connection) => {
        running.set(options.queryId, connection)
        connection.callTimeout = Math.max(1000, Math.floor(options.timeoutMs))
        try {
          await connection.execute('SET TRANSACTION READ ONLY')
          const result = await connection.execute(statement, [], {
            outFormat: oracledb.OUT_FORMAT_ARRAY,
            maxRows: options.rowLimit + 1,
            fetchTypeHandler,
          })
          const rows = (result.rows ?? []) as unknown[][]
          const truncated = rows.length > options.rowLimit
          if (truncated) rows.length = options.rowLimit
          return {
            columns: (result.metaData ?? []).map((meta) => ({
              name: meta.name,
              type: meta.dbTypeName?.toLowerCase(),
            })),
            rows: normalizeRows(rows),
            truncated,
            executedText: statement,
          }
        } catch (error) {
          if (canceled.delete(options.queryId))
            throw new NqError('CANCELED', 'The query was canceled.')
          throw error
        } finally {
          running.delete(options.queryId)
          await connection.rollback().catch(() => {})
        }
      })
    },

    async cancel(queryId) {
      const connection = running.get(queryId)
      if (!connection) return
      canceled.add(queryId)
      await connection.break().catch(() => {})
    },

    async close() {
      const current = pool ?? (poolReady ? await poolReady.catch(() => null) : null)
      pool = null
      poolReady = null
      await current?.close(0).catch(() => {})
    },
  }
  return driver
}
