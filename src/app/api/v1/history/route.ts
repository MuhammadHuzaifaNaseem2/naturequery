import { NextRequest } from 'next/server'
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth'
import { apiError, apiPaginated } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  try {
    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50')))
    const connectionId = url.searchParams.get('connectionId') || undefined
    const status = url.searchParams.get('status') || undefined
    const search = url.searchParams.get('search') || undefined

    const where: Record<string, unknown> = { userId }
    if (connectionId) where.connectionId = connectionId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { sql: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.queryHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.queryHistory.count({ where }),
    ])

    const data = items.map((h) => ({
      id: h.id,
      question: h.question,
      sql: h.sql,
      connectionId: h.connectionId,
      connectionName: h.connectionName,
      status: h.status,
      rowCount: h.rowCount,
      executionTimeMs: h.executionTimeMs,
      errorMessage: h.errorMessage,
      executedAt: h.createdAt.toISOString(),
    }))

    return apiPaginated(data, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('API v1 GET /history error:', error)
    return apiError('Failed to fetch history', 500)
  }
}
