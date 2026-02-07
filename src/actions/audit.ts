'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AuditLogFilters {
  action?: string
  page?: number
  pageSize?: number
}

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Only ADMIN role can view all logs; others see their own
  const isAdmin = (session.user as any).role === 'ADMIN'
  const { action, page = 1, pageSize = 25 } = filters

  const where = {
    ...(!isAdmin ? { userId: session.user.id } : {}),
    ...(action ? { action } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    success: true,
    data: {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getAuditLogActions() {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const actions = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
  })

  return { success: true, data: actions.map((a) => a.action) }
}
