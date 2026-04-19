'use server'

import { createDriver, type DatabaseType, MAX_QUERY_ROWS } from '@/lib/db-drivers'
import { getOrCreateDriver } from '@/lib/driver-pool'
import { auth } from '@/lib/auth'
import { checkAndRecordQuery, maybeNotifyQueryThreshold } from '@/lib/plan-limits'
import { validateSQLSafety, ensureLimitClause } from '@/lib/sql-validator'
import { rateLimitAsync } from '@/lib/rate-limit'
import { auditQueryExecuted } from '@/lib/audit-immutable'

export interface DBCredentials {
  host: string
  port: number
  database: string
  user: string
  password: string
  dbType?: DatabaseType
  teamId?: string
}

export interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

export interface ForeignKey {
  column: string
  referencedTable: string
  referencedColumn: string
}

export interface TableSchema {
  tableName: string
  columns: ColumnDefinition[]
  foreignKeys?: ForeignKey[]
}

export interface DatabaseSchema {
  tables: TableSchema[]
}

export interface FetchSchemaResult {
  success: boolean
  data?: DatabaseSchema
  error?: string
}

export interface TestConnectionResult {
  success: boolean
  message?: string
  error?: string
}

export interface QueryResultRow {
  [key: string]: unknown
}

export interface ExecuteSQLResult {
  success: boolean
  data?: {
    rows: QueryResultRow[]
    fields: string[]
    rowCount: number
    executionTime: number
    /** True when the result was capped at the row limit (1,000 rows) */
    truncated?: boolean
  }
  error?: string
}

/**
 * Test database connection with provided credentials
 */
export async function testConnection(credentials: DBCredentials): Promise<TestConnectionResult> {
  // testConnection always creates a fresh driver (not pooled)
  // because we need to verify the credentials actually work
  const driver = createDriver(credentials, credentials.dbType)

  try {
    await driver.testConnection()
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  } finally {
    await driver.close().catch(() => {})
  }
}

/**
 * Fetch database schema (tables and columns) using provided credentials
 */
export async function fetchSchema(credentials: DBCredentials): Promise<FetchSchemaResult> {
  const driver = getOrCreateDriver(credentials, credentials.dbType)

  try {
    const tables = await driver.fetchSchema()
    return { success: true, data: { tables } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch schema',
    }
  }
  // NOTE: No driver.close() — the pool manages the lifecycle
}

/**
 * Execute a SQL query and return results as an array of objects.
 *
 * Security layers (in order):
 *  1. Authentication check
 *  2. Per-minute rate limiting (30 req/min per user)
 *  3. Monthly plan quota check
 *  4. SQL safety validation (SELECT-only, no destructive keywords)
 *  5. LIMIT clause injection (prevents massive table scans)
 *  6. DB-level statement timeout (30s)
 *  7. Row-count cap (1,000 rows post-fetch)
 *  8. Audit trail write (SHA-256 hash chain)
 */
export async function executeSQL(
  credentials: DBCredentials,
  sql: string,
  connectionId?: string
): Promise<ExecuteSQLResult> {
  // ── 1. Auth ──────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  // ── 2. Per-minute rate limiting ──────────────────────────────────
  const rl = await rateLimitAsync(`query:${session.user.id}`, {
    maxRequests: 30,
    windowSeconds: 60,
  })
  if (!rl.allowed) {
    return {
      success: false,
      error: `Too many queries. Please wait ${rl.retryAfterSeconds}s before trying again.`,
    }
  }

  // ── 3. Plan quota (atomic check + record) ────────────────────────
  const limitCheck = await checkAndRecordQuery(session.user.id)
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `Query limit reached (${limitCheck.current}/${limitCheck.limit} this month). Upgrade your plan for more queries.`,
    }
  }

  // ── 4. SQL safety ────────────────────────────────────────────────
  const sqlCheck = validateSQLSafety(sql, credentials.dbType)
  if (!sqlCheck.valid) {
    return { success: false, error: sqlCheck.error }
  }

  // ── 5. LIMIT injection ──────────────────────────────────────────
  const safeSql = ensureLimitClause(sql, MAX_QUERY_ROWS, credentials.dbType)

  // ── 6–7. Execute with pooled driver ─────────────────────────────
  const driver = getOrCreateDriver(credentials, credentials.dbType)
  const startTime = Date.now()

  try {
    const result = await driver.executeQuery(safeSql)
    const executionTime = Date.now() - startTime

    // Usage already recorded atomically in checkAndRecordQuery above
    maybeNotifyQueryThreshold(session.user.id).catch(() => {})

    // ── 8. Audit trail ───────────────────────────────────────────
    auditQueryExecuted(session.user.id, connectionId ?? 'unknown', {
      question: sql.slice(0, 500), // cap at 500 chars
      rowCount: result.rowCount,
      executionTimeMs: executionTime,
    }).catch(() => {}) // fire-and-forget, never block the user

    return {
      success: true,
      data: {
        rows: result.rows,
        fields: result.fields,
        rowCount: result.rowCount,
        executionTime,
        truncated: result.truncated,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed',
    }
  }
  // NOTE: No driver.close() — the pool manages the lifecycle
}
