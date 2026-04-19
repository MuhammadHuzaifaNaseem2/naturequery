import { NextRequest } from 'next/server'
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { GenerateQueryApiInputSchema, validateInput, type GenerateQueryApiInput } from '@/lib/validation'
import { decrypt } from '@/lib/encryption'
import { createDriver, type DatabaseType } from '@/lib/db-drivers'
import { generateSQLFromSchema } from '@/actions/ai'

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiRequest(request)
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const validation = validateInput(GenerateQueryApiInputSchema, body)
  if (!validation.success) {
    return apiError(validation.error, 400)
  }

  const { question, connectionId } = validation.data as GenerateQueryApiInput

  // Get connection (must belong to user)
  const conn = await prisma.databaseConnection.findFirst({
    where: { id: connectionId, userId },
  })
  if (!conn) {
    return apiError('Connection not found', 404)
  }

  // Fetch schema from the connection
  const credentials = {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: decrypt(conn.password),
    dbType: conn.dbType as DatabaseType,
  }

  const driver = createDriver(credentials, credentials.dbType)

  try {
    const tables = await driver.fetchSchema()
    const schema = { tables }

    const result = await generateSQLFromSchema(question, schema)

    if (!result.success) {
      return apiError(result.error || 'Failed to generate SQL', 500)
    }

    return apiSuccess({
      question,
      sql: result.sql,
      connectionId,
    })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'SQL generation failed',
      500
    )
  } finally {
    await driver.close().catch(() => {})
  }
}
