'use server'

import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanLimits } from '@/lib/plan-limits'

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user as { id: string; name?: string | null }
}

/**
 * Generate a share token for a saved query. Makes it public and creates a unique token.
 */
export async function generateShareLink(queryId: string): Promise<{
  success: boolean
  shareToken?: string
  error?: string
}> {
  try {
    const user = await requireUser()

    // Query sharing requires PRO or Enterprise
    const limitCheck = await checkPlanLimits(user.id, 'SHARE_QUERY')
    if (!limitCheck.allowed) {
      return {
        success: false,
        error:
          'Sharing queries requires a Pro or Enterprise plan. Upgrade to share results with your team.',
      }
    }

    const query = await prisma.savedQuery.findFirst({
      where: { id: queryId, userId: user.id },
    })
    if (!query) return { success: false, error: 'Query not found' }

    // If already has a token, return it
    if (query.shareToken) {
      return { success: true, shareToken: query.shareToken }
    }

    const shareToken = crypto.randomBytes(16).toString('hex')

    await prisma.savedQuery.update({
      where: { id: queryId },
      data: { shareToken, isPublic: true },
    })

    return { success: true, shareToken }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate share link',
    }
  }
}

/**
 * Revoke a share link (remove token, make private).
 */
export async function revokeShareLink(queryId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const user = await requireUser()

    const query = await prisma.savedQuery.findFirst({
      where: { id: queryId, userId: user.id },
    })
    if (!query) return { success: false, error: 'Query not found' }

    await prisma.savedQuery.update({
      where: { id: queryId },
      data: { shareToken: null, isPublic: false },
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke share link',
    }
  }
}
