import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { type DatabaseType, MAX_QUERY_ROWS } from '@/lib/db-drivers'
import { getOrCreateDriver } from '@/lib/driver-pool'
import { validateSQLSafety, ensureLimitClause } from '@/lib/sql-validator'
import { sendScheduleNotificationEmail, isEmailConfigured } from '@/lib/email'
import { auditQueryExecuted } from '@/lib/audit-immutable'
import { checkAndRecordQuery, maybeNotifyQueryThreshold } from '@/lib/plan-limits'
import { createNotification } from '@/actions/notifications'

/**
 * GET /api/cron/run-schedules
 *
 * Executes all enabled scheduled queries whose nextRunAt is in the past.
 * Protected by CRON_SECRET — call from Vercel Cron or an external scheduler:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Vercel cron.json example:
 *   { "crons": [{ "path": "/api/cron/run-schedules", "schedule": "0 * * * *" }] }
 */
export async function GET(request: Request) {
  // Auth: CRON_SECRET is always required — no secret = no access.
  // In production this must be set. In dev you can set it to any string.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET is not set — refusing to run to prevent unauthorized access')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all enabled schedules that are due
  const due = await prisma.scheduledQuery.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: {
      user: { select: { id: true } },
    },
    take: 100, // safety cap — prevents runaway in catch-up scenarios
  })

  if (due.length === 0) {
    return NextResponse.json({ ran: 0, message: 'No schedules due' })
  }

  const results: Array<{ id: string; name: string; status: string; error?: string }> = []

  for (const schedule of due) {
    let status: 'success' | 'failed' = 'failed'
    let lastError: string | null = null

    try {
      // Atomically check quota and record usage
      const planCheck = await checkAndRecordQuery(schedule.userId)
      if (!planCheck.allowed) {
        throw new Error(`Monthly query limit reached (${planCheck.current}/${planCheck.limit} on ${planCheck.planName} plan)`)
      }

      // Validate the SQL is still safe before running
      const sqlCheck = validateSQLSafety(schedule.sql)
      if (!sqlCheck.valid) {
        throw new Error(sqlCheck.error ?? 'SQL failed safety check')
      }

      // Fetch connection from DB
      if (!schedule.connectionId) {
        throw new Error('No connectionId — cannot execute without a database connection')
      }

      const conn = await prisma.databaseConnection.findFirst({
        where: { id: schedule.connectionId, userId: schedule.userId },
      })
      if (!conn) {
        throw new Error('Connection not found or does not belong to user')
      }

      let password: string
      try {
        password = conn.password ? decrypt(conn.password) : ''
      } catch {
        throw new Error('Could not decrypt connection credentials — re-add the connection to fix this')
      }
      const dbType = conn.dbType as DatabaseType
      const driver = getOrCreateDriver(
        {
          host: conn.host,
          port: conn.port,
          database: conn.database,
          user: conn.user,
          password,
          dbType,
        },
        dbType
      )

      // Inject LIMIT to prevent massive table scans
      const safeSql = ensureLimitClause(schedule.sql, MAX_QUERY_ROWS, dbType)

      const startTime = Date.now()
      const result = await driver.executeQuery(safeSql)
      const executionTimeMs = Date.now() - startTime
      status = 'success'

      // Usage already recorded atomically in checkAndRecordQuery above
      maybeNotifyQueryThreshold(schedule.userId).catch(() => {})

      // Fire-and-forget audit trail
      auditQueryExecuted(schedule.userId, schedule.connectionId!, {
        question: `[scheduled] ${schedule.name}`,
        rowCount: result.rowCount,
        executionTimeMs,
      }).catch(() => {})

      // In-app notification: scheduled query completed
      createNotification(
        schedule.userId,
        'query_complete',
        `Scheduled query ran: ${schedule.name}`,
        `Returned ${result.rowCount.toLocaleString()} row${result.rowCount !== 1 ? 's' : ''} in ${executionTimeMs}ms.`,
        { scheduleId: schedule.id, rowCount: result.rowCount }
      ).catch(() => {})
      // NOTE: No driver.close() — pool manages lifecycle
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      // In-app notification: scheduled query failed
      createNotification(
        schedule.userId,
        'schedule_failed',
        `Scheduled query failed: ${schedule.name}`,
        lastError ?? 'An unknown error occurred.',
        { scheduleId: schedule.id }
      ).catch(() => {})
    }

    // Compute next run time
    const nextRunAt = getNextRunAt(schedule.frequency, now)

    await prisma.scheduledQuery.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        lastStatus: status,
        lastError,
        nextRunAt,
      },
    })

    results.push({ id: schedule.id, name: schedule.name, status, ...(lastError ? { error: lastError } : {}) })

    // Send notification emails (fire-and-forget — never block the cron response)
    if (isEmailConfigured() && schedule.notifyEmails.length > 0) {
      const notifyStatus = status as 'success' | 'failed'
      Promise.all(
        schedule.notifyEmails.map((email: string) =>
          sendScheduleNotificationEmail(email, schedule.name, notifyStatus, lastError).catch((err) =>
            console.warn(`[cron] Failed to send notification to ${email}:`, err)
          )
        )
      ).catch(() => {})
    }
  }

  const succeeded = results.filter((r) => r.status === 'success').length
  const failed = results.filter((r) => r.status === 'failed').length

  return NextResponse.json({ ran: results.length, succeeded, failed, results })
}

function getNextRunAt(frequency: string, from: Date): Date {
  switch (frequency) {
    case 'HOURLY':  return new Date(from.getTime() + 60 * 60 * 1000)
    case 'DAILY':   return new Date(from.getTime() + 24 * 60 * 60 * 1000)
    case 'WEEKLY':  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'MONTHLY': return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000)
    default:        return new Date(from.getTime() + 24 * 60 * 60 * 1000)
  }
}
