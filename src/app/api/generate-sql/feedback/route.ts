/**
 * HITL Feedback API
 *
 * Stores user corrections and ratings on AI-generated SQL.
 * These correction pairs feed the embedding re-ranking pipeline
 * to improve schema retrieval for similar questions in future.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { queryId, rating, correctedSql } = body as {
    queryId: string
    rating: 1 | -1
    correctedSql?: string
  }

  if (!queryId || (rating !== 1 && rating !== -1)) {
    return NextResponse.json(
      { error: 'queryId and rating (1 or -1) are required' },
      { status: 400 }
    )
  }

  // Verify the feedback record belongs to this user
  const existing = await prisma.queryFeedback.findFirst({
    where: { id: queryId, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 })
  }

  try {
    await prisma.queryFeedback.update({
      where: { id: queryId },
      data: {
        rating,
        correctedSql: correctedSql?.trim() ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/generate-sql/feedback error:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}
