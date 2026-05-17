import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { checkPlanLimits } from '@/lib/plan-limits'
import { ingestCsv, dropMagicTable } from '@/lib/magic-dataset'
import { invalidateConnectionCache, invalidateSchemaCache } from '@/lib/query-cache'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded.' })
    if (file.size === 0) return NextResponse.json({ success: false, error: 'Uploaded file is empty.' })
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ success: false, error: 'File exceeds the 10 MB size limit.' })
    if (!file.name.toLowerCase().endsWith('.csv'))
      return NextResponse.json({ success: false, error: 'Only CSV files are supported.' })

    const connectionName = `CSV: ${file.name}`

    const stale = await prisma.databaseConnection.findMany({
      where: { userId: session.user.id, dbType: 'magic', name: connectionName },
      select: { id: true, database: true },
    })

    if (stale.length === 0) {
      const limitCheck = await checkPlanLimits(session.user.id, 'CONNECTION_ADD')
      if (!limitCheck.allowed) {
        return NextResponse.json({
          success: false,
          error: 'Database connection limit reached. Please upgrade your plan.',
          limitReached: true,
        })
      }
    }

    const csvText = await file.text()
    const ingest = await ingestCsv({ userId: session.user.id, csvText, filename: file.name })

    if (stale.length > 0) {
      await Promise.all(
        stale
          .filter((s) => s.database !== ingest.tableName)
          .map((s) => dropMagicTable(session.user.id, s.database).catch(() => {}))
      )
      await prisma.databaseConnection.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
      Promise.all(
        stale.flatMap((s) => [invalidateConnectionCache(s.id), invalidateSchemaCache(s.id)])
      ).catch(() => {})
    }

    await prisma.databaseConnection.create({
      data: {
        name: connectionName,
        host: 'magic',
        port: 0,
        database: ingest.tableName,
        user: session.user.id,
        password: encrypt('magic'),
        dbType: 'magic',
        ssl: false,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload dataset.'
    console.error('[upload-csv]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
