'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanLimits } from '@/lib/plan-limits'
import { rateLimitAsync } from '@/lib/rate-limit'
import { validateInput, SaveQueryApiSchema, UpdateQuerySchema, IdSchema } from '@/lib/validation'

// ─── Helpers ────────────────────────────────────────────────────────────

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface QueryHistoryItem {
  id: string
  question: string
  sql: string
  connectionId: string | null
  connectionName: string | null
  rowCount: number | null
  executionTimeMs: number | null
  status: string
  errorMessage: string | null
  createdAt: string
}

export interface SavedQueryItem {
  id: string
  name: string
  description: string | null
  question: string
  sql: string
  connectionId: string | null
  connectionName: string | null
  isPublic: boolean
  isFavorite: boolean
  isTemplate: boolean
  templateCategory: string | null
  tags: string[]
  shareToken: string | null
  createdAt: string
  updatedAt: string
}

// ─── Query History Actions ──────────────────────────────────────────────

export async function addHistoryEntry(input: {
  question: string
  sql: string
  connectionId?: string | null
  connectionName?: string | null
  rowCount?: number | null
  executionTimeMs?: number | null
  status?: string
  errorMessage?: string | null
}): Promise<{ success: boolean; data?: QueryHistoryItem; error?: string }> {
  try {
    const user = await requireUser()

    const entry = await prisma.queryHistory.create({
      data: {
        question: input.question,
        sql: input.sql,
        userId: user.id!,
        connectionId: input.connectionId || null,
        connectionName: input.connectionName || null,
        rowCount: input.rowCount ?? null,
        executionTimeMs: input.executionTimeMs ?? null,
        status: input.status || 'success',
        errorMessage: input.errorMessage || null,
      },
    })

    return {
      success: true,
      data: {
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add history entry',
    }
  }
}

export async function getQueryHistory(filters?: {
  connectionId?: string
  search?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<{
  success: boolean
  data?: { items: QueryHistoryItem[]; total: number; page: number; totalPages: number }
  error?: string
}> {
  try {
    const user = await requireUser()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50

    const where: any = { userId: user.id }
    if (filters?.connectionId) where.connectionId = filters.connectionId
    if (filters?.status) where.status = filters.status
    if (filters?.search) {
      where.OR = [
        { question: { contains: filters.search, mode: 'insensitive' } },
        { sql: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.queryHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.queryHistory.count({ where }),
    ])

    return {
      success: true,
      data: {
        items: items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
        total,
        page,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history',
    }
  }
}

export async function deleteHistoryEntry(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser()

    // First verify the entry exists and belongs to this user
    const entry = await prisma.queryHistory.findFirst({
      where: { id, userId: user.id! },
      select: { id: true },
    })

    if (!entry) {
      return { success: false, error: 'Entry not found or not authorized' }
    }

    // Delete by primary key (guaranteed single row)
    await prisma.queryHistory.delete({ where: { id: entry.id } })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete history entry',
    }
  }
}

export async function clearQueryHistory(
  connectionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser()
    const where: any = { userId: user.id }
    if (connectionId) where.connectionId = connectionId
    await prisma.queryHistory.deleteMany({ where })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear history',
    }
  }
}

// ─── Saved Queries Actions ──────────────────────────────────────────────

export async function saveQuery(input: {
  name: string
  description?: string
  question: string
  sql: string
  connectionId?: string | null
  connectionName?: string | null
  tags?: string[]
  isPublic?: boolean
}): Promise<{ success: boolean; data?: SavedQueryItem; error?: string }> {
  try {
    const user = await requireUser()

    // Rate limit
    const rl = await rateLimitAsync(`query_save:${user.id}`, { maxRequests: 20, windowSeconds: 60 })
    if (!rl.allowed) return { success: false, error: 'Too many requests' }

    // Validation
    const validated = validateInput(SaveQueryApiSchema, input)
    if (!validated.success) return { success: false, error: validated.error }
    const data = validated.data

    // Check plan limit — FREE users can save up to 10 queries
    const limitCheck = await checkPlanLimits(user.id!, 'SAVE_QUERY')
    if (!limitCheck.allowed) {
      const message =
        limitCheck.limit === 0
          ? `Saving queries requires a Pro or Enterprise plan.`
          : `Saved query limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade to save unlimited queries.`
      return { success: false, error: message }
    }

    const query = await prisma.savedQuery.create({
      data: {
        name: data.name,
        description: data.description || null,
        question: data.question,
        sql: data.sql || '',
        userId: user.id!,
        connectionId: data.connectionId || null,
        connectionName: data.connectionName || null,
        tags: data.tags || [],
        isPublic: data.isPublic || false,
      },
    })

    return {
      success: true,
      data: {
        ...query,
        createdAt: query.createdAt.toISOString(),
        updatedAt: query.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save query',
    }
  }
}

export async function getSavedQueries(filters?: {
  connectionId?: string
  search?: string
  tags?: string[]
  isFavorite?: boolean
  page?: number
  pageSize?: number
}): Promise<{
  success: boolean
  data?: { items: SavedQueryItem[]; total: number; page: number; totalPages: number }
  error?: string
}> {
  try {
    const user = await requireUser()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50

    // Scope strictly to the current user — never leak other users' queries.
    // Public queries are accessed via share token on /shared/:token, not here.
    // Exclude templates — they show in QueryTemplates component instead.
    const where: any = { userId: user.id, isTemplate: false }
    if (filters?.connectionId) where.connectionId = filters.connectionId
    if (filters?.isFavorite !== undefined) {
      where.isFavorite = filters.isFavorite
    }
    if (filters?.search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { question: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ]
    }
    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags }
    }

    const [items, total] = await Promise.all([
      prisma.savedQuery.findMany({
        where,
        orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.savedQuery.count({ where }),
    ])

    return {
      success: true,
      data: {
        items: items.map((q) => ({
          ...q,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
        })),
        total,
        page,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch saved queries',
    }
  }
}

export async function updateSavedQuery(
  id: string,
  input: {
    name?: string
    description?: string
    tags?: string[]
    isPublic?: boolean
    isFavorite?: boolean
  }
): Promise<{ success: boolean; data?: SavedQueryItem; error?: string }> {
  try {
    const user = await requireUser()

    // Rate limit
    const rl = await rateLimitAsync(`query_update:${user.id}`, {
      maxRequests: 30,
      windowSeconds: 60,
    })
    if (!rl.allowed) return { success: false, error: 'Too many requests' }

    // Validation
    const validated = validateInput(UpdateQuerySchema, { id, ...input })
    if (!validated.success) return { success: false, error: validated.error }
    const { id: _, ...data } = validated.data

    const existing = await prisma.savedQuery.findFirst({ where: { id, userId: user.id! } })
    if (!existing) return { success: false, error: 'Query not found' }

    const updated = await prisma.savedQuery.update({ where: { id }, data: data as any })

    return {
      success: true,
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update query',
    }
  }
}

export async function deleteSavedQuery(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser()

    // Validation
    if (!IdSchema.safeParse(id).success) return { success: false, error: 'Invalid ID format' }

    await prisma.savedQuery.deleteMany({ where: { id, userId: user.id! } })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete query',
    }
  }
}

export async function toggleFavorite(
  id: string
): Promise<{ success: boolean; data?: { isFavorite: boolean }; error?: string }> {
  try {
    const user = await requireUser()
    const existing = await prisma.savedQuery.findFirst({ where: { id, userId: user.id! } })
    if (!existing) return { success: false, error: 'Query not found' }

    const updated = await prisma.savedQuery.update({
      where: { id },
      data: { isFavorite: !existing.isFavorite },
    })

    return { success: true, data: { isFavorite: updated.isFavorite } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle favorite',
    }
  }
}

// ─── Template Actions ──────────────────────────────────────────────────

export async function saveAsTemplate(input: {
  name: string
  description?: string
  question: string
  sql?: string
  category?: string
}): Promise<{ success: boolean; data?: SavedQueryItem; error?: string }> {
  try {
    const user = await requireUser()

    // Templates count separately — PRO/ENTERPRISE only (reuse DASHBOARD_WIDGET check as PRO proxy)
    const limitCheck = await checkPlanLimits(user.id!, 'DASHBOARD_WIDGET')
    if (!limitCheck.allowed && limitCheck.limit === 0) {
      return { success: false, error: 'Saving custom templates requires a Pro or Enterprise plan.' }
    }

    const query = await prisma.savedQuery.create({
      data: {
        name: input.name,
        description: input.description || null,
        question: input.question,
        sql: input.sql || '',
        userId: user.id!,
        isTemplate: true,
        templateCategory: input.category || 'custom',
      },
    })

    return {
      success: true,
      data: {
        ...query,
        createdAt: query.createdAt.toISOString(),
        updatedAt: query.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save template',
    }
  }
}

export async function getUserTemplates(): Promise<{
  success: boolean
  data?: SavedQueryItem[]
  error?: string
}> {
  try {
    const user = await requireUser()

    const templates = await prisma.savedQuery.findMany({
      where: { userId: user.id!, isTemplate: true },
      orderBy: [{ templateCategory: 'asc' }, { updatedAt: 'desc' }],
    })

    return {
      success: true,
      data: templates.map((q) => ({
        ...q,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    }
  }
}

export async function toggleTemplate(
  id: string
): Promise<{ success: boolean; data?: { isTemplate: boolean }; error?: string }> {
  try {
    const user = await requireUser()
    const existing = await prisma.savedQuery.findFirst({ where: { id, userId: user.id! } })
    if (!existing) return { success: false, error: 'Query not found' }

    const updated = await prisma.savedQuery.update({
      where: { id },
      data: {
        isTemplate: !existing.isTemplate,
        templateCategory: !existing.isTemplate ? 'custom' : null,
      },
    })

    return { success: true, data: { isTemplate: updated.isTemplate } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle template',
    }
  }
}

// ─── Migration: localStorage → DB ───────────────────────────────────────

export async function migrateLocalData(input: {
  history: Array<{ question: string; sql: string; timestamp: string; rowCount?: number }>
  savedQueries: Array<{ name: string; question: string; sql: string; connectionId?: string }>
}): Promise<{ success: boolean; migratedHistory: number; migratedSaved: number; error?: string }> {
  try {
    const user = await requireUser()

    const [existingHistory, existingSaved] = await Promise.all([
      prisma.queryHistory.count({ where: { userId: user.id! } }),
      prisma.savedQuery.count({ where: { userId: user.id! } }),
    ])

    let migratedH = 0
    let migratedS = 0

    if (existingHistory === 0 && input.history.length > 0) {
      await prisma.queryHistory.createMany({
        data: input.history.map((h) => ({
          question: h.question,
          sql: h.sql,
          userId: user.id!,
          rowCount: h.rowCount ?? null,
          status: 'success',
          createdAt: new Date(h.timestamp),
        })),
      })
      migratedH = input.history.length
    }

    if (existingSaved === 0 && input.savedQueries.length > 0) {
      await prisma.savedQuery.createMany({
        data: input.savedQueries.map((q) => ({
          name: q.name,
          question: q.question,
          sql: q.sql,
          userId: user.id!,
          connectionId: q.connectionId || null,
        })),
      })
      migratedS = input.savedQueries.length
    }

    return { success: true, migratedHistory: migratedH, migratedSaved: migratedS }
  } catch (error) {
    return {
      success: false,
      migratedHistory: 0,
      migratedSaved: 0,
      error: error instanceof Error ? error.message : 'Migration failed',
    }
  }
}
