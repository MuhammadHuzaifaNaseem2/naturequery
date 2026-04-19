'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { createDriver } from '@/lib/db-drivers'
import { PLANS } from '@/lib/stripe'
import { rateLimitAsync } from '@/lib/rate-limit'
import { validateInput, UpdateUserRoleSchema, IdSchema } from '@/lib/validation'
import type { DatabaseType } from '@/lib/db-drivers'
import type { TestConnectionResult } from './db'

// --- Types ---

export interface AdminConnectionInfo {
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
  ownerName: string | null
  ownerEmail: string | null
}

export interface AdminTestResult {
  connectionId: string
  connectionName: string
  success: boolean
  message?: string
  error?: string
}

export interface AdminStats {
  totalUsers: number
  totalConnections: number
  activeConnections: number
  totalQueries: number
  queriesThisMonth: number
  estimatedMRR: number
  planDistribution: { plan: string; count: number }[]
  connectionHealthPercent: number
  newUsersThisWeek: number
  newUsersLastWeek: number
  twoFactorCount: number
}

export interface QueryVolumePoint {
  date: string
  count: number
}

export interface UserGrowthPoint {
  date: string
  count: number
}

export interface AdminUserInfo {
  id: string
  email: string
  name: string | null
  role: string
  twoFactorEnabled: boolean
  onboardingCompleted: boolean
  createdAt: string
  plan: string
  planStatus: string
  queryCount: number
  connectionCount: number
}

export interface AdminUserFilters {
  search?: string
  role?: string
  plan?: string
  page?: number
  pageSize?: number
}

export interface ActivityItem {
  id: string
  action: string
  resource: string | null
  userName: string | null
  userEmail: string | null
  createdAt: string
  metadata: any
}

export interface TopUser {
  userId: string
  name: string | null
  email: string
  queryCount: number
  plan: string
}

export interface PerformanceStats {
  avgExecutionTime: number
  slowQueryCount: number
  totalQueries: number
  latencyTrend: { date: string; avg: number }[]
}

export interface SlowQueryLog {
  id: string
  duration: number
  query: string
  createdAt: string
  userId?: string
  userEmail?: string
}

// --- Helpers ---

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  if (session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required')
  }

  return session.user
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

// --- Admin Actions ---

export async function getAdminAllConnections(): Promise<{
  success: boolean
  connections?: AdminConnectionInfo[]
  error?: string
}> {
  try {
    await requireAdmin()

    const connections = await prisma.databaseConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    const mappedConnections: AdminConnectionInfo[] = connections.map((c) => ({
      id: c.id,
      name: c.name,
      host: c.host,
      port: c.port,
      database: c.database,
      user: c.user,
      dbType: c.dbType,
      ssl: c.ssl,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      ownerName: c.owner?.name ?? null,
      ownerEmail: c.owner?.email ?? null,
    }))

    return { success: true, connections: mappedConnections }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch connections',
    }
  }
}

export async function adminTestConnectionById(connectionId: string): Promise<TestConnectionResult> {
  try {
    await requireAdmin()

    const conn = await prisma.databaseConnection.findUnique({
      where: { id: connectionId },
    })

    if (!conn) {
      throw new Error('Connection not found')
    }

    const credentials = decryptCredentials(conn)
    const driver = createDriver(credentials, credentials.dbType as DatabaseType)

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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test connection',
    }
  }
}

export async function adminTestAllConnections(): Promise<{
  success: boolean
  results?: AdminTestResult[]
  error?: string
}> {
  try {
    await requireAdmin()

    const connections = await prisma.databaseConnection.findMany()

    const results: AdminTestResult[] = []

    // Test in parallel but maybe limit concurrency if needed?
    // For now, let's just Promise.all. If there are too many, we might need a queue.
    // Assuming a reasonable number of connections for now.

    const testPromises = connections.map(async (conn) => {
      let result: AdminTestResult = {
        connectionId: conn.id,
        connectionName: conn.name,
        success: false,
      }

      try {
        const credentials = decryptCredentials(conn)
        const driver = createDriver(credentials, credentials.dbType as DatabaseType)
        await driver.testConnection()
        result.success = true
        result.message = 'Connected'
        await driver.close().catch(() => {})
      } catch (err) {
        result.success = false
        result.error = err instanceof Error ? err.message : 'Unknown error'
      }
      return result
    })

    const completedResults = await Promise.all(testPromises)
    return { success: true, results: completedResults }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test all connections',
    }
  }
}

// --- Dashboard Stats ---

export async function getAdminStats(): Promise<{
  success: boolean
  data?: AdminStats
  error?: string
}> {
  try {
    await requireAdmin()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)
    const startOfLastWeek = new Date(now)
    startOfLastWeek.setDate(now.getDate() - 14)

    const [
      totalUsers,
      totalConnections,
      activeConnections,
      totalQueries,
      queriesThisMonth,
      newUsersThisWeek,
      newUsersLastWeek,
      twoFactorCount,
      planGroups,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.databaseConnection.count(),
      prisma.databaseConnection.count({ where: { isActive: true } }),
      prisma.usageRecord.count({ where: { action: 'QUERY' } }),
      prisma.usageRecord.count({ where: { action: 'QUERY', createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastWeek, lt: startOfWeek } } }),
      prisma.user.count({ where: { twoFactorEnabled: true } }),
      prisma.subscription.groupBy({
        by: ['plan'],
        orderBy: { plan: 'asc' },
        _count: { _all: true },
      }),
    ])

    const planDistribution = planGroups.map((g) => {
      const cnt = g._count
      const num = typeof cnt === 'object' && cnt !== null && '_all' in cnt ? (cnt._all ?? 0) : 0
      return { plan: g.plan, count: num }
    })

    // Calculate MRR from plan distribution
    let estimatedMRR = 0
    for (const pd of planDistribution) {
      const planKey = pd.plan as keyof typeof PLANS
      if (PLANS[planKey]) {
        estimatedMRR += pd.count * (PLANS[planKey].price / 100)
      }
    }

    const connectionHealthPercent =
      totalConnections > 0 ? Math.round((activeConnections / totalConnections) * 100) : 100

    return {
      success: true,
      data: {
        totalUsers,
        totalConnections,
        activeConnections,
        totalQueries,
        queriesThisMonth,
        estimatedMRR,
        planDistribution,
        connectionHealthPercent,
        newUsersThisWeek,
        newUsersLastWeek,
        twoFactorCount,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    }
  }
}

export async function getQueryVolume(
  days: number = 30
): Promise<{ success: boolean; data?: QueryVolumePoint[]; error?: string }> {
  try {
    await requireAdmin()

    const since = new Date()
    since.setDate(since.getDate() - days)

    const raw = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
            SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
            FROM "UsageRecord"
            WHERE action = 'QUERY' AND "createdAt" >= ${since}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `

    // Build a map of existing data
    const dataMap = new Map<string, number>()
    for (const r of raw) {
      dataMap.set(new Date(r.date).toISOString().split('T')[0], Number(r.count))
    }

    // Fill missing dates with 0
    const result: QueryVolumePoint[] = []
    const cursor = new Date(since)
    const today = new Date()
    while (cursor <= today) {
      const key = cursor.toISOString().split('T')[0]
      result.push({ date: key, count: dataMap.get(key) || 0 })
      cursor.setDate(cursor.getDate() + 1)
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch query volume',
    }
  }
}

export async function getUserGrowth(
  days: number = 30
): Promise<{ success: boolean; data?: UserGrowthPoint[]; error?: string }> {
  try {
    await requireAdmin()

    const since = new Date()
    since.setDate(since.getDate() - days)

    const raw = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
            SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
            FROM "User"
            WHERE "createdAt" >= ${since}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `

    const dataMap = new Map<string, number>()
    for (const r of raw) {
      dataMap.set(new Date(r.date).toISOString().split('T')[0], Number(r.count))
    }

    const result: UserGrowthPoint[] = []
    const cursor = new Date(since)
    const today = new Date()
    while (cursor <= today) {
      const key = cursor.toISOString().split('T')[0]
      result.push({ date: key, count: dataMap.get(key) || 0 })
      cursor.setDate(cursor.getDate() + 1)
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user growth',
    }
  }
}

// --- User Management ---

export async function getAdminUsers(filters?: AdminUserFilters): Promise<{
  success: boolean
  data?: { users: AdminUserInfo[]; total: number; page: number; totalPages: number }
  error?: string
}> {
  try {
    await requireAdmin()

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: any = {}
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ]
    }
    if (filters?.role) {
      where.role = filters.role
    }
    if (filters?.plan) {
      where.subscription = { plan: filters.plan }
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { select: { plan: true, status: true } },
          _count: { select: { connections: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    // Get query counts for this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const queryCounts = await prisma.usageRecord.groupBy({
      by: ['userId'],
      where: {
        userId: { in: users.map((u) => u.id) },
        action: 'QUERY',
        createdAt: { gte: startOfMonth },
      },
      _count: true,
    })
    const queryMap = new Map(queryCounts.map((q) => [q.userId, q._count]))

    const mappedUsers: AdminUserInfo[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      twoFactorEnabled: u.twoFactorEnabled,
      onboardingCompleted: u.onboardingCompleted,
      createdAt: u.createdAt.toISOString(),
      plan: u.subscription?.plan || 'FREE',
      planStatus: u.subscription?.status || 'ACTIVE',
      queryCount: queryMap.get(u.id) || 0,
      connectionCount: u._count.connections,
    }))

    return {
      success: true,
      data: {
        users: mappedUsers,
        total,
        page,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch users',
    }
  }
}

export async function updateUserRole(
  userId: string,
  newRole: 'ADMIN' | 'ANALYST' | 'VIEWER'
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    // Rate limit
    const rl = await rateLimitAsync(`admin_role_change:${admin.id}`, {
      maxRequests: 20,
      windowSeconds: 60,
    })
    if (!rl.allowed) return { success: false, error: 'Too many requests' }

    // Validation
    const validated = validateInput(UpdateUserRoleSchema, { userId, newRole })
    if (!validated.success) return { success: false, error: validated.error }
    const { userId: vUserId, newRole: vNewRole } = validated.data

    if (admin.id === vUserId) {
      return { success: false, error: 'Cannot change your own role' }
    }

    const user = await prisma.user.findUnique({ where: { id: vUserId }, select: { role: true } })
    if (!user) return { success: false, error: 'User not found' }

    await prisma.$transaction([
      prisma.user.update({ where: { id: vUserId }, data: { role: vNewRole } }),
      prisma.auditLog.create({
        data: {
          userId: admin.id!,
          action: 'CHANGE_USER_ROLE',
          resource: 'user',
          resourceId: vUserId,
          metadata: { oldRole: user.role, newRole: vNewRole },
        },
      }),
    ])

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update role',
    }
  }
}

export async function deleteConnectionAdmin(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    // Validation
    if (!IdSchema.safeParse(connectionId).success) return { success: false, error: 'Invalid ID' }

    const conn = await prisma.databaseConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, name: true, host: true, userId: true },
    })
    if (!conn) return { success: false, error: 'Connection not found' }

    await prisma.$transaction([
      prisma.databaseConnection.delete({ where: { id: connectionId } }),
      prisma.auditLog.create({
        data: {
          userId: admin.id!,
          action: 'ADMIN_DELETE_CONNECTION',
          resource: 'connection',
          resourceId: connectionId,
          metadata: { connectionName: conn.name, host: conn.host, ownerId: conn.userId },
        },
      }),
    ])

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete connection',
    }
  }
}

// --- Activity & Insights ---

export async function getRecentActivity(
  limit: number = 15
): Promise<{ success: boolean; data?: ActivityItem[]; error?: string }> {
  try {
    await requireAdmin()

    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    })

    return {
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        userName: l.user?.name ?? null,
        userEmail: l.user?.email ?? null,
        createdAt: l.createdAt.toISOString(),
        metadata: l.metadata,
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activity',
    }
  }
}

export async function getTopActiveUsers(
  limit: number = 5
): Promise<{ success: boolean; data?: TopUser[]; error?: string }> {
  try {
    await requireAdmin()

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const topUsage = await prisma.usageRecord.groupBy({
      by: ['userId'],
      where: { action: 'QUERY', createdAt: { gte: startOfMonth } },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    })

    if (topUsage.length === 0) return { success: true, data: [] }

    const userIds = topUsage.map((u) => u.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { subscription: { select: { plan: true } } },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const result: TopUser[] = topUsage.map((t) => {
      const u = userMap.get(t.userId)
      return {
        userId: t.userId,
        name: u?.name ?? null,
        email: u?.email ?? 'Unknown',
        queryCount: t._count,
        plan: u?.subscription?.plan ?? 'FREE',
      }
    })

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch top users',
    }
  }
}

// --- Admin Simulation Tools ---

export async function adminSwitchPersonalPlan(
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    await prisma.subscription.upsert({
      where: { userId: admin.id },
      update: { plan, status: 'ACTIVE' },
      create: {
        userId: admin.id as string,
        plan,
        status: 'ACTIVE',
      },
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to switch plan',
    }
  }
}
