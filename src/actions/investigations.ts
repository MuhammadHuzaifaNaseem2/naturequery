'use server'

import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import {
  investigationSummary,
  recomputeInvestigation,
  isInvestigationSnapshot,
  type InvestigationSnapshot,
  type SavedInvestigation,
  type SavedInvestigationSummary,
} from '@/lib/investigation-record'

const INVESTIGATION_ACTION = 'INVESTIGATION_SNAPSHOT_SAVED'
const MAX_SNAPSHOT_BYTES = 2_000_000
const MAX_REPORT_ROWS = 1_000

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id
}

function validateSnapshot(input: unknown): InvestigationSnapshot {
  if (!isInvestigationSnapshot(input)) throw new Error('Invalid investigation data')

  const name = input.name.trim()
  if (!name || name.length > 120) throw new Error('Use an investigation name under 120 characters')
  if (
    input.source.rows.length > MAX_REPORT_ROWS ||
    input.comparison.rows.length > MAX_REPORT_ROWS
  ) {
    throw new Error('Saved investigations support up to 1,000 rows per report')
  }

  const serialized = JSON.stringify({ ...input, name })
  if (serialized.length > MAX_SNAPSHOT_BYTES) {
    throw new Error('This investigation is too large to save. Compare a smaller date range.')
  }

  return recomputeInvestigation(JSON.parse(serialized) as InvestigationSnapshot)
}

export async function saveInvestigation(input: {
  id?: string
  snapshot: InvestigationSnapshot
}): Promise<{ success: boolean; data?: SavedInvestigation; error?: string }> {
  try {
    const userId = await requireUserId()
    const snapshot = validateSnapshot(input.snapshot)
    const id = input.id || randomUUID()

    if (input.id) {
      const existing = await prisma.auditLog.findFirst({
        where: {
          userId,
          action: INVESTIGATION_ACTION,
          resource: 'investigation',
          resourceId: input.id,
        },
        select: { id: true },
      })
      if (!existing) throw new Error('Investigation not found')
    }

    await writeImmutableAuditLog({
      userId,
      action: INVESTIGATION_ACTION,
      resource: 'investigation',
      resourceId: id,
      metadata: { snapshot },
    })

    return {
      success: true,
      data: { id, savedAt: new Date().toISOString(), snapshot },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save investigation',
    }
  }
}

export async function getInvestigation(
  id: string
): Promise<{ success: boolean; data?: SavedInvestigation; error?: string }> {
  try {
    const userId = await requireUserId()
    const record = await prisma.auditLog.findFirst({
      where: {
        userId,
        action: INVESTIGATION_ACTION,
        resource: 'investigation',
        resourceId: id,
      },
      orderBy: { createdAt: 'desc' },
      select: { resourceId: true, metadata: true, createdAt: true },
    })
    const metadata = record?.metadata as { snapshot?: unknown } | null
    if (!record?.resourceId || !isInvestigationSnapshot(metadata?.snapshot)) {
      return { success: false, error: 'Investigation not found' }
    }

    return {
      success: true,
      data: {
        id: record.resourceId,
        savedAt: record.createdAt.toISOString(),
        snapshot: metadata.snapshot,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load investigation',
    }
  }
}

export async function getSavedInvestigations(): Promise<{
  success: boolean
  data?: SavedInvestigationSummary[]
  error?: string
}> {
  try {
    const userId = await requireUserId()
    const records = await prisma.auditLog.findMany({
      where: { userId, action: INVESTIGATION_ACTION, resource: 'investigation' },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: { resourceId: true, metadata: true, createdAt: true },
    })

    const seen = new Set<string>()
    const summaries: SavedInvestigationSummary[] = []
    for (const record of records) {
      if (!record.resourceId || seen.has(record.resourceId)) continue
      seen.add(record.resourceId)
      const metadata = record.metadata as { snapshot?: unknown } | null
      if (!isInvestigationSnapshot(metadata?.snapshot)) continue
      try {
        summaries.push(
          investigationSummary(
            record.resourceId,
            record.createdAt.toISOString(),
            recomputeInvestigation(metadata.snapshot)
          )
        )
      } catch {
        // Preserve access to old incomplete cases without claiming they are resolved.
        summaries.push({
          ...investigationSummary(record.resourceId, record.createdAt.toISOString(), {
            ...metadata.snapshot,
            status: 'OPEN',
          }),
          needsReview: true,
        })
      }
    }

    return { success: true, data: summaries }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load investigations',
    }
  }
}
