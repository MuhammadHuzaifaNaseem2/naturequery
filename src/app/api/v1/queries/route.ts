import { NextRequest } from 'next/server'
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth'
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { SaveQueryApiSchema, validateInput } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  try {
    const url = request.nextUrl
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50')))
    const search = url.searchParams.get('search') || undefined
    const connectionId = url.searchParams.get('connectionId') || undefined

    const where: Record<string, unknown> = {
      OR: [
        { userId },
        { team: { members: { some: { userId } } } },
      ],
    }
    if (connectionId) (where as any).connectionId = connectionId
    if (search) {
      (where as any).AND = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { question: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [items, total] = await Promise.all([
      prisma.savedQuery.findMany({
        where,
        orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.savedQuery.count({ where }),
    ])

    const data = items.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      question: q.question,
      sql: q.sql,
      connectionId: q.connectionId,
      connectionName: q.connectionName,
      isPublic: q.isPublic,
      isFavorite: q.isFavorite,
      tags: q.tags,
      shareToken: q.shareToken,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    }))

    return apiPaginated(data, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('API v1 GET /queries error:', error)
    return apiError('Failed to fetch queries', 500)
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid JSON body', 400)
    }

    const validation = validateInput(SaveQueryApiSchema, body)
    if (!validation.success) {
      return apiError(validation.error, 400)
    }

    const { name, question, sql, description, connectionId, connectionName, tags, isPublic } = validation.data as any
    const finalSql = sql || ''

    const query = await prisma.savedQuery.create({
      data: {
        name,
        description: description || null,
        question,
        sql: finalSql,
        userId,
        connectionId: connectionId || null,
        connectionName: connectionName || null,
        tags: tags || [],
        isPublic: isPublic || false,
      },
    })

    return apiSuccess(
      {
        id: query.id,
        name: query.name,
        description: query.description,
        question: query.question,
        sql: query.sql,
        connectionId: query.connectionId,
        connectionName: query.connectionName,
        isPublic: query.isPublic,
        isFavorite: query.isFavorite,
        tags: query.tags,
        shareToken: query.shareToken,
        createdAt: query.createdAt.toISOString(),
        updatedAt: query.updatedAt.toISOString(),
      },
      201
    )
  } catch (error) {
    console.error('API v1 POST /queries error:', error)
    return apiError('Failed to save query', 500)
  }
}
