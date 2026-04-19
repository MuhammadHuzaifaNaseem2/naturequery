import { NextRequest } from 'next/server'
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { ExecuteQueryApiSchema, validateInput, type ExecuteQueryApiInput } from '@/lib/validation'
import { checkAndRecordQuery, maybeNotifyQueryThreshold } from '@/lib/plan-limits'
import { decrypt } from '@/lib/encryption'
import { type DatabaseType, MAX_QUERY_ROWS } from '@/lib/db-drivers'
import { validateSQLSafety, ensureLimitClause } from '@/lib/sql-validator'
import { rateLimitAsync } from '@/lib/rate-limit'
import { getOrCreateDriver } from '@/lib/driver-pool'
import { auditQueryExecuted } from '@/lib/audit-immutable'

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  // Stricter per-endpoint limit: execute hits a real database — cap at 20/min
  const executeLimit = await rateLimitAsync(`api:execute:${userId}`, { maxRequests: 20, windowSeconds: 60 })
  if (!executeLimit.allowed) {
    return apiError(`Execute rate limit exceeded. Max 20 query executions per minute. Retry in ${executeLimit.retryAfterSeconds}s.`, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const validation = validateInput(ExecuteQueryApiSchema, body)
  if (!validation.success) {
    return apiError(validation.error, 400)
  }

  const { connectionId, sql } = validation.data as ExecuteQueryApiInput

  // Check plan limits (atomic check + record)
  const limitCheck = await checkAndRecordQuery(userId)
  if (!limitCheck.allowed) {
    return apiError(
      `Query limit reached (${limitCheck.current}/${limitCheck.limit} this month). Upgrade your plan for more queries.`,
      403
    )
  }

  // Get connection (must belong to user or their team)
  const userTeams = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } })
  const teamIds = userTeams.map(t => t.teamId)
  const conn = await prisma.databaseConnection.findFirst({
    where: {
      id: connectionId,
      OR: [{ userId }, { teamId: { in: teamIds } }],
    },
  })
  if (!conn) {
    return apiError('Connection not found', 404)
  }

  let decryptedPassword: string
  try {
    decryptedPassword = decrypt(conn.password)
  } catch {
    return apiError('Could not decrypt connection credentials. Please delete and re-add this connection.', 500)
  }

  const credentials = {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: decryptedPassword,
    dbType: conn.dbType as DatabaseType,
  }

  // Enforce SELECT-only — prevent data destruction
  const sqlCheck = validateSQLSafety(sql, credentials.dbType)
  if (!sqlCheck.valid) {
    return apiError(sqlCheck.error || 'Only SELECT queries are allowed.', 400)
  }

  // Inject LIMIT to prevent massive table scans
  const safeSql = ensureLimitClause(sql, MAX_QUERY_ROWS, credentials.dbType)

  const driver = getOrCreateDriver(credentials, credentials.dbType)
  const startTime = Date.now()

  try {
    const result = await driver.executeQuery(safeSql)
    const executionTime = Date.now() - startTime

    // Usage already recorded atomically in checkAndRecordQuery above
    maybeNotifyQueryThreshold(userId).catch(() => {})

    // Fire-and-forget audit trail
    auditQueryExecuted(userId, connectionId, {
      question: sql.slice(0, 500),
      rowCount: result.rowCount,
      executionTimeMs: executionTime,
    }).catch(() => {})

    return apiSuccess({
      rows: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      executionTime,
      truncated: result.truncated,
    })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Query execution failed',
      500
    )
  }
  // NOTE: No driver.close() — the pool manages the lifecycle
}
