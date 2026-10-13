import cassandra from 'cassandra-driver'
import { NqError } from '@shared/errors'
import { assertReadOnlySql, stripTrailingSemicolon } from '../safety/sql'
import { normalizeRows } from '../normalize'
import { resolveTls } from '../tls'
import { APP_NAME, buildTables, quoteIdentifier, type CatalogColumnRow } from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const SYSTEM_KEYSPACES = [
  'system',
  'system_auth',
  'system_schema',
  'system_distributed',
  'system_traces',
  'system_views',
  'system_virtual_schema',
]

/** Apache Cassandra and ScyllaDB, queried with CQL SELECT statements. */
export const createCassandraDriver: DriverFactory = (config, secrets, context) => {
  const port = context.endpoint?.port ?? config.port ?? 9042
  const contactPoints = context.endpoint
    ? [`${context.endpoint.host}:${context.endpoint.port}`]
    : (config.host ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean)
  const tls = resolveTls(config, secrets, config.host?.split(',')[0]?.trim())
  const canceled = new Set<string>()

  const client = new cassandra.Client({
    contactPoints,
    localDataCenter: config.cassandra?.datacenter,
    keyspace: config.cassandra?.keyspace || undefined,
    protocolOptions: { port },
    credentials: config.user
      ? { username: config.user, password: secrets.password ?? '' }
      : undefined,
    // Cassandra cannot fall back from TLS to plain, so "prefer" means plain.
    // Spread, so a checkServerIdentity the mode does not set stays absent.
    sslOptions: tls.options && tls.mode !== 'prefer' ? { ...tls.options } : undefined,
    socketOptions: { connectTimeout: context.connectTimeoutMs, readTimeout: 60_000 },
    applicationName: APP_NAME,
  })
  let connected: Promise<void> | null = null
  const connect = () => {
    if (!connected) {
      connected = client.connect()
      connected.catch(() => {
        connected = null
      })
    }
    return connected
  }

  function qualify(schema: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'double', { foldsToLower: true })
    if (!schema || schema === config.cassandra?.keyspace) return name
    return `${quoteIdentifier(schema, 'double', { foldsToLower: true })}.${name}`
  }

  const driver: Driver = {
    async test() {
      await connect()
      const result = await client.execute('SELECT release_version FROM system.local')
      const version = String(result.first()?.get('release_version') ?? '')
      return { serverVersion: `Cassandra ${version}`.trim() }
    },

    async schema() {
      await connect()
      const keyspace = config.cassandra?.keyspace
      const result = keyspace
        ? await client.execute(
            'SELECT keyspace_name, table_name, column_name, type, kind, position FROM system_schema.columns WHERE keyspace_name = ?',
            [keyspace],
            { prepare: true }
          )
        : await client.execute(
            'SELECT keyspace_name, table_name, column_name, type, kind, position FROM system_schema.columns'
          )
      const kindOrder = { partition_key: 0, clustering: 1, static: 2, regular: 3 } as Record<
        string,
        number
      >
      const rows: CatalogColumnRow[] = result.rows
        .filter((row) => !SYSTEM_KEYSPACES.includes(row.get('keyspace_name')))
        .sort(
          (a, b) =>
            String(a.get('keyspace_name')).localeCompare(String(b.get('keyspace_name'))) ||
            String(a.get('table_name')).localeCompare(String(b.get('table_name'))) ||
            (kindOrder[a.get('kind')] ?? 9) - (kindOrder[b.get('kind')] ?? 9) ||
            Number(a.get('position')) - Number(b.get('position'))
        )
        .map((row) => ({
          schema: row.get('keyspace_name'),
          table: row.get('table_name'),
          kind: 'table' as const,
          column: row.get('column_name'),
          type: row.get('type'),
          nullable: !['partition_key', 'clustering'].includes(row.get('kind')),
          isPrimaryKey: ['partition_key', 'clustering'].includes(row.get('kind')),
        }))
      const tables = buildTables(rows, [], qualify)
      const truncated = tables.length > SCHEMA_TABLE_LIMIT
      return { tables: truncated ? tables.slice(0, SCHEMA_TABLE_LIMIT) : tables, truncated }
    },

    async query(text, options) {
      const masked = assertReadOnlySql(text, 'cql')
      const statement = stripTrailingSemicolon(text, masked).trimEnd()
      canceled.delete(options.queryId)
      await connect()
      try {
        const result = await client.execute(statement, [], {
          prepare: false,
          autoPage: false,
          fetchSize: options.rowLimit + 1,
          readTimeout: Math.max(1000, options.timeoutMs),
        })
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
        const columns = (result.columns ?? []).map((column) => column.name)
        const rows = result.rows.map((row) => columns.map((name) => row.get(name)))
        const truncated = rows.length > options.rowLimit || !!result.pageState
        if (rows.length > options.rowLimit) rows.length = options.rowLimit
        return {
          columns: (result.columns ?? []).map((column) => ({ name: column.name })),
          rows: normalizeRows(rows),
          truncated,
          executedText: statement,
        }
      } catch (error) {
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
        if (error instanceof cassandra.errors.OperationTimedOutError) {
          throw new NqError(
            'TIMEOUT',
            `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
            {
              hint: 'Query by partition key, or add a LIMIT.',
            }
          )
        }
        throw error
      }
    },

    async cancel(queryId) {
      // The driver cannot interrupt a running request; the result is discarded.
      canceled.add(queryId)
    },

    async close() {
      await client.shutdown().catch(() => {})
    },
  }
  return driver
}
