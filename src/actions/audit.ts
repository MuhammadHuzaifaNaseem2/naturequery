'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { collectInsightMetrics } from '@/lib/nightly-insights'

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user
}

interface GetAuditLogsOptions {
  page?: number
  pageSize?: number
  action?: string
  userId?: string
}

/**
 * List audit log entries.
 * Regular users see only their own logs. ADMINs see all.
 */
export async function getAuditLogs(options: GetAuditLogsOptions = {}): Promise<{
  success: boolean
  data?: { logs: unknown[]; total: number; page: number; totalPages: number }
  error?: string
}> {
  try {
    const user = await requireUser()
    const isAdmin = (user as any).role === 'ADMIN'
    const page = options.page ?? 1
    const pageSize = Math.min(options.pageSize ?? 25, 100)

    const where: any = {}
    if (!isAdmin) {
      where.userId = user.id
    } else if (options.userId) {
      where.userId = options.userId
    }
    if (options.action) where.action = options.action

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      success: true,
      data: { logs, total, page, totalPages: Math.ceil(total / pageSize) || 1 },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
    }
  }
}

/**
 * Returns distinct action types seen in the audit log — used for the filter dropdown.
 */
export async function getAuditLogActions(): Promise<{
  success: boolean
  data?: string[]
  error?: string
}> {
  try {
    const user = await requireUser()
    const isAdmin = (user as any).role === 'ADMIN'
    const where: any = isAdmin ? {} : { userId: user.id }

    const actions = await prisma.auditLog.findMany({
      where,
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    })

    return { success: true, data: actions.map((a) => a.action) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch actions',
    }
  }
}

// ── Nightly Insight shape as stored in AuditLog.metadata ───────────────────
export interface NightlyInsightRecord {
  id: string
  createdAt: string
  narrative: string
  metrics: {
    queries7d: number
    queries7d_prev: number
    queries30d: number
    wowDelta: number
    wowDirection: 'up' | 'down' | 'stable'
    connectionCount: number
    savedQueryCount: number
    topConnections: { name: string; count: number; other?: boolean }[]
  }
  generatedAt: string
}

/**
 * Fetch nightly AI insight snapshots for the current user (most recent first).
 */
export async function getNightlyInsights(limit = 10): Promise<{
  success: boolean
  data?: NightlyInsightRecord[]
  error?: string
}> {
  try {
    const user = await requireUser()

    const rows = await prisma.auditLog.findMany({
      where: { userId: user.id, action: 'NIGHTLY_INSIGHT_GENERATED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, createdAt: true, metadata: true },
    })

    const data = rows.map((row) => {
      const meta = row.metadata as {
        narrative: string
        metrics: NightlyInsightRecord['metrics']
        generatedAt: string
      } | null
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        narrative: meta?.narrative ?? '',
        metrics: meta?.metrics ?? {
          queries7d: 0,
          queries7d_prev: 0,
          queries30d: 0,
          wowDelta: 0,
          wowDirection: 'stable' as const,
          connectionCount: 0,
          savedQueryCount: 0,
          topConnections: [],
        },
        generatedAt: meta?.generatedAt ?? row.createdAt.toISOString(),
      }
    })

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch insights',
    }
  }
}

/**
 * Export audit logs as base64 CSV for client-side download.
 */
export async function exportAuditLogsCSV(options: { action?: string } = {}): Promise<{
  success: boolean
  data?: { base64: string; filename: string }
  error?: string
}> {
  try {
    const user = await requireUser()
    const isAdmin = (user as any).role === 'ADMIN'
    const where: any = isAdmin ? {} : { userId: user.id }
    if (options.action) where.action = options.action

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: { user: { select: { name: true, email: true } } },
    })

    const sanitize = (val: unknown): string => {
      const str = val == null ? '' : String(val)
      const escaped = str.replace(/"/g, '""')
      if (/^[=+\-@\t\r|%]/.test(escaped)) return `"'${escaped}"`
      return `"${escaped}"`
    }

    const headers = ['Date', 'Action', 'User', 'Email', 'Resource', 'Resource ID', 'IP Address']
    const rows = logs.map((log) => [
      sanitize(new Date(log.createdAt).toISOString()),
      sanitize(log.action),
      sanitize(log.user?.name ?? ''),
      sanitize(log.user?.email ?? ''),
      sanitize(log.resource ?? ''),
      sanitize(log.resourceId ?? ''),
      sanitize(log.ipAddress ?? ''),
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const base64 = Buffer.from(csv, 'utf-8').toString('base64')
    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

    return { success: true, data: { base64, filename } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export audit logs',
    }
  }
}

export type LiveInsightMetrics = NightlyInsightRecord['metrics']

/**
 * Live figures for the Insights page, counted exactly like the nightly summary
 * (src/lib/nightly-insights.ts), so the page, the summaries and the email agree.
 */
export async function getLiveInsightMetrics(): Promise<{
  success: boolean
  data?: LiveInsightMetrics
  error?: string
}> {
  try {
    const user = await requireUser()
    return { success: true, data: await collectInsightMetrics(user.id) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch live metrics',
    }
  }
}
