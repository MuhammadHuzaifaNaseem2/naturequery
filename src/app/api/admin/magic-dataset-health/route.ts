import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkMagicDatasetHealth } from '@/lib/magic-dataset'

/**
 * GET /api/admin/magic-dataset-health
 *
 * Admin-only diagnostic for the Magic Dataset storage database.
 * Confirms MAGIC_DATABASE_URL (or DATABASE_URL fallback) is reachable
 * and reports whether dedicated-DB isolation is in effect.
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
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const health = await checkMagicDatasetHealth()
  return NextResponse.json(health, { status: health.ok ? 200 : 503 })
}
