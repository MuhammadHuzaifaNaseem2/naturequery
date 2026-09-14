import type { ReconciliationResult } from '@/lib/reconciliation'
export type MonitorFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type MonitorRunStatus = 'never' | 'matched' | 'within_threshold' | 'alert' | 'failed'

export interface MonitorReportDefinition {
  name: string
  question?: string
  sql: string
  connectionId: string
  connectionName?: string
  keyColumn: string
  amountColumn: string
}

export interface ReconciliationMonitorDefinition {
  version: 1
  name: string
  enabled: boolean
  frequency: MonitorFrequency
  threshold: number
  currency: string
  source: MonitorReportDefinition
  comparison: MonitorReportDefinition
  nextRunAt: string
  lastRunAt?: string
  lastStatus: MonitorRunStatus
  lastDifference?: number
  lastError?: string
  lastInvestigationId?: string
}

export interface ReconciliationMonitorRecord {
  id: string
  userId: string
  savedAt: string
  definition: ReconciliationMonitorDefinition
}

export interface MonitorRunResult {
  monitorId: string
  name: string
  status: Exclude<MonitorRunStatus, 'never'>
  difference?: number
  investigationId?: string
  error?: string
}

export const MONITOR_CONFIG_ACTION = 'RECONCILIATION_MONITOR_CONFIG_SAVED'

export function nextMonitorRun(frequency: MonitorFrequency, from: Date): Date {
  const next = new Date(from)
  if (frequency === 'DAILY') next.setUTCDate(next.getUTCDate() + 1)
  if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7)
  if (frequency === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

export function isMonitorDefinition(value: unknown): value is ReconciliationMonitorDefinition {
  if (!value || typeof value !== 'object') return false
  const monitor = value as Partial<ReconciliationMonitorDefinition>
  const reportValid = (report: unknown) => {
    if (!report || typeof report !== 'object') return false
    const candidate = report as Partial<MonitorReportDefinition>
    return (
      typeof candidate.name === 'string' &&
      typeof candidate.sql === 'string' &&
      typeof candidate.connectionId === 'string' &&
      typeof candidate.keyColumn === 'string' &&
      typeof candidate.amountColumn === 'string'
    )
  }
  return (
    monitor.version === 1 &&
    typeof monitor.name === 'string' &&
    typeof monitor.enabled === 'boolean' &&
    (monitor.frequency === 'DAILY' ||
      monitor.frequency === 'WEEKLY' ||
      monitor.frequency === 'MONTHLY') &&
    typeof monitor.threshold === 'number' &&
    typeof monitor.currency === 'string' &&
    typeof monitor.nextRunAt === 'string' &&
    (monitor.lastStatus === 'never' ||
      monitor.lastStatus === 'matched' ||
      monitor.lastStatus === 'within_threshold' ||
      monitor.lastStatus === 'alert' ||
      monitor.lastStatus === 'failed') &&
    reportValid(monitor.source) &&
    reportValid(monitor.comparison)
  )
}

export function reconciliationMonitorStatus(
  result: ReconciliationResult,
  threshold: number
): Exclude<MonitorRunStatus, 'never'> {
  if (!result.isComplete || !Number.isFinite(threshold) || threshold < 0) return 'failed'
  if (result.allMatched) return 'matched'
  // Structural differences (including equal-total duplicates) cannot be suppressed by a money threshold.
  if (
    result.items.some((item) => item.status !== 'matched' && item.status !== 'amount_mismatch') ||
    result.grossDifference > threshold
  )
    return 'alert'
  return 'within_threshold'
}
