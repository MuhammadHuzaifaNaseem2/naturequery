import type { DbType } from './db-types'

// ─── Connections ─────────────────────────────────────────────────────

/**
 * disable: plain TCP. prefer: try TLS, fall back to plain TCP.
 * require: TLS without certificate checks (self-signed servers).
 * verify-ca / verify-full: TLS with certificate (and host name) verification.
 */
export type TlsMode = 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full'

export interface TlsSettings {
  mode: TlsMode
  /** PEM file with the certificate authority used to verify the server. */
  caPath?: string
}

export interface SshSettings {
  enabled: boolean
  host: string
  port: number
  user: string
  auth: 'password' | 'key'
  /** Shown in the form; the key itself is stored encrypted. */
  privateKeyPath?: string
  /**
   * SHA-256 fingerprint of the SSH server's host key, remembered on first use.
   * A different key later means the server changed or someone is
   * impersonating it, so the connection is refused.
   */
  hostKeyFingerprint?: string
}

export interface SqlServerSettings {
  /** Named instance, for example SQLEXPRESS. Resolved by SQL Server Browser. */
  instance?: string
  auth: 'sql' | 'windows'
  /** Windows domain for NTLM sign-in. */
  domain?: string
  encrypt: boolean
  trustServerCertificate: boolean
}

export interface ConnectionConfig {
  id: string
  name: string
  type: DbType
  color?: string
  host?: string
  port?: number
  database?: string
  user?: string
  tls?: TlsSettings
  ssh?: SshSettings
  sqlserver?: SqlServerSettings
  oracle?: { connectAs: 'service' | 'sid' }
  sqlite?: { path: string }
  mongodb?: { useConnectionString: boolean; authSource?: string }
  clickhouse?: { protocol: 'http' | 'https' }
  snowflake?: {
    account: string
    warehouse?: string
    role?: string
    schema?: string
    /** password also covers programmatic access tokens. */
    auth?: 'password' | 'keypair'
    /** Shown in the form; the key itself is stored encrypted. */
    privateKeyPath?: string
  }
  bigquery?: { projectId: string; location?: string; keyFilePath?: string }
  dynamodb?: { region: string; endpoint?: string }
  firestore?: { projectId: string; keyFilePath?: string }
  cassandra?: { datacenter: string; keyspace?: string }
  turso?: { url: string }
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export const SECRET_KEYS = [
  'password',
  'connectionString',
  'sshPassword',
  'sshPrivateKey',
  'sshPassphrase',
  'serviceAccountKey',
  'authToken',
  'secretAccessKey',
  'caCertificate',
  'privateKey',
  'privateKeyPassphrase',
] as const

export type SecretKey = (typeof SECRET_KEYS)[number]
export type ConnectionSecrets = Partial<Record<SecretKey, string>>

/** What the renderer sees: never secret values, only whether each one is saved. */
export interface ConnectionInfo extends ConnectionConfig {
  savedSecrets: SecretKey[]
}

/**
 * Sent by the connection form. Secret values are written only when present;
 * `clearSecrets` removes saved values. Key and certificate files are read by
 * the main process from the chosen paths and stored encrypted.
 */
export interface ConnectionInput extends Omit<ConnectionConfig, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string
  secrets?: ConnectionSecrets
  clearSecrets?: SecretKey[]
  sshPrivateKeyPath?: string
  serviceAccountKeyPath?: string
  /** Snowflake key pair sign-in. */
  privateKeyPath?: string
}

export interface TestResult {
  ok: true
  /** For example "PostgreSQL 16.4". */
  serverVersion?: string
  latencyMs: number
  /** Host key fingerprint seen on the SSH server, to remember when saving. */
  sshHostKey?: string
}

// ─── Schema ──────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  defaultValue?: string | null
}

export interface ForeignKeyInfo {
  column: string
  referencedTable: string
  referencedColumn: string
}

export interface TableInfo {
  /** Schema, dataset or keyspace when the engine has one. */
  schema?: string
  name: string
  kind: 'table' | 'view' | 'collection'
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  /** Fully qualified, correctly quoted name to use in queries. */
  qualifiedName: string
  rowEstimate?: number
}

export interface SchemaSnapshot {
  tables: TableInfo[]
  fetchedAt: string
  /** True when a very large schema was cut short. */
  truncated?: boolean
}

// ─── Queries ─────────────────────────────────────────────────────────

export interface QueryRequest {
  connectionId: string
  /** SQL text, or a JSON query spec for MongoDB and Firestore. */
  text: string
  /** Lets the renderer cancel a running query. */
  queryId: string
  source: 'editor' | 'ai' | 'preview' | 'sample'
  question?: string
}

export interface ResultColumn {
  name: string
  type?: string
}

export interface QueryResult {
  columns: ResultColumn[]
  /** Values in column order. Arrays keep duplicate column names distinct. */
  rows: unknown[][]
  rowCount: number
  truncated: boolean
  durationMs: number
  /** Final text sent to the database after safety limits were applied. */
  executedText: string
  notice?: string
}

// ─── Errors ──────────────────────────────────────────────────────────

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'READ_ONLY'
  | 'CONNECTION_REFUSED'
  | 'HOST_NOT_FOUND'
  | 'TIMEOUT'
  | 'AUTH_FAILED'
  | 'TLS'
  | 'SSH'
  | 'DATABASE_ERROR'
  | 'CANCELED'
  | 'SECURE_STORAGE'
  | 'ENGINE_CRASHED'
  | 'NETWORK'
  | 'SIGNED_OUT'
  | 'PLAN_LIMIT'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'UNSUPPORTED'
  | 'UNKNOWN'

export interface AppError {
  code: ErrorCode
  message: string
  /** Practical next step for the user. */
  hint?: string
  /** Original driver message, shown under "Details". */
  detail?: string
}

export type Envelope<T> = { ok: true; value: T } | { ok: false; error: AppError }

// ─── Settings ────────────────────────────────────────────────────────

export type ThemeName = 'system' | 'light' | 'dark' | 'dim' | 'forest'

export interface Settings {
  theme: ThemeName
  rowLimit: number
  queryTimeoutSeconds: number
  editorFontSize: number
  /** Show AI-generated SQL for review before running it. */
  reviewAiSql: boolean
  /** Allow up to five sample rows to be sent when asking the AI for a chart. */
  shareSampleRowsForCharts: boolean
  checkForUpdates: boolean
  onboardingCompleted: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dim',
  rowLimit: 1000,
  queryTimeoutSeconds: 60,
  editorFontSize: 13,
  reviewAiSql: false,
  shareSampleRowsForCharts: false,
  checkForUpdates: true,
  onboardingCompleted: false,
}

export const ROW_LIMIT_CHOICES = [100, 1000, 5000, 10000, 50000] as const
export const TIMEOUT_CHOICES = [15, 30, 60, 120, 300] as const

// ─── History and saved queries ───────────────────────────────────────

export interface HistoryEntry {
  id: string
  connectionId: string
  connectionName: string
  text: string
  question?: string
  source: QueryRequest['source']
  status: 'success' | 'error' | 'canceled'
  rowCount?: number
  durationMs?: number
  error?: string
  createdAt: string
}

export interface HistoryQuery {
  search?: string
  connectionId?: string
  limit?: number
  before?: string
}

export interface SavedQuery {
  id: string
  name: string
  connectionId?: string
  text: string
  question?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface SavedQueryInput {
  id?: string
  name: string
  connectionId?: string
  text: string
  question?: string
  description?: string
}

// ─── Export ──────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'xlsx' | 'json'

export interface ExportRequest {
  format: ExportFormat
  columns: string[]
  rows: unknown[][]
  suggestedName: string
}

export type ExportOutcome = { saved: true; path: string } | { saved: false }

// ─── Account and AI ──────────────────────────────────────────────────

export interface AccountUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

export interface PlanUsage {
  planName: string
  /** -1 means unlimited. */
  queryLimit: number
  queriesUsed: number
  periodEndsAt?: string
}

export type AuthState =
  /** `error` explains why a sign-in attempt ended, when it did not succeed. */
  | { status: 'signed-out'; error?: string }
  | { status: 'pending'; startedAt: string; authorizeUrl: string }
  | { status: 'signed-in'; user: AccountUser; plan?: PlanUsage }

export interface ConversationTurn {
  question: string
  sql: string
  rowCount?: number
}

export interface GenerateRequest {
  connectionId: string
  question: string
  conversation?: ConversationTurn[]
}

export type GenerateResult =
  | { kind: 'query'; sql: string; plan?: PlanUsage }
  /** The AI needs more detail before it can write a query. */
  | { kind: 'clarify'; message: string }
  /** The request asked to change data, which NatureQuery never does. */
  | { kind: 'refused'; message: string }

export interface FixRequest {
  connectionId: string
  question: string
  failedSql: string
  errorMessage: string
}

export interface ExplainRequest {
  connectionId: string
  sql: string
}

export interface InsightsRequest {
  question: string
  sql: string
  columns: string[]
  /** Sent to the AI only when the user allows sharing result rows. */
  rows: unknown[][]
  rowCount: number
}

export interface ExplainResult {
  explanation: string
}

export interface InsightsResult {
  summary: string
  highlights: string[]
}

// ─── App and updates ─────────────────────────────────────────────────

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  arch: string
  packaged: boolean
  electron: string
  userDataPath: string
  apiBaseUrl: string
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'unavailable'; checkedAt: string }
  | { state: 'available'; version: string; notes?: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
  | { state: 'disabled'; reason: string }

export type MenuCommand =
  | 'new-connection'
  | 'new-query'
  | 'open-settings'
  | 'open-history'
  | 'toggle-sidebar'
  | 'command-palette'
  | 'run-query'
  | 'show-shortcuts'
