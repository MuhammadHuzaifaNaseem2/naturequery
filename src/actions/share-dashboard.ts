'use server'

import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      },
    })

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
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized', isPublic: false }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isDashboardPublic: true, dashboardShareToken: true },
    })

    if (!user) {
      return { success: false, error: 'User not found', isPublic: false }
    }

    return {
      success: true,
      isPublic: user.isDashboardPublic,
      token: user.dashboardShareToken || undefined,
    }
  } catch (error) {
    console.error('Failed to get dashboard share status:', error)
    return { success: false, error: 'Failed to find user', isPublic: false }
  }
}

export async function getPublicDashboardWidgets(token: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { dashboardShareToken: token, isDashboardPublic: true },
    })

    if (!user) {
      return { success: false, error: 'Dashboard not found or is private' }
    }

    const widgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { position: 'asc' },
    })

    return {
      success: true,
      widgets,
      ownerName: user.name || 'Anonymous User',
    }
  } catch (error) {
    console.error('Failed to fetch public dashboard:', error)
    return { success: false, error: 'Failed to load dashboard' }
  }
}
