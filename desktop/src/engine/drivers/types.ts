import type { ConnectionConfig, ConnectionSecrets, ResultColumn, TableInfo } from '@shared/types'

export interface QueryOptions {
  rowLimit: number
  timeoutMs: number
  queryId: string
}

export interface DriverQueryResult {
  columns: ResultColumn[]
  rows: unknown[][]
  truncated: boolean
  executedText: string
  notice?: string
}

export interface Driver {
  test(): Promise<{ serverVersion?: string }>
  schema(): Promise<{ tables: TableInfo[]; truncated?: boolean }>
  query(text: string, options: QueryOptions): Promise<DriverQueryResult>
  /** Interrupts a running query started with this queryId, if any. */
  cancel(queryId: string): Promise<void>
  close(): Promise<void>
}

/** Where the driver should connect; differs from config.host behind an SSH tunnel. */
export interface Endpoint {
  host: string
  port: number
  /** The real server name, for TLS host checks when tunneled. */
  servername?: string
}

export interface DriverContext {
  endpoint?: Endpoint
  connectTimeoutMs: number
}

export type DriverFactory = (
  config: ConnectionConfig,
  secrets: ConnectionSecrets,
  context: DriverContext
) => Driver

/** Maximum number of tables and views loaded into the schema browser. */
export const SCHEMA_TABLE_LIMIT = 5000
