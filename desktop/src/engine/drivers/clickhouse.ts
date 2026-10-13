import https from 'node:https'
import {
  ClickHouseLogLevel,
  createClient,
  type ClickHouseClient,
  type ClickHouseSettings,
} from '@clickhouse/client'
import { NqError } from '@shared/errors'
import { applyRowLimit, assertReadOnlySql } from '../safety/sql'
import { normalizeRows } from '../normalize'
import { resolveTls } from '../tls'
import {
  APP_NAME,
  buildTables,
  quoteIdentifier,
  type CatalogColumnRow,
  parseJsonExact,
} from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const SYSTEM_DATABASES = ['system', 'INFORMATION_SCHEMA', 'information_schema']

export const createClickHouseDriver: DriverFactory = (config, secrets, context) => {
  const protocol = config.clickhouse?.protocol ?? 'http'
  const host = context.endpoint?.host ?? config.host
  const port = context.endpoint?.port ?? config.port ?? (protocol === 'https' ? 8443 : 8123)
  const running = new Map<string, AbortController>()
  // Accounts with readonly=1 may not change settings; retry without them once seen.
  let settingsAllowed = true

  let agent: https.Agent | undefined
  if (protocol === 'https') {
    const tls = resolveTls(config, secrets, config.host)
    agent = new https.Agent({
      keepAlive: true,
      maxSockets: 4,
      rejectUnauthorized: true,
      // Spread, so a checkServerIdentity the mode does not set stays absent.
      ...tls.options,
    })
  }

  const client: ClickHouseClient = createClient({
    url: `${protocol}://${host}:${port}`,
    username: config.user || 'default',
    password: secrets.password ?? '',
    database: config.database || 'default',
    application: APP_NAME,
    request_timeout: 300_000,
    max_open_connections: 4,
    // Errors are reported to the user by the engine; the client's own console
    // logging would only repeat them (with query IDs) in the app log.
    log: { level: ClickHouseLogLevel.OFF },
    ...(agent ? { http_agent: agent, set_basic_auth_header: true } : {}),
  })

  function querySettings(timeoutMs: number): ClickHouseSettings {
    if (!settingsAllowed) return {}
    return {
      max_execution_time: Math.max(1, Math.ceil(timeoutMs / 1000)),
      cancel_http_readonly_queries_on_client_close: 1,
    }
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'backtick')
    if (!schema || schema === (config.database || 'default')) return name
    return `${quoteIdentifier(schema, 'backtick')}.${name}`
  }

  async function rows<T>(query: string): Promise<T[]> {
    const result = await client.query({ query, format: 'JSONEachRow' })
    return (await result.json()) as T[]
  }

  const driver: Driver = {
    async test() {
      const [row] = await rows<{ version: string }>('SELECT version() AS version')
      return { serverVersion: `ClickHouse ${row?.version ?? ''}`.trim() }
    },

    async schema() {
      const scope = config.database
        ? `= '${config.database.replaceAll("'", "''")}'`
        : `NOT IN (${SYSTEM_DATABASES.map((name) => `'${name}'`).join(', ')})`
      const columns = await rows<
        Omit<CatalogColumnRow, 'nullable' | 'isPrimaryKey'> & {
          nullable: number
          isPrimaryKey: number
        }
      >(`
        SELECT c.database AS schema, c.table AS table,
               if(t.engine LIKE '%View', 'view', 'table') AS kind,
               c.name AS column, c.type AS type,
               startsWith(c.type, 'Nullable') AS nullable,
               c.is_in_primary_key AS isPrimaryKey,
               t.total_rows AS rowEstimate
        FROM system.columns c
        JOIN system.tables t ON t.database = c.database AND t.name = c.table
        WHERE c.database ${scope}
        ORDER BY c.database, c.table, c.position`)
      const tables = buildTables(
        columns.map((column) => ({
          ...column,
          nullable: !!Number(column.nullable),
          isPrimaryKey: !!Number(column.isPrimaryKey),
          rowEstimate: column.rowEstimate === null ? null : Number(column.rowEstimate),
        })),
        [],
        qualify
      )
      const truncated = tables.length > SCHEMA_TABLE_LIMIT
      return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
    },

    async query(text, options) {
      assertReadOnlySql(text, 'clickhouse')
      const statement = applyRowLimit(text, options.rowLimit + 1, 'clickhouse')
      const controller = new AbortController()
      running.set(options.queryId, controller)
      // Read-only accounts cannot set max_execution_time, so the time limit is
      // also enforced here. The server-side limit normally fires first.
      let timedOut = false
      const timer = setTimeout(
        () => {
          timedOut = true
          controller.abort()
        },
        Math.max(1000, options.timeoutMs) + 1000
      )
      const run = () =>
        client.query({
          query: statement,
          format: 'JSONCompactEachRowWithNamesAndTypes',
          query_id: options.queryId,
          abort_signal: controller.signal,
          clickhouse_settings: querySettings(options.timeoutMs),
        })
      try {
        let result
        try {
          result = await run()
        } catch (error) {
          if (
            settingsAllowed &&
            /readonly mode|Cannot modify '.*' setting/i.test(String((error as Error).message))
          ) {
            settingsAllowed = false
            result = await run()
          } else throw error
        }
        // Parsed by hand so 64-bit integers and decimals stay exact.
        const lines = (await result.text()).split('\n').filter((line) => line.trim())
        const [names = [], types = [], ...data] = lines.map(
          (line) => parseJsonExact(line) as unknown[]
        )
        const truncated = data.length > options.rowLimit
        if (truncated) data.length = options.rowLimit
        return {
          columns: (names as string[]).map((name, index) => ({
            name,
            type: String(types[index] ?? '').toLowerCase() || undefined,
          })),
          rows: normalizeRows(data),
          truncated,
          executedText: statement,
        }
      } catch (error) {
        if (controller.signal.aborted && !timedOut)
          throw new NqError('CANCELED', 'The query was canceled.')
        if (
          timedOut ||
          /TIMEOUT_EXCEEDED|Timeout exceeded/i.test(String((error as Error).message))
        ) {
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
      const controller = running.get(queryId)
      if (!controller) return
      controller.abort()
      // Also ask the server directly, in case the dropped connection is not noticed.
      await client
        .command({ query: `KILL QUERY WHERE query_id = '${queryId.replaceAll("'", '')}' ASYNC` })
        .catch(() => {})
    },

    async close() {
      await client.close().catch(() => {})
      agent?.destroy()
    },
  }
  return driver
}
