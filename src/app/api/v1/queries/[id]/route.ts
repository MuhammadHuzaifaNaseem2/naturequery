import { NextRequest } from 'next/server'
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult
  const { id } = await params

  try {
    const query = await prisma.savedQuery.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { team: { members: { some: { userId } } } },
        ],
      },
    })

    if (!query) return apiError('Query not found', 404)

    return apiSuccess({
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
    })
  } catch (error) {
    console.error('API v1 GET /queries/[id] error:', error)
    return apiError('Failed to fetch query', 500)
  }
}
