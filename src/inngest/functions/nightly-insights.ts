import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'
import { withKeyRotation, getGroqClient } from '@/lib/groq-keys'

// ---------------------------------------------------------------------------
// Orchestrator — 2AM UTC nightly, fans out one event per eligible tenant
// ---------------------------------------------------------------------------

export const nightlyInsightOrchestrator = inngest.createFunction(
  {
    id: 'nightly-insight-orchestrator',
    name: 'Nightly Insight Orchestrator',
    retries: 1,
    triggers: [{ cron: 'TZ=UTC 0 2 * * *' }],
  },
  async ({ step }) => {
    const tenants = await step.run('fetch-eligible-tenants', async () => {
      return prisma.subscription.findMany({
        where: { status: 'ACTIVE', plan: { in: ['PRO', 'ENTERPRISE'] } },
        select: { userId: true },
      })
    })

    if (tenants.length === 0) return { message: 'No eligible tenants' }

    await step.sendEvent(
      'fan-out-tenant-analysis',
      tenants.map((t) => ({
        name: 'agent/tenant.analyze' as const,
        data: { tenantId: t.userId },
      }))
    )

    return { fanned_out: tenants.length }
  }
)

// ---------------------------------------------------------------------------
// Per-tenant analysis pipeline
// Steps: fetch activity → compute trends → generate narrative → email → persist
// ---------------------------------------------------------------------------

export const tenantAnalysisPipeline = inngest.createFunction(
  {
    id: 'tenant-analysis-pipeline',
    name: 'Tenant Analysis Pipeline',
    concurrency: { limit: 1, key: 'event.data.tenantId' },
    retries: 2,
    triggers: [{ event: 'agent/tenant.analyze' }],
  },
  async ({ event, step }) => {
    const { tenantId } = (event as unknown as { data: { tenantId: string } }).data

    // ── Step 1: Load tenant profile ──────────────────────────────────────────
    const tenantProfile = await step.run('load-tenant-profile', async () => {
      const user = await prisma.user.findUnique({
        where: { id: tenantId },
        select: { name: true, email: true },
      })
      if (!user) throw new Error(`Tenant ${tenantId} not found`)
      return user
    })

    // ── Step 2: Fetch activity metrics ───────────────────────────────────────
    const metrics = await step.run('fetch-metrics', async () => {
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
        prisma.usageRecord.count({
          where: { userId: tenantId, action: 'QUERY', createdAt: { gte: d7 } },
        }),
        prisma.usageRecord.count({
          where: { userId: tenantId, action: 'QUERY', createdAt: { gte: d14, lt: d7 } },
        }),
        prisma.usageRecord.count({
          where: { userId: tenantId, action: 'QUERY', createdAt: { gte: d30 } },
        }),
        prisma.databaseConnection.count({
          where: { userId: tenantId, isActive: true },
        }),
        prisma.savedQuery.count({ where: { userId: tenantId } }),
        // Most-queried connections this week (by query history)
        prisma.queryHistory.groupBy({
          by: ['connectionName'],
          where: { userId: tenantId, createdAt: { gte: d7 }, connectionName: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 3,
        }),
      ])

      const wowDelta = queries7d_prev === 0
        ? 0
        : Math.round(((queries7d - queries7d_prev) / queries7d_prev) * 100)

      return {
        queries7d,
        queries7d_prev,
        queries30d,
        wowDelta,
        wowDirection: wowDelta > 5 ? 'up' : wowDelta < -5 ? 'down' : 'stable',
        connectionCount,
        savedQueryCount,
        topConnections: topConnections.map((c) => ({
          name: c.connectionName ?? 'Unknown',
          count: c._count.id,
        })),
      }
    })

    // Inngest JSON-serializes step results; re-assert the literal union
    const typedMetrics = metrics as Metrics

    // ── Step 3: Generate narrative via Groq ──────────────────────────────────
    const narrative = await step.run('generate-narrative', async () => {
      if (!getGroqClient()) {
        return buildFallbackNarrative(tenantProfile.name, typedMetrics)
      }

      const prompt = buildNarrativePrompt(tenantProfile.name, typedMetrics)

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
        return completion.choices[0]?.message?.content?.trim() ?? buildFallbackNarrative(tenantProfile.name, typedMetrics)
      } catch {
        return buildFallbackNarrative(tenantProfile.name, typedMetrics)
      }
    })

    // ── Step 4: Build insight record ─────────────────────────────────────────
    const insightData = {
      narrative,
      metrics: typedMetrics,
      generatedAt: new Date().toISOString(),
    }

    // ── Step 5: Send email digest ────────────────────────────────────────────
    const emailSent = await step.run('send-email', async () => {
      const { isEmailConfigured } = await import('@/lib/email')
      if (!isEmailConfigured()) {
        console.log(`[INSIGHT] Email not configured — skipping for ${tenantProfile.email}`)
        console.log(`[INSIGHT] Narrative:\n${narrative}`)
        return false
      }

      await sendInsightEmail(
        tenantProfile.email,
        tenantProfile.name ?? 'there',
        narrative,
        typedMetrics
      )
      return true
    })

    // ── Step 6: Persist insight to DB ────────────────────────────────────────
    const saved = await step.run('persist-insight', async () => {
      return prisma.auditLog.create({
        data: {
          userId: tenantId,
          action: 'NIGHTLY_INSIGHT_GENERATED',
          resource: 'system',
          metadata: insightData as object,
        },
        select: { id: true },
      })
    })

    return {
      tenantId,
      insightId: saved.id,
      queries7d: metrics.queries7d,
      wowDelta: metrics.wowDelta,
      emailSent,
    }
  }
)

// ---------------------------------------------------------------------------
// Audit chain integrity check — 2:30AM UTC
// ---------------------------------------------------------------------------

export const auditChainVerifier = inngest.createFunction(
  {
    id: 'audit-chain-integrity-check',
    name: 'Audit Chain Integrity Check',
    retries: 1,
    triggers: [{ cron: 'TZ=UTC 30 2 * * *' }],
  },
  async ({ step }) => {
    const { verifyChainIntegrity } = await import('@/lib/audit-immutable')

    const result = await step.run('verify-system-chain', () =>
      verifyChainIntegrity(null, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    )

    if (!result.valid) {
      console.error('[AUDIT INTEGRITY] Chain broken at:', result.brokenAt)
      await step.run('log-failure', async () => {
        await prisma.auditLog.create({
          data: {
            userId: null,
            action: 'AUDIT_CHAIN_INTEGRITY_FAILED',
            resource: 'system',
            metadata: result as object,
          },
        })
      })
    }

    return { valid: result.valid, checked: result.checkedCount }
  }
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Metrics = {
  queries7d: number
  queries7d_prev: number
  queries30d: number
  wowDelta: number
  wowDirection: 'up' | 'down' | 'stable'
  connectionCount: number
  savedQueryCount: number
  topConnections: { name: string; count: number }[]
}

function buildNarrativePrompt(name: string | null, m: Metrics): string {
  const topConnStr = m.topConnections.length > 0
    ? m.topConnections.map((c) => `${c.name} (${c.count} queries)`).join(', ')
    : 'no connections used'

  return `Write a weekly data digest for ${name ?? 'a user'} with these stats:
- Queries this week: ${m.queries7d} (previous week: ${m.queries7d_prev}, ${m.wowDelta > 0 ? '+' : ''}${m.wowDelta}% week-over-week)
- Queries this month: ${m.queries30d}
- Active database connections: ${m.connectionCount}
- Saved queries: ${m.savedQueryCount}
- Most-used connections this week: ${topConnStr}

Mention the trend (${m.wowDirection}), highlight the most-used connection if relevant, and end with one actionable suggestion.`
}

function buildFallbackNarrative(name: string | null, m: Metrics): string {
  const direction = m.wowDirection === 'up'
    ? `up ${m.wowDelta}%`
    : m.wowDirection === 'down'
    ? `down ${Math.abs(m.wowDelta)}%`
    : 'steady'

  const top = m.topConnections[0]

  return `Hi ${name ?? 'there'}, here's your NatureQuery weekly digest. You ran ${m.queries7d} queries this week — ${direction} from last week — and ${m.queries30d} total this month. ${top ? `Your most active connection was "${top.name}" with ${top.count} queries. ` : ''}You have ${m.connectionCount} active connection${m.connectionCount !== 1 ? 's' : ''} and ${m.savedQueryCount} saved ${m.savedQueryCount !== 1 ? 'queries' : 'query'}. Keep exploring your data!`
}

async function sendInsightEmail(
  email: string,
  name: string,
  narrative: string,
  metrics: Metrics
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const from = process.env.EMAIL_FROM || 'NatureQuery <onboarding@resend.dev>'

  const trendBadgeColor = metrics.wowDirection === 'up'
    ? '#10b981'
    : metrics.wowDirection === 'down'
    ? '#ef4444'
    : '#6366f1'

  const trendLabel = metrics.wowDirection === 'up'
    ? `↑ ${metrics.wowDelta}% vs last week`
    : metrics.wowDirection === 'down'
    ? `↓ ${Math.abs(metrics.wowDelta)}% vs last week`
    : '→ Steady vs last week'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 28px 32px; }
    .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #fff; }
    .header p { margin: 0; font-size: 13px; color: rgba(255,255,255,0.75); }
    .body { padding: 28px 32px; color: #3f3f46; font-size: 15px; line-height: 1.7; }
    .narrative { background: #fafafa; border-left: 3px solid #6366f1; padding: 16px 20px; border-radius: 0 8px 8px 0; font-size: 14px; color: #3f3f46; margin: 20px 0; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .stat-card { background: #f4f4f5; border-radius: 10px; padding: 14px 16px; }
    .stat-value { font-size: 26px; font-weight: 700; color: #18181b; line-height: 1; }
    .stat-label { font-size: 12px; color: #71717a; margin-top: 4px; }
    .trend-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; color: #fff; background: ${trendBadgeColor}; margin-left: 8px; vertical-align: middle; }
    .top-connections { margin: 16px 0; }
    .conn-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; }
    .conn-row:last-child { border-bottom: none; }
    .conn-bar-wrap { flex: 1; margin: 0 12px; height: 4px; background: #e4e4e7; border-radius: 99px; overflow: hidden; }
    .conn-bar { height: 100%; background: #6366f1; border-radius: 99px; }
    .btn { display: inline-block; padding: 12px 28px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 32px; background: #fafafa; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Your Weekly Data Digest</h1>
    <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  <div class="body">
    <p>Hi <strong>${name}</strong>,</p>

    <div class="narrative">${narrative}</div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${metrics.queries7d}<span class="trend-badge">${trendLabel}</span></div>
        <div class="stat-label">Queries this week</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${metrics.queries30d}</div>
        <div class="stat-label">Queries this month</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${metrics.connectionCount}</div>
        <div class="stat-label">Active connections</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${metrics.savedQueryCount}</div>
        <div class="stat-label">Saved queries</div>
      </div>
    </div>

    ${metrics.topConnections.length > 0 ? `
    <p style="font-size:13px; font-weight:600; color:#18181b; margin-bottom:8px;">Most active connections this week</p>
    <div class="top-connections">
      ${metrics.topConnections.map((c, i) => {
        const maxCount = metrics.topConnections[0].count
        const pct = Math.round((c.count / maxCount) * 100)
        return `<div class="conn-row">
          <span style="color:#3f3f46; min-width:120px;">${c.name}</span>
          <div class="conn-bar-wrap"><div class="conn-bar" style="width:${pct}%"></div></div>
          <span style="color:#71717a; min-width:60px; text-align:right;">${c.count} queries</span>
        </div>`
      }).join('')}
    </div>` : ''}

    <p style="text-align:center; margin: 28px 0 8px;">
      <a href="${appUrl}/dashboard" class="btn">Open Dashboard →</a>
    </p>
  </div>
  <div class="footer">&copy; ${new Date().getFullYear()} NatureQuery · <a href="${appUrl}/settings" style="color:#a1a1aa;">Manage notifications</a></div>
</div>
</body>
</html>`

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: `Your NatureQuery weekly digest — ${metrics.queries7d} queries this week`,
        html,
      }),
    })
    if (!res.ok) throw new Error(`Resend error: ${await res.text()}`)
    return
  }

  // SMTP fallback
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
    await transporter.sendMail({
      from,
      to: email,
      subject: `Your NatureQuery weekly digest — ${metrics.queries7d} queries this week`,
      html,
    })
  }
}
