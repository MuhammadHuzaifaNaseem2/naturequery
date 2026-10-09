import {
  BigQuery,
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
  type Job,
} from '@google-cloud/bigquery'
import { NqError } from '@shared/errors'
import { assertReadOnlySql, stripTrailingSemicolon } from '../safety/sql'
import { normalizeRows } from '../normalize'
import { buildTables, quoteIdentifier, type CatalogColumnRow } from './shared'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

/** Largest scan a single query may bill, so a mistake cannot run up a large bill. */
export const MAX_BYTES_BILLED = 50 * 1024 ** 3
const SCHEMA_DATASET_LIMIT = 50
const SCHEMA_CONCURRENCY = 4

/** "2026-01-02T03:04:05.120000Z" becomes "2026-01-02 03:04:05.12 UTC", as in the BigQuery console. */
export function formatTimestamp(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(iso)
  if (!match) return iso
  const fraction = (match[3] ?? '').replace(/0+$/, '')
  return `${match[1]} ${match[2]}${fraction ? `.${fraction}` : ''} UTC`
}

/** Unwraps the client's typed values into plain text, numbers and objects. */
export function bigQueryValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value ?? null
  if (value instanceof BigQueryInt) return value.value
  if (value instanceof BigQueryTimestamp) return formatTimestamp(value.value)
  if (
    value instanceof BigQueryDate ||
    value instanceof BigQueryDatetime ||
    value instanceof BigQueryTime ||
    value instanceof Geography
  ) {
    return value.value
  }
  if (depth > 8) return value
  if (Array.isArray(value)) return value.map((item) => bigQueryValue(item, depth + 1))
  if (Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, bigQueryValue(item, depth + 1)])
    )
  }
  // NUMERIC values (Big.js) and bytes are handled by normalizeValue.
  return value
}

interface ServiceAccountKey {
  project_id?: string
  client_email?: string
  private_key?: string
}

function parseKey(text: string | undefined): ServiceAccountKey | undefined {
  if (!text) return undefined
  try {
    return JSON.parse(text) as ServiceAccountKey
  } catch {
    throw new NqError('VALIDATION', 'The service account key file is not valid JSON.', {
      hint: 'Download a new JSON key for the service account from the Google Cloud console.',
    })
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

function bytesBilledError(error: unknown): NqError | null {
  const message = String((error as Error)?.message ?? '')
  if (!/bytes billed/i.test(message)) return null
  return new NqError(
    'DATABASE_ERROR',
    `This query would scan more than ${MAX_BYTES_BILLED / 1024 ** 3} GB, which is above NatureQuery's safety limit.`,
    {
      hint: 'Filter on the partition column, select fewer columns, or query a smaller date range.',
      detail: message,
    }
  )
}

/** Google BigQuery, using standard SQL. */
export const createBigQueryDriver: DriverFactory = (config, secrets) => {
  const key = parseKey(secrets.serviceAccountKey)
  const projectId = config.bigquery?.projectId || key?.project_id
  const location = config.bigquery?.location || undefined
  const client = new BigQuery({
    projectId,
    location,
    credentials: key ? { client_email: key.client_email, private_key: key.private_key } : undefined,
  })
  const running = new Map<string, Job>()
  const canceled = new Set<string>()

  function qualify(dataset: string | null | undefined, table: string): string {
    const name = quoteIdentifier(table, 'backtick')
    return dataset ? `${quoteIdentifier(dataset, 'backtick')}.${name}` : name
  }

  async function datasetColumns(
    dataset: string,
    datasetLocation?: string
  ): Promise<CatalogColumnRow[]> {
    const prefix = `\`${projectId}\`.${quoteIdentifier(dataset, 'backtick')}.INFORMATION_SCHEMA`
    const select = (withKeys: boolean) => `
      ${
        withKeys
          ? `WITH pk AS (
               SELECT k.table_name, k.column_name
               FROM ${prefix}.KEY_COLUMN_USAGE k
               JOIN ${prefix}.TABLE_CONSTRAINTS tc
                 ON tc.constraint_name = k.constraint_name AND tc.table_name = k.table_name
               WHERE tc.constraint_type = 'PRIMARY KEY')`
          : ''
      }
      SELECT c.table_name, t.table_type, c.column_name, c.data_type, c.is_nullable,
             ${withKeys ? 'pk.column_name IS NOT NULL' : 'FALSE'} AS is_key
      FROM ${prefix}.COLUMNS c
      JOIN ${prefix}.TABLES t ON t.table_name = c.table_name
      ${withKeys ? 'LEFT JOIN pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name' : ''}
      ORDER BY c.table_name, c.ordinal_position`
    type Row = {
      table_name: string
      table_type: string
      column_name: string
      data_type: string
      is_nullable: string
      is_key: boolean
    }
    let result
    try {
      ;[result] = await client.query({ query: select(true), location: datasetLocation })
    } catch {
      ;[result] = await client.query({ query: select(false), location: datasetLocation })
    }
    const rows = result as Row[]
    return rows.map((row) => ({
      schema: dataset,
      table: row.table_name,
      kind: /VIEW/i.test(row.table_type) ? 'view' : 'table',
      column: row.column_name,
      type: row.data_type.length > 200 ? `${row.data_type.slice(0, 200)}…` : row.data_type,
      nullable: row.is_nullable === 'YES',
      isPrimaryKey: !!row.is_key,
    }))
  }

  const driver: Driver = {
    async test() {
      // A dry run checks the credentials and the permission to run queries, for free.
      await client.createQueryJob({ query: 'SELECT 1', dryRun: true, location })
      return { serverVersion: `BigQuery (${projectId})` }
    },

    async schema() {
      const [datasets] = await client.getDatasets({ maxResults: SCHEMA_DATASET_LIMIT + 1 })
      const listed = datasets.slice(0, SCHEMA_DATASET_LIMIT)
      const perDataset = await mapLimit(listed, SCHEMA_CONCURRENCY, (dataset) =>
        datasetColumns(
          dataset.id ?? '',
          (dataset.metadata as { location?: string })?.location
        ).catch(() => [] as CatalogColumnRow[])
      )
      const tables = buildTables(perDataset.flat(), [], qualify)
      const truncated = datasets.length > SCHEMA_DATASET_LIMIT || tables.length > SCHEMA_TABLE_LIMIT
      return { tables: tables.slice(0, SCHEMA_TABLE_LIMIT), truncated }
    },

    async query(text, options) {
      const masked = assertReadOnlySql(text, 'bigquery')
      const query = stripTrailingSemicolon(text, masked).trimEnd()
      canceled.delete(options.queryId)
      const deadline = Date.now() + Math.max(1000, options.timeoutMs)
      let job: Job
      try {
        ;[job] = await client.createQueryJob({
          query,
          location,
          useLegacySql: false,
          maximumBytesBilled: String(MAX_BYTES_BILLED),
          jobTimeoutMs: Math.max(1000, options.timeoutMs),
          labels: { client: 'naturequery-desktop' },
        })
      } catch (error) {
        throw bytesBilledError(error) ?? error
      }
      running.set(options.queryId, job)
      const wanted = options.rowLimit + 1
      const rows: Record<string, unknown>[] = []
      let fields: { name?: string | null; type?: string | null; mode?: string | null }[] = []
      let pageToken: string | undefined
      try {
        for (;;) {
          if (canceled.has(options.queryId))
            throw new NqError('CANCELED', 'The query was canceled.')
          if (Date.now() > deadline) {
            await job.cancel().catch(() => {})
            throw new NqError(
              'TIMEOUT',
              `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
              {
                hint: 'Filter on the partition column or select fewer columns, or raise the time limit in Settings.',
              }
            )
          }
          const [page, , response] = await job.getQueryResults({
            autoPaginate: false,
            wrapIntegers: true,
            maxResults: wanted - rows.length,
            pageToken,
          })
          // The server waits about ten seconds per call while the query runs.
          if (response?.jobComplete === false) continue
          if (!fields.length) fields = response?.schema?.fields ?? []
          rows.push(...(page as Record<string, unknown>[]))
          pageToken = response?.pageToken ?? undefined
          if (!pageToken || rows.length >= wanted) break
        }
      } catch (error) {
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
        throw bytesBilledError(error) ?? error
      } finally {
        running.delete(options.queryId)
        canceled.delete(options.queryId)
      }
      const truncated = rows.length > options.rowLimit || !!pageToken
      if (rows.length > options.rowLimit) rows.length = options.rowLimit
      const names = fields.map((field) => field.name ?? '')
      return {
        columns: fields.map((field) => ({
          name: field.name ?? '',
          type:
            field.mode === 'REPEATED'
              ? `array<${String(field.type).toLowerCase()}>`
              : String(field.type ?? '').toLowerCase() || undefined,
        })),
        rows: normalizeRows(rows.map((row) => names.map((name) => bigQueryValue(row[name])))),
        truncated,
        executedText: query,
      }
    },

    async cancel(queryId) {
      const job = running.get(queryId)
      if (!job) return
      canceled.add(queryId)
      await job.cancel().catch(() => {})
    },

    async close() {
      for (const job of running.values()) await job.cancel().catch(() => {})
      running.clear()
    },
  }
  return driver
}
