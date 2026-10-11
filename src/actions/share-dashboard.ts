'use server'

import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeSQLByConnection } from '@/actions/connections'
import { runDemoQuery } from '@/lib/demo-query'
import { readChartSnapshot, toChartSnapshot } from '@/lib/chart-snapshot'

export async function toggleDashboardSharing(
  isPublic: boolean
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const shareToken = isPublic ? crypto.randomBytes(32).toString('hex') : null

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isDashboardPublic: isPublic,
        dashboardShareToken: shareToken,
        // Turning the link off also stops sharing charts and drops their copies.
        ...(isPublic ? {} : { dashboardShareCharts: false }),
      },
    })
    if (!isPublic) await clearSnapshots(session.user.id)

    return { success: true, token: updatedUser.dashboardShareToken || undefined }
  } catch (error) {
    console.error('Failed to toggle dashboard sharing:', error)
    return { success: false, error: 'Failed to update sharing settings' }
  }
}

export async function getDashboardShareStatus(): Promise<{
  success: boolean
  isPublic: boolean
  token?: string
  showCharts?: boolean
  chartsUpdatedAt?: string
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized', isPublic: false }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isDashboardPublic: true, dashboardShareToken: true, dashboardShareCharts: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', isPublic: false }
    }

    return {
      success: true,
      isPublic: user.isDashboardPublic,
      token: user.dashboardShareToken || undefined,
      showCharts: user.dashboardShareCharts,
      chartsUpdatedAt: user.dashboardShareCharts
        ? await latestSnapshotAt(session.user.id)
        : undefined,
    }
  } catch (error) {
    console.error('Failed to get dashboard share status:', error)
    return { success: false, error: 'Failed to find user', isPublic: false }
  }
}

/**
 * Shows or hides the charts on the shared dashboard. Showing them runs each widget's
 * query once and stores the rows its chart draws; hiding them deletes those copies.
 */
export async function setDashboardChartSharing(show: boolean): Promise<{
  success: boolean
  showCharts?: boolean
  chartsUpdatedAt?: string
  failed?: number
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }
    const userId = session.user.id

    if (!show) {
      await prisma.user.update({ where: { id: userId }, data: { dashboardShareCharts: false } })
      await clearSnapshots(userId)
      return { success: true, showCharts: false }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isDashboardPublic: true },
    })
    if (!user?.isDashboardPublic) {
      return { success: false, error: 'Turn on the public link first.' }
    }

    const { updatedAt, failed } = await captureSnapshots(userId)
    await prisma.user.update({ where: { id: userId }, data: { dashboardShareCharts: true } })
    return { success: true, showCharts: true, chartsUpdatedAt: updatedAt, failed }
  } catch (error) {
    console.error('Failed to change chart sharing:', error)
    return { success: false, error: 'Failed to update sharing settings' }
  }
}

/** Runs each widget's query again and replaces the numbers on the shared dashboard. */
export async function updateSharedCharts(): Promise<{
  success: boolean
  chartsUpdatedAt?: string
  failed?: number
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dashboardShareCharts: true },
    })
    if (!user?.dashboardShareCharts) {
      return { success: false, error: 'Charts are not shared.' }
    }

    const { updatedAt, failed } = await captureSnapshots(session.user.id)
    return { success: true, chartsUpdatedAt: updatedAt, failed }
  } catch (error) {
    console.error('Failed to update shared charts:', error)
    return { success: false, error: 'Failed to update the shared charts' }
  }
}

export async function getPublicDashboardWidgets(token: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { dashboardShareToken: token, isDashboardPublic: true },
      select: { id: true, name: true, dashboardShareCharts: true },
    })

    if (!user) {
      return { success: false, error: 'Dashboard not found or is private' }
    }

    // Anyone with the link can load this, so send only what the page shows:
    // never the SQL, connection details or owner IDs (the share dialog promises that).
    // The rows behind each chart go out only when the owner chose to show the charts.
    const chartsShared = user.dashboardShareCharts
    const widgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        question: true,
        position: true,
        snapshot: chartsShared,
        snapshotAt: chartsShared,
      },
    })

    return {
      success: true,
      chartsShared,
      widgets: widgets.map((widget) => ({
        id: widget.id,
        title: widget.title,
        question: widget.question,
        position: widget.position,
        chart: chartsShared ? readChartSnapshot(widget.snapshot) : null,
        chartAt: chartsShared ? (widget.snapshotAt?.toISOString() ?? null) : null,
      })),
      ownerName: user.name || 'Anonymous User',
    }
  } catch (error) {
    console.error('Failed to fetch public dashboard:', error)
    return { success: false, error: 'Failed to load dashboard' }
  }
}

// Runs every widget once, the same way the owner's dashboard does, and stores the rows
// each chart draws. A widget that fails keeps its previous copy.
async function captureSnapshots(userId: string): Promise<{ updatedAt: string; failed: number }> {
  const widgets = await prisma.dashboardWidget.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    select: { id: true, sql: true, connectionId: true },
  })
  const updatedAt = new Date()
  let failed = 0

  for (const widget of widgets) {
    const result =
      widget.connectionId === 'demo'
        ? { success: true, data: runDemoQuery(widget.sql) }
        : widget.connectionId
          ? await executeSQLByConnection(widget.connectionId, widget.sql).catch(() => null)
          : null
    if (!result?.success || !result.data) {
      failed++
      continue
    }
    await prisma.dashboardWidget.update({
      where: { id: widget.id },
      data: {
        snapshot: toChartSnapshot(
          result.data.rows,
          result.data.fields
        ) as unknown as Prisma.InputJsonValue,
        snapshotAt: updatedAt,
      },
    })
  }
  return { updatedAt: updatedAt.toISOString(), failed }
}

async function clearSnapshots(userId: string) {
  await prisma.dashboardWidget.updateMany({
    where: { userId },
    data: { snapshot: Prisma.DbNull, snapshotAt: null },
  })
}

async function latestSnapshotAt(userId: string): Promise<string | undefined> {
  const latest = await prisma.dashboardWidget.aggregate({
    where: { userId },
    _max: { snapshotAt: true },
  })
  return latest._max.snapshotAt?.toISOString()
}
