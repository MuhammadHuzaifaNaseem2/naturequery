'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface ChecklistState {
  connectedDb: boolean
  askedFirstQuestion: boolean
  pinnedChart: boolean
  invitedTeamMember: boolean
  setupSchedule: boolean
  dismissed: boolean
}

const DEFAULT_STATE: ChecklistState = {
  connectedDb: false,
  askedFirstQuestion: false,
  pinnedChart: false,
  invitedTeamMember: false,
  setupSchedule: false,
  dismissed: false,
}

export async function getChecklistState(): Promise<{
  success: boolean
  data?: ChecklistState
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  try {
    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { userId: session.user.id },
    })

    if (!checklist) {
      // Auto-create if not exists
      const created = await prisma.onboardingChecklist.create({
        data: { userId: session.user.id },
      })
      return { success: true, data: DEFAULT_STATE }
    }

    return {
      success: true,
      data: {
        connectedDb: checklist.connectedDb,
        askedFirstQuestion: checklist.askedFirstQuestion,
        pinnedChart: checklist.pinnedChart,
        invitedTeamMember: checklist.invitedTeamMember,
        setupSchedule: checklist.setupSchedule,
        dismissed: checklist.dismissed,
      },
    }
  } catch (error) {
    return { success: false, error: 'Failed to fetch checklist' }
  }
}

export async function updateChecklistItem(
  item: keyof Omit<ChecklistState, 'dismissed'>,
  value: boolean
): Promise<{ success: boolean; data?: ChecklistState }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  try {
    const checklist = await prisma.onboardingChecklist.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, [item]: value },
      update: { [item]: value },
    })

    return {
      success: true,
      data: {
        connectedDb: checklist.connectedDb,
        askedFirstQuestion: checklist.askedFirstQuestion,
        pinnedChart: checklist.pinnedChart,
        invitedTeamMember: checklist.invitedTeamMember,
        setupSchedule: checklist.setupSchedule,
        dismissed: checklist.dismissed,
      },
    }
  } catch {
    return { success: false }
  }
}

export async function dismissChecklist(): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false }

  try {
    await prisma.onboardingChecklist.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, dismissed: true },
      update: { dismissed: true },
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}
