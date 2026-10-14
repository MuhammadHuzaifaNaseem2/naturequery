/**
 * GDPR / Right-to-Access endpoint, behind "Download my data" in Settings, Security.
 *
 * Returns a JSON export of the personal data held for the signed-in user (GDPR
 * Art. 15 and 20). Secrets are never included: password hash, 2FA secret and
 * backup codes, database and store passwords, API key secrets, the user's own AI
 * key, and sign-in tokens.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import { prisma } from '@/lib/prisma'
import { rateLimitAsync } from '@/lib/rate-limit'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Rate-limit: allow 1 export per 10 minutes per user to prevent abuse
  const limit = await rateLimitAsync(`data-export:${userId}`, {
    maxRequests: 1,
    windowSeconds: 600,
  })
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60))
    return NextResponse.json(
      {
        error: `You downloaded your data a moment ago. You can download it again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  // Fetch all user data in parallel
  const [
    user,
    accounts,
    connections,
    storeConnections,
    savedQueries,
    queryHistory,
    apiKeys,
    auditLogs,
    subscription,
    usageRecords,
    dashboardWidgets,
    scheduledQueries,
    teamMemberships,
    desktopSessions,
    notifications,
    onboardingChecklist,
    aiAnswerFeedback,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        emailVerified: true,
        twoFactorEnabled: true,
        onboardingCompleted: true,
        locale: true,
        isDashboardPublic: true,
        dashboardShareCharts: true,
        weeklySummaryEmail: true,
        groqApiKey: true, // only whether one is saved, below; never the key
        // Exclude: password, twoFactorSecret, backupCodes (sensitive security data)
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { provider: true, type: true },
    }),
    prisma.databaseConnection.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        dbType: true,
        host: true,
        port: true,
        database: true,
        user: true,
        ssl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Exclude: password
      },
    }),
    prisma.commerceConnection.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        provider: true,
        storeUrl: true,
        isActive: true,
        createdAt: true,
        // Exclude: credentials
      },
    }),
    prisma.savedQuery.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        question: true,
        sql: true,
        connectionName: true,
        isPublic: true,
        isFavorite: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000, // cap at last 1000 entries for payload size
      select: {
        id: true,
        question: true,
        sql: true,
        connectionName: true,
        rowCount: true,
        executionTimeMs: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        // Exclude: key (hashed secret)
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        ipAddress: true,
        createdAt: true,
        // Exclude: metadata (may contain internal details)
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
        createdAt: true,
      },
    }),
    prisma.usageRecord.count({ where: { userId } }),
    prisma.dashboardWidget.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        question: true,
        sql: true,
        connectionName: true,
        position: true,
        snapshot: true,
        snapshotAt: true,
        createdAt: true,
      },
    }),
    prisma.scheduledQuery.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        question: true,
        sql: true,
        connectionName: true,
        frequency: true,
        timeOfDay: true,
        dayOfWeek: true,
        dayOfMonth: true,
        timezone: true,
        notifyEmails: true,
        enabled: true,
        lastRunAt: true,
        nextRunAt: true,
        lastStatus: true,
        createdAt: true,
      },
    }),
    prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true, slug: true, createdAt: true } },
      },
    }),
    prisma.desktopSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        deviceName: true,
        platform: true,
        appVersion: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        // Exclude: token hashes
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { type: true, title: true, message: true, read: true, createdAt: true },
    }),
    prisma.onboardingChecklist.findUnique({
      where: { userId },
      select: {
        connectedDb: true,
        askedFirstQuestion: true,
        pinnedChart: true,
        invitedTeamMember: true,
        setupSchedule: true,
        dismissed: true,
        createdAt: true,
      },
    }),
    prisma.queryFeedback.findMany({
      where: { userId },
      select: {
        question: true,
        generatedSql: true,
        correctedSql: true,
        rating: true,
        createdAt: true,
      },
    }),
  ])

  const { groqApiKey, ...profile } = user ?? { groqApiKey: null }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.1',
    notice:
      'This file contains the personal data held by NatureQuery for your account. ' +
      'Secrets are excluded for your protection: your password, 2FA secret and backup codes, ' +
      'database and store passwords, API key secrets, your own AI key and sign-in tokens.',
    profile: user ? profile : null,
    settings: user
      ? {
          language: user.locale,
          weeklySummaryEmail: user.weeklySummaryEmail,
          publicDashboard: user.isDashboardPublic,
          publicDashboardShowsCharts: user.dashboardShareCharts,
          ownAiKeySaved: Boolean(groqApiKey),
          twoFactorEnabled: user.twoFactorEnabled,
        }
      : null,
    connectedProviders: accounts.map((a) => ({ provider: a.provider, type: a.type })),
    databaseConnections: {
      note: 'Your own connections. Passwords are not included. "ssl: true" means the server certificate is checked.',
      connections,
    },
    storeConnections: {
      note: 'Store credentials are not included.',
      connections: storeConnections,
    },
    subscription,
    usageSummary: { totalQueriesRecorded: usageRecords },
    savedQueries,
    queryHistory: {
      note: 'Showing last 1,000 entries',
      entries: queryHistory,
    },
    dashboardWidgets,
    scheduledQueries,
    apiKeys: {
      note: 'API key secrets are not included. Only metadata is shown.',
      keys: apiKeys,
    },
    teamMemberships: teamMemberships.map((m) => ({
      team: m.team,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    desktopSignIns: {
      note: 'Computers where NatureQuery Desktop was signed in. Sign-in tokens are not included.',
      sessions: desktopSessions,
    },
    notifications: {
      note: 'Showing last 500 notifications',
      entries: notifications,
    },
    onboardingChecklist,
    aiAnswerFeedback,
    auditLog: {
      note: 'Showing last 500 events',
      events: auditLogs,
    },
  }

  // Log this export in the tamper-evident audit trail
  await writeImmutableAuditLog({
    userId,
    action: 'DATA_EXPORT',
    resource: 'user',
    resourceId: userId,
  }).catch((error) => console.error('[export-data] audit log failed:', error))

  const filename = `naturequery-data-export-${new Date().toISOString().split('T')[0]}.json`

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
