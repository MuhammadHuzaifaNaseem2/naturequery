'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'
import { checkPlanLimits, checkAndRecordQuery, maybeNotifyQueryThreshold } from '@/lib/plan-limits'
import { createDriver, getMaxRows } from '@/lib/db-drivers'
import type { DatabaseType } from '@/lib/db-drivers'
import type {
  ExecuteSQLResult,
  FetchSchemaResult,
  TestConnectionResult,
  DatabaseSchema,
} from './db'
import { validateSQLSafety, ensureLimitClause } from '@/lib/sql-validator'
import {
  getCachedQuery,
  setCachedQuery,
  getCachedSchema,
  setCachedSchema,
  invalidateConnectionCache,
  invalidateSchemaCache,
} from '@/lib/query-cache'
import { requireTeamPermission } from '@/lib/permissions'
import { rateLimitAsync } from '@/lib/rate-limit'
import { getOrCreateDriver } from '@/lib/driver-pool'
import { auditQueryExecuted } from '@/lib/audit-immutable'
import { validateInput, DBCredentialsSchema, IdSchema } from '@/lib/validation'

// --- Types ---

interface SaveConnectionInput {
  name: string
  host: string
  port: number
  database: string
  user: string
  password: string
  dbType?: string
  ssl?: boolean
  teamId?: string
}

export interface ConnectionInfo {
  id: string
  name: string
  host: string
  port: number
  database: string
  user: string
  dbType: string
  ssl: boolean
  isActive: boolean
  createdAt: string
  teamId?: string | null
  teamName?: string
}

// --- Helpers ---

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user
}

async function getOwnedConnection(userId: string, connectionId: string) {
  if (!connectionId) return null

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const conn = await prisma.databaseConnection.findUnique({
    where: { id: connectionId },
    include: { team: { include: { members: true } } },
  })

  if (!conn) {
    return null
  }

  // Allow Admin to access any connection
  if (user?.role === 'ADMIN') {
    return conn
  }

  if (conn.userId === userId) {
    return conn
  }

  // Check if connection is shared with user's team
  if (conn.teamId) {
    const isMember = conn.team?.members.some((m) => m.userId === userId)
    if (isMember) return conn
  }

  return null
}

function decryptCredentials(conn: {
  host: string
  port: number
  database: string
  user: string
  password: string
  dbType: string
}) {
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: decrypt(conn.password),
    dbType: conn.dbType as DatabaseType,
  }
}

// --- CRUD ---

export async function saveConnection(
  input: SaveConnectionInput
): Promise<{ success: boolean; connection?: ConnectionInfo; error?: string }> {
  try {
    const user = await requireUser()

    // Rate limit: 10 connection actions per minute
    const rl = await rateLimitAsync(`conn_create:${user.id}`, {
      maxRequests: 10,
      windowSeconds: 60,
    })
    if (!rl.allowed)
      return { success: false, error: `Too many attempts. Please wait ${rl.retryAfterSeconds}s.` }

    // Runtime validation
    const validated = validateInput(DBCredentialsSchema, input)
    if (!validated.success) return { success: false, error: validated.error }
    const data = validated.data

    // If adding to a team, only OWNER/ADMIN may create team connections
    if (data.teamId) {
      await requireTeamPermission(data.teamId, 'connection:create')
    }

    // Check plan limits
    const limitCheck = await checkPlanLimits(user.id, 'CONNECTION_ADD')
    if (!limitCheck.allowed) {
      return {
        success: false,
        error:
          limitCheck.limit === 0
            ? 'Database connections require a paid plan. Upgrade to add connections.'
            : `Connection limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more connections.`,
      }
    }

    const encryptedPassword = encrypt(data.password)

    const conn = await prisma.databaseConnection.create({
      data: {
        name: data.name,
        host: data.host,
        port: data.port,
        database: data.database,
        user: data.user,
        password: encryptedPassword,
        dbType: data.dbType || 'postgresql',
        ssl: data.ssl || false,
        userId: data.teamId ? null : user.id,
        teamId: data.teamId || null,
      },
    })

    return {
      success: true,
      connection: {
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.user,
        dbType: conn.dbType,
        ssl: conn.ssl,
        isActive: conn.isActive,
        createdAt: conn.createdAt.toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save connection',
    }
  }
}

export async function getUserConnections(): Promise<ConnectionInfo[]> {
  const user = await requireUser()

  // Get user role with a fresh fetch or extended session
  // Since requireUser returns the session user which might be stale in some cases,
  // but usually session updates. Let's trust session.user.role if available,
  // or fetch user to be safe if strictly needed.
  // Ideally requireUser should return the full user or we fetch it.

  // Let's fetch the full user to check role securely
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  })

  let connections
  if (dbUser?.role === 'ADMIN') {
    connections = await prisma.databaseConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { name: true } } },
    })
  } else {
    // get user teams
    const userTeams = await prisma.teamMember.findMany({
      where: { userId: user.id },
      select: { teamId: true },
    })
    const teamIds = userTeams.map((t) => t.teamId)

    connections = await prisma.databaseConnection.findMany({
      where: {
        OR: [{ userId: user.id }, { teamId: { in: teamIds } }],
      },
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { name: true } } },
    })
  }

  return connections.map((c: any) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
    dbType: c.dbType,
    ssl: c.ssl,
    isActive: c.isActive,
    teamId: c.teamId,
    teamName: c.team?.name,
    createdAt: c.createdAt.toISOString(),
  }))
}

export async function deleteConnection(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser()

    // Rate limit
    const rl = await rateLimitAsync(`conn_delete:${user.id}`, {
      maxRequests: 20,
      windowSeconds: 60,
    })
    if (!rl.allowed) return { success: false, error: 'Too many requests' }

    // Validation
    if (!IdSchema.safeParse(connectionId).success) {
      return { success: false, error: 'Invalid connection ID' }
    }

    const conn = await getOwnedConnection(user.id, connectionId)
    if (!conn) return { success: false, error: 'Connection not found' }

    // Team connections: only OWNER/ADMIN may delete
    if (conn.teamId) {
      await requireTeamPermission(conn.teamId, 'connection:delete')
    }

    await prisma.databaseConnection.delete({
      where: { id: connectionId },
    })

    // Invalidate both query and schema caches for this connection (fire-and-forget)
    Promise.all([
      invalidateConnectionCache(connectionId),
      invalidateSchemaCache(connectionId),
    ]).catch(() => {})

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete connection',
    }
  }
}

// --- Server-side operations (credentials never leave server) ---

export async function fetchSchemaByConnection(connectionId: string): Promise<FetchSchemaResult> {
  const user = await requireUser()
  const conn = await getOwnedConnection(user.id, connectionId)
  if (!conn) return { success: false, error: 'Connection not found' }

  let credentials: ReturnType<typeof decryptCredentials>
  try {
    credentials = decryptCredentials(conn)
  } catch {
    return {
      success: false,
      error:
        'Could not decrypt connection credentials. The encryption key may have changed. Please delete and re-add this connection.',
    }
  }

  // Check schema cache first (TTL: 1 hour)
  const cached = await getCachedSchema<DatabaseSchema>(connectionId)
  if (cached) {
    return { success: true, data: cached }
  }

  const driver = createDriver(credentials, credentials.dbType)
  try {
    const tables = await driver.fetchSchema()
    const schema = { tables }
    // Cache async — don't block the response
    setCachedSchema(connectionId, schema).catch(() => {})
    return { success: true, data: schema }
  } catch (error) {
    console.error(
      `[fetchSchemaByConnection] ${credentials.dbType} ${credentials.host}:${credentials.port}/${credentials.database}:`,
      error
    )
    const msg =
      error instanceof Error
        ? error.message || (error as any).code || error.toString()
        : String(error)
    return {
      success: false,
      error: msg || 'Failed to fetch schema (unknown driver error)',
    }
  } finally {
    await driver.close().catch(() => {})
  }
}

/**
 * Force-refresh the schema for a connection: clears Redis + query cache, refetches live.
 */
export async function refreshSchemaByConnection(connectionId: string): Promise<FetchSchemaResult> {
  const user = await requireUser()
  const conn = await getOwnedConnection(user.id, connectionId)
  if (!conn) return { success: false, error: 'Connection not found' }

  let credentials: ReturnType<typeof decryptCredentials>
  try {
    credentials = decryptCredentials(conn)
  } catch {
    return {
      success: false,
      error: 'Could not decrypt connection credentials.',
    }
  }

  // Invalidate both schema and query caches for this connection
  await Promise.all([invalidateSchemaCache(connectionId), invalidateConnectionCache(connectionId)])

  const driver = createDriver(credentials, credentials.dbType)
  try {
    const tables = await driver.fetchSchema()
    const schema = { tables }
    setCachedSchema(connectionId, schema).catch(() => {})
    return { success: true, data: schema }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch schema',
    }
  } finally {
    await driver.close().catch(() => {})
  }
}

export async function testConnectionById(connectionId: string): Promise<TestConnectionResult> {
  const user = await requireUser()
  const conn = await getOwnedConnection(user.id, connectionId)
  if (!conn) return { success: false, error: 'Connection not found' }

  // Team connections: only OWNER/ADMIN may test (MEMBER/VIEWER cannot)
  if (conn.teamId) {
    await requireTeamPermission(conn.teamId, 'connection:test')
  }

  let credentials: ReturnType<typeof decryptCredentials>
  try {
    credentials = decryptCredentials(conn)
  } catch {
    return {
      success: false,
      error:
        'Could not decrypt connection credentials. The encryption key may have changed. Please delete and re-add this connection.',
    }
  }

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

export async function executeSQLByConnection(
  connectionId: string,
  sql: string
): Promise<ExecuteSQLResult> {
  const user = await requireUser()

  // Per-minute rate limiting (30 req/min per user)
  const rl = await rateLimitAsync(`query:${user.id}`, {
    maxRequests: 30,
    windowSeconds: 60,
  })
  if (!rl.allowed) {
    return {
      success: false,
      error: `Too many queries. Please wait ${rl.retryAfterSeconds}s before trying again.`,
    }
  }

  // Plan limit check (atomic check + record)
  const limitCheck = await checkAndRecordQuery(user.id)
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `Query limit reached (${limitCheck.current}/${limitCheck.limit} this month). Upgrade your plan for more queries.`,
    }
  }

  const conn = await getOwnedConnection(user.id, connectionId)
  if (!conn) return { success: false, error: 'Connection not found' }

  let credentials: ReturnType<typeof decryptCredentials>
  try {
    credentials = decryptCredentials(conn)
  } catch {
    return {
      success: false,
      error:
        'Could not decrypt connection credentials. The encryption key may have changed. Please delete and re-add this connection.',
    }
  }

  // Enforce SELECT-only — prevent data destruction
  const sqlCheck = validateSQLSafety(sql, credentials.dbType)
  if (!sqlCheck.valid) {
    return { success: false, error: sqlCheck.error }
  }

  // Inject LIMIT to prevent massive table scans
  const maxRows = getMaxRows(user.role)
  const safeSql = ensureLimitClause(sql, maxRows, credentials.dbType)

  const driver = getOrCreateDriver(credentials, credentials.dbType)
  const startTime = Date.now()

  try {
    // 1. Check Redis Cache first (massive performance boost)
    const cachedResult = await getCachedQuery<{
      rows: Record<string, unknown>[]
      fields: string[]
      rowCount: number
      executionTime: number
    }>(connectionId, sql)
    if (cachedResult) {
      return {
        success: true,
        data: {
          ...cachedResult,
          executionTime: Date.now() - startTime || 2,
        },
      }
    }

    // 2. Cache miss -> Execute on real database
    const result = await driver.executeQuery(safeSql, maxRows)
    const executionTime = Date.now() - startTime

    // Usage already recorded atomically in checkAndRecordQuery above
    maybeNotifyQueryThreshold(user.id).catch(() => {})

    // Fire-and-forget audit trail
    auditQueryExecuted(user.id, connectionId, {
      question: sql.slice(0, 500),
      rowCount: result.rowCount,
      executionTimeMs: executionTime,
    }).catch(() => {})

    const dataPayload = {
      rows: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      executionTime,
      truncated: result.truncated,
    }

    // 3. Save to Redis Cache (async fire-and-forget so we don't block return)
    setCachedQuery(connectionId, sql, dataPayload, 300).catch(() => {})

    return {
      success: true,
      data: dataPayload,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed',
    }
  }
  // NOTE: No driver.close() — the pool manages the lifecycle
}
