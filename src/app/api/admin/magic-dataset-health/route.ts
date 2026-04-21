import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkMagicDatasetHealth } from '@/lib/magic-dataset'

/**
 * GET /api/admin/magic-dataset-health
 *
 * Diagnostic for the Magic Dataset storage database. Available to any
 * authenticated user — exposes only whether the DB is reachable and
 * whether dedicated-DB isolation is in effect (non-sensitive). Admin
 * role additionally sees the Postgres version string.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const isAdmin = user?.role === 'ADMIN'

  const health = await checkMagicDatasetHealth()
  const body = isAdmin
    ? health
    : {
        ok: health.ok,
        usingDedicatedDb: health.usingDedicatedDb,
        ...(health.error ? { error: health.error } : {}),
      }

  return NextResponse.json(body, { status: health.ok ? 200 : 503 })
}
