import { NextRequest } from 'next/server'
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  try {
    const connections = await prisma.databaseConnection.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        database: true,
        user: true,
        dbType: true,
        ssl: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(
      connections.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('API v1 /connections error:', error)
    return apiError('Failed to fetch connections', 500)
  }
}
