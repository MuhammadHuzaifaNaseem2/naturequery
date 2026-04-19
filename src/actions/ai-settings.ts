'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

/**
 * Save the user's own Groq API key (encrypted).
 * When set, AI requests use this key instead of the shared system key,
 * giving the user their own rate-limit bucket.
 */
export async function saveUserGroqApiKey(apiKey: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const trimmed = apiKey.trim()
  if (!trimmed.startsWith('gsk_') || trimmed.length < 20) {
    return { success: false, error: 'Invalid Groq API key. It should start with "gsk_".' }
  }

  try {
    const encrypted = encrypt(trimmed)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { groqApiKey: encrypted },
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to save API key' }
  }
}

/**
 * Remove the user's Groq API key — fall back to the shared system key.
 */
export async function removeUserGroqApiKey() {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { groqApiKey: null },
  })
  return { success: true }
}

/**
 * Check whether the user has a custom Groq API key saved.
 * Never returns the actual key — just whether one exists.
 */
export async function hasUserGroqApiKey() {
  const session = await auth()
  if (!session?.user?.id) return { hasKey: false }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { groqApiKey: true },
  })
  return { hasKey: !!user?.groqApiKey }
}

/**
 * Resolve the Groq API key for a given user.
 * Priority: user's own key > system env var > null (mock mode).
 * Called internally from server actions / API routes — not exposed to client.
 */
export async function resolveGroqApiKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { groqApiKey: true },
  })

  if (user?.groqApiKey) {
    try {
      return decrypt(user.groqApiKey)
    } catch {
      // Corrupted — fall through to system key
    }
  }

  return process.env.GROQ_API_KEY || null
}
