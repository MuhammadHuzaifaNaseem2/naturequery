'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  metadata: Record<string, unknown> | null
  createdAt: string
}

export async function getNotifications(limit = 20): Promise<{
  success: boolean
  data?: { items: NotificationItem[]; unreadCount: number }
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  try {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ])

    return {
      success: true,
      data: {
        items: items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: n.read,
          metadata: n.metadata as Record<string, unknown> | null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      },
    }
  } catch (error) {
    return { success: false, error: 'Failed to fetch notifications' }
  }
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  try {
    await prisma.notification.update({
      where: { id, userId: session.user.id },
      data: { read: true },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean }> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, metadata: metadata ? (metadata as any) : undefined },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  try {
    await prisma.notification.delete({
      where: { id, userId: session.user.id },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}
