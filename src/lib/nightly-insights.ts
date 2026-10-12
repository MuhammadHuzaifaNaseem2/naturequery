/**
 * The daily jobs: each paying account's summary for the Insights page (after 02:00 UTC,
 * emailed on Mondays) and the audit-log integrity check (after 02:30 UTC).
 *
 * The schedule runner (/api/cron/run-schedules) calls these every hour. Each job claims a
 * JobRun row for the day before it starts, so a job runs once per day however often it
 * is called, and a missed hour is caught up by the next one.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withKeyRotation, getGroqClient } from '@/lib/groq-keys'
import { writeImmutableAuditLog, verifyChainIntegrity } from '@/lib/audit-immutable'
import { isEmailConfigured, sendWeeklySummaryEmail } from '@/lib/email'
import { weeklySummaryUnsubscribeToken } from '@/lib/email-unsubscribe'

export type InsightMetrics = {
  queries7d: number
  queries7d_prev: number
  queries30d: number
  wowDelta: number
  wowDirection: 'up' | 'down' | 'stable'
  connectionCount: number
  savedQueryCount: number
  /** Busiest connections, then one `other` row, so the counts add up to queries7d. */
  topConnections: { name: string; count: number; other?: boolean }[]
}

/** The row for queries that ran outside the named connections' question history. */
export const OTHER_ACTIVITY = 'Other activity'
const SHOWN_CONNECTIONS = 4

/**
 * The busiest connections (most first), then one "Other activity" row for whatever else
 * ran, so the rows add up to `total`: the same number the page shows as queries this week.
 */
export function busiestConnections(
  perConnection: { name: string; count: number }[],
  total: number
): InsightMetrics['topConnections'] {
  const busiest = perConnection.slice(0, SHOWN_CONNECTIONS)
  const rest = total - busiest.reduce((sum, c) => sum + c.count, 0)
  return rest > 0 ? [...busiest, { name: OTHER_ACTIVITY, count: rest, other: true }] : busiest
}

const DAY = 24 * 60 * 60 * 1000

/** The latest `hour:minute` UTC at or before `now`: the start of the current daily period. */
export function dailyPeriodStart(now: Date, hour: number, minute = 0): Date {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute)
  return new Date(start > now.getTime() ? start - DAY : start)
}

/** Monday's summary is the one that is emailed. */
export function isEmailDay(periodStart: Date): boolean {
  return periodStart.getUTCDay() === 1
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10)

export async function collectInsightMetrics(userId: string): Promise<InsightMetrics> {
  const now = Date.now()
  const d7 = new Date(now - 7 * DAY)
  const d14 = new Date(now - 14 * DAY)
  const d30 = new Date(now - 30 * DAY)

  // The totals count every query that ran (the same count as the plan's monthly quota):
  // questions asked on the website, dashboard charts refreshing, scheduled runs, the desktop
  // app and the API. Only website questions record which connection they used, so the
  // busiest connections come from that history and the rest is one "Other activity" row.
  const [queries7d, queries7d_prev, queries30d, connectionCount, savedQueryCount, perConnection] =
    await Promise.all([
      prisma.usageRecord.count({ where: { userId, action: 'QUERY', createdAt: { gte: d7 } } }),
      prisma.usageRecord.count({
        where: { userId, action: 'QUERY', createdAt: { gte: d14, lt: d7 } },
      }),
      prisma.usageRecord.count({ where: { userId, action: 'QUERY', createdAt: { gte: d30 } } }),
      prisma.databaseConnection.count({ where: { userId, isActive: true } }),
      prisma.savedQuery.count({ where: { userId, isTemplate: false } }),
      prisma.queryHistory.groupBy({
        by: ['connectionName'],
        // The sample store runs in the browser and is not counted toward the quota.
        where: {
          userId,
          createdAt: { gte: d7 },
          connectionName: { not: null, notIn: ['Demo Database'] },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ])

  const topConnections = busiestConnections(
    perConnection.map((c) => ({ name: c.connectionName ?? 'Unknown', count: c._count.id })),
    queries7d
  )

  const wowDelta =
    // Same rule as the live figures on the Insights page: a first active week is +100%.
    queries7d_prev === 0
      ? queries7d > 0
        ? 100
        : 0
      : Math.max(
          -999,
          Math.min(999, Math.round(((queries7d - queries7d_prev) / queries7d_prev) * 100))
        )

  return {
    queries7d,
    queries7d_prev,
    queries30d,
    wowDelta,
    wowDirection: wowDelta > 5 ? 'up' : wowDelta < -5 ? 'down' : 'stable',
    connectionCount,
    savedQueryCount,
    topConnections,
  }
}

export async function writeInsightNarrative(
  name: string | null,
  metrics: InsightMetrics
): Promise<string> {
  if (!getGroqClient()) return buildFallbackNarrative(name, metrics)
  try {
    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `You are a concise business intelligence analyst summarising one person's last seven days in a data tool.
Write in a professional but friendly tone. Be specific with numbers. Keep it under 150 words.
Output plain text only: no markdown, no bullet points, no headers, and no em dashes.`,
          },
          { role: 'user', content: buildNarrativePrompt(name, metrics) },
        ],
        // This model reasons before it writes, and the reasoning counts toward
        // max_tokens; 300 cut summaries off mid-sentence.
        reasoning_effort: 'low',
        max_tokens: 1200,
        temperature: 0.4,
      })
    )
    const choice = completion.choices[0]
    let text = choice?.message?.content?.trim() ?? ''
    // If it still ran out of room, keep only the complete sentences.
    if (choice?.finish_reason === 'length') {
      const end = Math.max(text.lastIndexOf('. '), text.lastIndexOf('.'))
      text = end > 40 ? text.slice(0, end + 1) : ''
    }
    // The model is asked for no em dashes; make sure of it.
    return text ? text.replace(/\s*—\s*/g, ', ') : buildFallbackNarrative(name, metrics)
  } catch {
    return buildFallbackNarrative(name, metrics)
  }
}

function buildNarrativePrompt(name: string | null, m: InsightMetrics): string {
  const named = m.topConnections.filter((c) => !c.other)
  const other = m.topConnections.find((c) => c.other)
  const topConnections =
    named.length > 0
      ? named.map((c) => `${c.name} (${c.count} queries)`).join(', ')
      : 'none from questions asked on the website'

  return `Summarise the last seven days for ${name ?? 'a user'} with these stats:
- Queries this week: ${m.queries7d} (${m.queries7d_prev === 0 ? 'none the week before, so no percentage change' : `previous week: ${m.queries7d_prev}, ${m.wowDelta > 0 ? '+' : ''}${m.wowDelta}% week over week`})
- Queries this month: ${m.queries30d}
- Active database connections: ${m.connectionCount}
- Saved queries: ${m.savedQueryCount}
- Most-used connections this week: ${topConnections}${other ? `\n- Other queries this week (dashboard charts, schedules, desktop app): ${other.count}` : ''}

Mention the trend (${m.queries7d_prev === 0 ? 'a first active week' : m.wowDirection}), highlight the most-used connection if relevant, and end with one practical suggestion.`
}

export function buildFallbackNarrative(name: string | null, m: InsightMetrics): string {
  const trend =
    m.queries7d_prev === 0
      ? m.queries7d > 0
        ? 'with none the week before'
        : null
      : m.wowDirection === 'up'
        ? `up ${m.wowDelta}% on last week`
        : m.wowDirection === 'down'
          ? `down ${Math.abs(m.wowDelta)}% on last week`
          : 'about the same as last week'
  const top = m.topConnections.find((c) => !c.other)
  const queries = (n: number) => `${n} quer${n !== 1 ? 'ies' : 'y'}`
  return `Hi ${name ?? 'there'}. You ran ${queries(m.queries7d)} this week${trend ? `, ${trend}` : ''}, and ${m.queries30d} this month. ${top ? `Your busiest connection was "${top.name}" with ${top.count}. ` : ''}You have ${m.connectionCount} active connection${m.connectionCount !== 1 ? 's' : ''} and ${m.savedQueryCount} saved ${m.savedQueryCount !== 1 ? 'queries' : 'query'}.`
}

/**
 * Writes one person's summary to their Insights page. With `email`, it is also sent to
 * them, unless they turned the weekly summary off.
 */
export async function generateInsight(
  userId: string,
  options: { email: boolean }
): Promise<{ insightId: string; narrative: string; metrics: InsightMetrics; emailSent: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, weeklySummaryEmail: true },
  })
  if (!user) throw new Error('User not found')

  const metrics = await collectInsightMetrics(userId)
  const narrative = await writeInsightNarrative(user.name, metrics)

  // Saved before the email, so a failed email is never followed by a second summary.
  const saved = await writeImmutableAuditLog({
    userId,
    action: 'NIGHTLY_INSIGHT_GENERATED',
    resource: 'system',
    metadata: { narrative, metrics, generatedAt: new Date().toISOString() },
  })

  let emailSent = false
  const token = weeklySummaryUnsubscribeToken(userId)
  if (options.email && user.weeklySummaryEmail && isEmailConfigured() && token) {
    try {
      await sendWeeklySummaryEmail({
        to: user.email,
        name: user.name,
        narrative,
        metrics,
        unsubscribeToken: token,
      })
      emailSent = true
    } catch (error) {
      console.error('[insights] weekly summary email failed for', userId, error)
    }
  }

  return { insightId: saved.id, narrative, metrics, emailSent }
}

// Claims a job for the day; false when another call already has it.
async function claim(key: string): Promise<boolean> {
  try {
    await prisma.jobRun.create({ data: { key } })
    return true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false
    }
    throw error
  }
}

/**
 * Writes today's summary for every paying account that doesn't have one yet, a few at a
 * time so one call stays well inside the function time limit.
 */
export async function runNightlyInsights(
  now: Date = new Date(),
  { maxUsers = 10, budgetMs = 40_000 }: { maxUsers?: number; budgetMs?: number } = {}
) {
  const started = Date.now()
  const period = dailyPeriodStart(now, 2)
  const day = dayKey(period)
  const email = isEmailDay(period)

  const eligible = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', plan: { in: ['PRO', 'ENTERPRISE'] } },
    select: { userId: true },
  })
  const keyFor = (userId: string) => `insight:${userId}:${day}`
  const done = new Set(
    (
      await prisma.jobRun.findMany({
        where: { key: { in: eligible.map((e) => keyFor(e.userId)) } },
        select: { key: true },
      })
    ).map((row) => row.key)
  )
  const due = eligible.filter((e) => !done.has(keyFor(e.userId)))

  let written = 0
  let emailed = 0
  let failed = 0
  for (const { userId } of due) {
    if (written + failed >= maxUsers || Date.now() - started > budgetMs) break
    const key = keyFor(userId)
    if (!(await claim(key))) continue
    try {
      const result = await generateInsight(userId, { email })
      written++
      if (result.emailSent) emailed++
    } catch (error) {
      failed++
      console.error('[insights] summary failed for', userId, error)
      // Let the next hourly call try again.
      await prisma.jobRun.delete({ where: { key } }).catch(() => {})
    }
  }

  return { day, emailDay: email, written, emailed, failed, waiting: due.length - written - failed }
}

/** Checks the last week of the system audit log once a day and records the result. */
export async function runDailyAuditCheck(now: Date = new Date()) {
  const period = dailyPeriodStart(now, 2, 30)
  if (!(await claim(`audit-chain:${dayKey(period)}`))) return null

  const result = await verifyChainIntegrity(null, new Date(now.getTime() - 7 * DAY))
  if (!result.valid) console.error('[audit] chain broken at', result.brokenAt, result.error)
  await writeImmutableAuditLog({
    userId: null,
    action: result.valid ? 'AUDIT_CHAIN_VERIFIED' : 'AUDIT_CHAIN_INTEGRITY_FAILED',
    resource: 'system',
    metadata: { ...result },
  })

  // Job records only need to outlive the day they guard.
  await prisma.jobRun.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } },
  })
  return { valid: result.valid, checked: result.checkedCount }
}
