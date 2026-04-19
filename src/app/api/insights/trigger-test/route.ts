/**
 * POST /api/insights/trigger-test
 *
 * Directly runs the tenant analysis pipeline steps for the logged-in user
 * without needing Inngest Dev Server. Generates a real insight and saves it
 * to the database so it appears immediately on /dashboard/insights.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withKeyRotation, getGroqClient } from '@/lib/groq-keys'

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // ── 1. Fetch activity metrics ──────────────────────────────────────────
    const now = Date.now()
    const d7  = new Date(now - 7  * 24 * 60 * 60 * 1000)
    const d14 = new Date(now - 14 * 24 * 60 * 60 * 1000)
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000)

    const [
      queries7d,
      queries7d_prev,
      queries30d,
      connectionCount,
      savedQueryCount,
      topConnections,
    ] = await Promise.all([
      prisma.usageRecord.count({ where: { userId, action: 'QUERY', createdAt: { gte: d7 } } }),
      prisma.usageRecord.count({ where: { userId, action: 'QUERY', createdAt: { gte: d14, lt: d7 } } }),
      prisma.usageRecord.count({ where: { userId, action: 'QUERY', createdAt: { gte: d30 } } }),
      prisma.databaseConnection.count({ where: { userId, isActive: true } }),
      prisma.savedQuery.count({ where: { userId, isTemplate: false } }),
      prisma.queryHistory.groupBy({
        by: ['connectionName'],
        where: { userId, createdAt: { gte: d7 }, connectionName: { not: null }, status: 'success' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ])

    // WoW: if no queries last week, treat any queries this week as +100% growth
    const rawDelta = queries7d_prev === 0
      ? (queries7d > 0 ? 100 : 0)
      : Math.round(((queries7d - queries7d_prev) / queries7d_prev) * 100)
    const wowDelta = Math.max(-999, Math.min(999, rawDelta))

    const metrics = {
      queries7d,
      queries7d_prev,
      queries30d,
      wowDelta,
      wowDirection: (wowDelta > 5 ? 'up' : wowDelta < -5 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
      connectionCount,
      savedQueryCount,
      topConnections: topConnections.map((c) => ({
        name: c.connectionName ?? 'Unknown',
        count: c._count.id,
      })),
    }

    // ── 2. Generate narrative ──────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const name = user?.name ?? 'there'

    let narrative: string

    if (getGroqClient()) {
      const topConnStr = metrics.topConnections.length > 0
        ? metrics.topConnections.map((c) => `${c.name} (${c.count} queries)`).join(', ')
        : 'no connections used'

      const prompt = `Write a weekly data digest for ${name} with these stats:
- Queries this week: ${metrics.queries7d} (previous week: ${metrics.queries7d_prev}, ${metrics.wowDelta > 0 ? '+' : ''}${metrics.wowDelta}% week-over-week)
- Queries this month: ${metrics.queries30d}
- Active database connections: ${metrics.connectionCount}
- Saved queries: ${metrics.savedQueryCount}
- Most-used connections this week: ${topConnStr}

Mention the trend (${metrics.wowDirection}), highlight the most-used connection if relevant, and end with one actionable suggestion.`

      try {
        const completion = await withKeyRotation(groq => groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are a concise business intelligence analyst writing a weekly data digest email.
Write in a professional but friendly tone. Be specific with numbers. Keep it under 150 words.
Output plain text only — no markdown, no bullet points, no headers.`,
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.4,
        }))
        narrative = completion.choices[0]?.message?.content?.trim() ?? buildFallback(name, metrics)
      } catch {
        narrative = buildFallback(name, metrics)
      }
    } else {
      narrative = buildFallback(name, metrics)
    }

    // ── 3. Save to DB ──────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'NIGHTLY_INSIGHT_GENERATED',
        resource: 'system',
        metadata: {
          narrative,
          metrics,
          generatedAt: new Date().toISOString(),
        } as object,
      },
    })

    return NextResponse.json({ success: true, narrative, metrics })
  } catch (error) {
    console.error('[trigger-test insight]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate insight' },
      { status: 500 }
    )
  }
}

function buildFallback(name: string, m: {
  queries7d: number; queries7d_prev: number; queries30d: number
  wowDelta: number; wowDirection: string; connectionCount: number
  savedQueryCount: number; topConnections: { name: string; count: number }[]
}): string {
  const direction = m.wowDirection === 'up'
    ? `up ${m.wowDelta}%`
    : m.wowDirection === 'down'
    ? `down ${Math.abs(m.wowDelta)}%`
    : 'steady'
  const top = m.topConnections[0]
  return `Hi ${name}, here's your NatureQuery weekly digest. You ran ${m.queries7d} queries this week — ${direction} from last week — and ${m.queries30d} total this month. ${top ? `Your most active connection was "${top.name}" with ${top.count} queries. ` : ''}You have ${m.connectionCount} active connection${m.connectionCount !== 1 ? 's' : ''} and ${m.savedQueryCount} saved ${m.savedQueryCount !== 1 ? 'queries' : 'query'}. Keep exploring your data!`
}
