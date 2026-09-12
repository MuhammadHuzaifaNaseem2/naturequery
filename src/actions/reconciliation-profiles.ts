'use server'

import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import {
  isReconciliationProfileDefinition,
  type ReconciliationProfileDefinition,
  type SavedReconciliationProfile,
} from '@/lib/reconciliation-profile'

const PROFILE_ACTION = 'RECONCILIATION_PROFILE_SAVED'
const PROFILE_RESOURCE = 'reconciliation_profile'

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id
}

function validateDefinition(input: unknown): ReconciliationProfileDefinition {
  if (!isReconciliationProfileDefinition(input)) throw new Error('Invalid reconciliation profile')

  const definition = {
    ...input,
    name: input.name.trim(),
    metric: input.metric.trim(),
    currency: input.currency.trim().toUpperCase(),
    sourceLabel: input.sourceLabel.trim(),
    comparisonLabel: input.comparisonLabel.trim(),
  }
  if (!definition.name || definition.name.length > 120) {
    throw new Error('Use a profile name under 120 characters')
  }
  if (!definition.sourceKey || !definition.sourceAmount) {
    throw new Error('Select the Report A ID and amount columns')
  }
  if (!definition.comparisonKey || !definition.comparisonAmount) {
    throw new Error('Select the Report B ID and amount columns')
  }
  return definition
}

export async function saveReconciliationProfile(input: {
  id?: string
  definition: ReconciliationProfileDefinition
}): Promise<{ success: boolean; data?: SavedReconciliationProfile; error?: string }> {
  try {
    const userId = await requireUserId()
    const definition = validateDefinition(input.definition)
    const id = input.id || randomUUID()

    if (input.id) {
      const existing = await prisma.auditLog.findFirst({
        where: {
          userId,
          action: PROFILE_ACTION,
          resource: PROFILE_RESOURCE,
          resourceId: input.id,
        },
        select: { id: true },
      })
      if (!existing) throw new Error('Reconciliation profile not found')
    }

    await writeImmutableAuditLog({
      userId,
      action: PROFILE_ACTION,
      resource: PROFILE_RESOURCE,
      resourceId: id,
      metadata: { definition },
    })

    return { success: true, data: { id, savedAt: new Date().toISOString(), definition } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save reconciliation profile',
    }
  }
}

export async function getReconciliationProfiles(): Promise<{
  success: boolean
  data?: SavedReconciliationProfile[]
  error?: string
}> {
  try {
    const userId = await requireUserId()
    const records = await prisma.auditLog.findMany({
      where: { userId, action: PROFILE_ACTION, resource: PROFILE_RESOURCE },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: { resourceId: true, metadata: true, createdAt: true },
    })

    const seen = new Set<string>()
    const profiles: SavedReconciliationProfile[] = []
    for (const record of records) {
      if (!record.resourceId || seen.has(record.resourceId)) continue
      seen.add(record.resourceId)
      const metadata = record.metadata as { definition?: unknown } | null
      if (!isReconciliationProfileDefinition(metadata?.definition)) continue
      profiles.push({
        id: record.resourceId,
        savedAt: record.createdAt.toISOString(),
        definition: metadata.definition,
      })
    }

    return { success: true, data: profiles }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load reconciliation profiles',
    }
  }
}
