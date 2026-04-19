/**
 * GDPR / Right-to-Access endpoint.
 *
 * Returns a complete JSON export of all personal data held for the
 * authenticated user. This satisfies Art. 20 GDPR "data portability".
 *
 * The response is streamed as a JSON file download.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
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
    return NextResponse.json(
      { error: 'Too many export requests. Please wait 10 minutes before trying again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  // Fetch all user data in parallel
  const [
    user,
    accounts,
    savedQueries,
    queryHistory,
    apiKeys,
    auditLogs,
    subscription,
    usageRecords,
    dashboardWidgets,
    scheduledQueries,
    teamMemberships,
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
        // Exclude: password, twoFactorSecret, backupCodes (sensitive security data)
      },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { provider: true, type: true },
    }),
    prisma.savedQuery.findMany({
      where: { userId },
      select: {
        id: true, name: true, description: true, question: true, sql: true,
        connectionName: true, isPublic: true, isFavorite: true, tags: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000, // cap at last 1000 entries for payload size
      select: {
        id: true, question: true, sql: true, connectionName: true,
        rowCount: true, executionTimeMs: true, status: true, createdAt: true,
      },
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true, name: true, prefix: true,
        lastUsedAt: true, expiresAt: true, createdAt: true,
        // Exclude: key (hashed secret)
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true, action: true, resource: true, resourceId: true,
        ipAddress: true, createdAt: true,
        // Exclude: metadata (may contain internal details)
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true, status: true, currentPeriodStart: true,
        currentPeriodEnd: true, cancelAtPeriodEnd: true, createdAt: true,
      },
    }),
    prisma.usageRecord.count({ where: { userId } }),
    prisma.dashboardWidget.findMany({
      where: { userId },
      select: {
        id: true, title: true, question: true, connectionName: true,
        position: true, createdAt: true,
      },
    }),
    prisma.scheduledQuery.findMany({
      where: { userId },
      select: {
        id: true, name: true, question: true, frequency: true,
        enabled: true, lastRunAt: true, nextRunAt: true,
        lastStatus: true, createdAt: true,
      },
    }),
    prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true, slug: true, createdAt: true } },
      },
    }),
  ])

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0',
    notice:
      'This file contains all personal data held by NatureQuery for your account. ' +
      'Security credentials (password hash, 2FA secret, backup codes) are excluded for your protection.',
    profile: user,
    connectedProviders: accounts.map((a) => ({ provider: a.provider, type: a.type })),
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
    auditLog: {
      note: 'Showing last 500 events',
      events: auditLogs,
    },
  }

  // Log this export for audit trail
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DATA_EXPORT',
      resource: 'user',
      resourceId: userId,
      metadata: { exportedAt: new Date().toISOString() },
    },
  })

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
