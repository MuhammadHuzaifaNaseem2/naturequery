import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { getOrCreateDriver } from '@/lib/driver-pool'
import { ensureLimitClause, validateSQLSafety } from '@/lib/sql-validator'
import { MAX_QUERY_ROWS, type DatabaseType } from '@/lib/db-drivers'
import { checkAndRecordQuery } from '@/lib/plan-limits'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import { DEMO_DATA } from '@/app/dashboard/demo-data'
import { applyDemoQueryFilters } from '@/lib/demo-query'
import { createInvestigationReport } from '@/lib/investigation-transfer'
import { reconcileReports } from '@/lib/reconciliation'
import type { InvestigationSnapshot } from '@/lib/investigation-record'
import {
  isMonitorDefinition,
  MONITOR_CONFIG_ACTION,
  nextMonitorRun,
  type MonitorReportDefinition,
  type MonitorRunResult,
  type ReconciliationMonitorDefinition,
  type ReconciliationMonitorRecord,
} from '@/lib/reconciliation-monitor'

interface ExecutedReport {
  rows: Record<string, unknown>[]
  fields: string[]
}

function demoReport(sql: string): ExecutedReport {
  const normalized = sql.toLowerCase()
  const table = normalized.includes('orders')
    ? 'orders'
    : normalized.includes('products')
      ? 'products'
      : 'customers'
  const rows = applyDemoQueryFilters(DEMO_DATA[table], sql)
  return { rows, fields: rows[0] ? Object.keys(rows[0]) : Object.keys(DEMO_DATA[table][0] ?? {}) }
}

async function executeReport(
  userId: string,
  report: MonitorReportDefinition
): Promise<ExecutedReport> {
  if (report.connectionId === 'demo') return demoReport(report.sql)

  const connection = await prisma.databaseConnection.findFirst({
    where: {
      id: report.connectionId,
      OR: [{ userId }, { team: { members: { some: { userId, status: 'ACCEPTED' } } } }],
    },
  })
  if (!connection)
    throw new Error(`Connection unavailable: ${report.connectionName || report.name}`)

  const dbType = connection.dbType as DatabaseType
  const safety = validateSQLSafety(report.sql, dbType)
  if (!safety.valid) throw new Error(safety.error || 'Monitor SQL failed the safety check')

  const quota = await checkAndRecordQuery(userId)
  if (!quota.allowed) throw new Error(`Monthly query limit reached on the ${quota.planName} plan`)

  const driver = getOrCreateDriver(
    {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user,
      password: decrypt(connection.password),
      dbType,
    },
    dbType
  )
  const result = await driver.executeQuery(ensureLimitClause(report.sql, MAX_QUERY_ROWS, dbType))
  return { rows: result.rows, fields: result.fields }
}

async function appendMonitorDefinition(
  userId: string,
  monitorId: string,
  definition: ReconciliationMonitorDefinition
) {
  await writeImmutableAuditLog({
    userId,
    action: MONITOR_CONFIG_ACTION,
    resource: 'reconciliation_monitor',
    resourceId: monitorId,
    metadata: { definition },
  })
}

export async function runSingleReconciliationMonitor(
  monitor: ReconciliationMonitorRecord,
  now = new Date()
): Promise<MonitorRunResult> {
  const { id, userId } = monitor
  const definition = monitor.definition
  const nextRunAt = nextMonitorRun(definition.frequency, now).toISOString()

  try {
    const [sourceResult, comparisonResult] = await Promise.all([
      executeReport(userId, definition.source),
      executeReport(userId, definition.comparison),
    ])
    const source = createInvestigationReport({
      name: definition.source.name,
      question: definition.source.question || '',
      sql: definition.source.sql,
      connectionId: definition.source.connectionId,
      connectionName: definition.source.connectionName || '',
      rows: sourceResult.rows,
      fields: sourceResult.fields,
    })
    const comparison = createInvestigationReport({
      name: definition.comparison.name,
      question: definition.comparison.question || '',
      sql: definition.comparison.sql,
      connectionId: definition.comparison.connectionId,
      connectionName: definition.comparison.connectionName || '',
      rows: comparisonResult.rows,
      fields: comparisonResult.fields,
    })
    const result = reconcileReports({
      sourceRows: source.rows,
      comparisonRows: comparison.rows,
      sourceKey: definition.source.keyColumn,
      sourceAmount: definition.source.amountColumn,
      comparisonKey: definition.comparison.keyColumn,
      comparisonAmount: definition.comparison.amountColumn,
    })

    const shouldAlert = Math.abs(result.difference) > definition.threshold
    let investigationId: string | undefined
    if (shouldAlert) {
      investigationId = randomUUID()
      const snapshot: InvestigationSnapshot = {
        version: 1,
        name: `${definition.name} alert · ${now.toISOString().slice(0, 10)}`,
        status: 'OPEN',
        metric: definition.name,
        period: `Automatic run ${now.toISOString()}`,
        currency: definition.currency,
        source,
        comparison,
        sourceKey: definition.source.keyColumn,
        sourceAmount: definition.source.amountColumn,
        comparisonKey: definition.comparison.keyColumn,
        comparisonAmount: definition.comparison.amountColumn,
        causes: {},
        sourceTotal: result.sourceTotal,
        comparisonTotal: result.comparisonTotal,
        difference: result.difference,
        unresolvedDifference: result.difference,
        issueCount: result.issueCount,
        resolvedCount: 0,
      }
      await writeImmutableAuditLog({
        userId,
        action: 'INVESTIGATION_SNAPSHOT_SAVED',
        resource: 'investigation',
        resourceId: investigationId,
        metadata: { snapshot, monitorId: id },
      })
      await prisma.notification.create({
        data: {
          userId,
          type: 'reconciliation_alert',
          title: `Reconciliation alert: ${definition.name}`,
          message: `${definition.currency} ${Math.abs(result.difference).toFixed(2)} is unexplained across ${result.issueCount} record(s).`,
          metadata: {
            monitorId: id,
            investigationId,
            link: `/dashboard/investigate?id=${investigationId}`,
          },
        },
      })
    }

    await appendMonitorDefinition(userId, id, {
      ...definition,
      nextRunAt,
      lastRunAt: now.toISOString(),
      lastStatus: shouldAlert ? 'alert' : 'matched',
      lastDifference: result.difference,
      lastError: undefined,
      lastInvestigationId: investigationId,
    })

    return {
      monitorId: id,
      name: definition.name,
      status: shouldAlert ? 'alert' : 'matched',
      difference: result.difference,
      investigationId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Monitor failed'
    await appendMonitorDefinition(userId, id, {
      ...definition,
      nextRunAt,
      lastRunAt: now.toISOString(),
      lastStatus: 'failed',
      lastError: message,
    }).catch(() => {})
    await prisma.notification
      .create({
        data: {
          userId,
          type: 'reconciliation_failed',
          title: `Monitor failed: ${definition.name}`,
          message,
          metadata: { monitorId: id },
        },
      })
      .catch(() => {})
    return { monitorId: id, name: definition.name, status: 'failed', error: message }
  }
}

export async function getLatestMonitorRecords(userId?: string) {
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(userId ? { userId } : { userId: { not: null } }),
      action: MONITOR_CONFIG_ACTION,
      resource: 'reconciliation_monitor',
    },
    orderBy: { createdAt: 'desc' },
    take: 1_000,
    select: { userId: true, resourceId: true, metadata: true, createdAt: true },
  })
  const seen = new Set<string>()
  const monitors: ReconciliationMonitorRecord[] = []
  for (const row of rows) {
    if (!row.userId || !row.resourceId) continue
    const key = `${row.userId}:${row.resourceId}`
    if (seen.has(key)) continue
    seen.add(key)
    const metadata = row.metadata as { definition?: unknown } | null
    if (!isMonitorDefinition(metadata?.definition)) continue
    monitors.push({
      id: row.resourceId,
      userId: row.userId,
      savedAt: row.createdAt.toISOString(),
      definition: metadata.definition,
    })
  }
  return monitors
}

export async function runDueReconciliationMonitors(now = new Date()) {
  const monitors = await getLatestMonitorRecords()
  const due = monitors
    .filter(
      (monitor) =>
        monitor.definition.enabled &&
        new Date(monitor.definition.nextRunAt).getTime() <= now.getTime()
    )
    .slice(0, 50)
  const results: MonitorRunResult[] = []
  for (const monitor of due) results.push(await runSingleReconciliationMonitor(monitor, now))
  return results
}
