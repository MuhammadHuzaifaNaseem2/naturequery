import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { checkPlanLimits } from '@/lib/plan-limits'
import {
  sanitizeIdentifier,
  userSchemaName,
  createMagicTable,
  insertMagicRows,
  dropMagicTable,
} from '@/lib/magic-dataset'
import { invalidateConnectionCache, invalidateSchemaCache } from '@/lib/query-cache'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json() as {
      filename: string
      headers?: string[]
      rows: Record<string, unknown>[]
      tableName?: string
      isFirst: boolean
      isLast: boolean
    }

    const { filename, headers, rows, isFirst, isLast } = body
    if (!filename || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Invalid request body.' })
    }

    const tableName = body.tableName ?? sanitizeIdentifier(filename.replace(/\.csv$/i, ''), 't')
    const connectionName = `CSV: ${filename}`

    if (isFirst) {
      if (!headers || headers.length === 0) {
        return NextResponse.json({ success: false, error: 'Headers required for first batch.' })
      }

      // Plan-limit check — only counts as a new connection if no existing one with same name
      const stale = await prisma.databaseConnection.findMany({
        where: { userId, dbType: 'magic', name: connectionName },
        select: { id: true, database: true },
      })

      if (stale.length === 0) {
        const limit = await checkPlanLimits(userId, 'CONNECTION_ADD')
        if (!limit.allowed) {
          return NextResponse.json({
            success: false,
            error: 'Connection limit reached. Please upgrade your plan.',
            limitReached: true,
          })
        }
      } else {
        // Drop orphaned tables from previous uploads with same filename
        await Promise.all(
          stale
            .filter((s) => s.database !== tableName)
            .map((s) => dropMagicTable(userId, s.database).catch(() => {}))
        )
        await prisma.databaseConnection.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
        Promise.all(
          stale.flatMap((s) => [invalidateConnectionCache(s.id), invalidateSchemaCache(s.id)])
        ).catch(() => {})
      }

      await createMagicTable(userId, tableName, headers, rows)
    }

    // Insert this batch
    const effectiveHeaders = headers ?? (rows[0] ? Object.keys(rows[0]) : [])
    await insertMagicRows(userId, tableName, effectiveHeaders, rows)

    // On the final batch create the connection record
    if (isLast) {
      await prisma.databaseConnection.create({
        data: {
          name: connectionName,
          host: 'magic',
          port: 0,
          database: tableName,
          user: userId,
          password: encrypt('magic'),
          dbType: 'magic',
          ssl: false,
          userId,
        },
      })
    }

    return NextResponse.json({ success: true, tableName })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.'
    console.error('[upload-csv-json]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
