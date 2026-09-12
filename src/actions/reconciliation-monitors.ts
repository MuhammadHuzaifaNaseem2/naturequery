'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import {
  getLatestMonitorRecords,
  runSingleReconciliationMonitor,
} from '@/lib/reconciliation-monitor-runner'
import {
  MONITOR_CONFIG_ACTION,
  nextMonitorRun,
  type MonitorFrequency,
  type MonitorReportDefinition,
  type MonitorRunResult,
  type ReconciliationMonitorDefinition,
  type ReconciliationMonitorRecord,
} from '@/lib/reconciliation-monitor'

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id
}

function validateReport(report: MonitorReportDefinition, label: string) {
  if (!report.sql.trim()) throw new Error(`${label} has no SQL to schedule`)
  if (!report.connectionId) throw new Error(`${label} has no database connection`)
  if (!report.keyColumn || !report.amountColumn) throw new Error(`${label} columns are incomplete`)
}

export async function createReconciliationMonitor(input: {
  name: string
  frequency: MonitorFrequency
  threshold: number
  currency: string
  source: MonitorReportDefinition
  comparison: MonitorReportDefinition
}): Promise<{ success: boolean; data?: ReconciliationMonitorRecord; error?: string }> {
  try {
    const userId = await requireUserId()
    const name = input.name.trim()
    if (!name || name.length > 120) throw new Error('Use a monitor name under 120 characters')
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(input.frequency)) {
      throw new Error('Invalid monitoring frequency')
    }
    if (!Number.isFinite(input.threshold) || input.threshold < 0) {
      throw new Error('Alert threshold must be zero or greater')
    }
    validateReport(input.source, 'Report A')
    validateReport(input.comparison, 'Report B')

    const id = randomUUID()
    const now = new Date()
    const definition: ReconciliationMonitorDefinition = {
      version: 1,
      name,
      enabled: true,
      frequency: input.frequency,
      threshold: input.threshold,
      currency: input.currency.trim().toUpperCase() || 'USD',
      source: input.source,
      comparison: input.comparison,
      nextRunAt: nextMonitorRun(input.frequency, now).toISOString(),
      lastStatus: 'never',
    }
    await writeImmutableAuditLog({
      userId,
      action: MONITOR_CONFIG_ACTION,
      resource: 'reconciliation_monitor',
      resourceId: id,
      metadata: { definition },
    })
    revalidatePath('/dashboard/investigate/monitors')
    return { success: true, data: { id, userId, savedAt: now.toISOString(), definition } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create monitor',
    }
  }
}

export async function getReconciliationMonitors(): Promise<{
  success: boolean
  data?: ReconciliationMonitorRecord[]
  error?: string
}> {
  try {
    const userId = await requireUserId()
    return { success: true, data: await getLatestMonitorRecords(userId) }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load monitors',
    }
  }
}

export async function setReconciliationMonitorEnabled(id: string, enabled: boolean) {
  try {
    const userId = await requireUserId()
    const monitor = (await getLatestMonitorRecords(userId)).find((item) => item.id === id)
    if (!monitor) return { success: false, error: 'Monitor not found' }
    const definition = { ...monitor.definition, enabled }
    await writeImmutableAuditLog({
      userId,
      action: MONITOR_CONFIG_ACTION,
      resource: 'reconciliation_monitor',
      resourceId: id,
      metadata: { definition },
    })
    revalidatePath('/dashboard/investigate/monitors')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' }
  }
}

export async function runReconciliationMonitorNow(
  id: string
): Promise<{ success: boolean; data?: MonitorRunResult; error?: string }> {
  try {
    const userId = await requireUserId()
    const monitor = (await getLatestMonitorRecords(userId)).find((item) => item.id === id)
    if (!monitor) return { success: false, error: 'Monitor not found' }
    const result = await runSingleReconciliationMonitor(monitor)
    revalidatePath('/dashboard/investigate/monitors')
    revalidatePath('/dashboard/investigate/history')
    return result.status === 'failed'
      ? { success: false, data: result, error: result.error }
      : { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Monitor run failed' }
  }
}
