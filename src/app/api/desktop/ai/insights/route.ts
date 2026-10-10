import { z } from 'zod'
import { aiFailure, complete } from '@/lib/desktop/ai'
import {
  desktopError,
  desktopJson,
  isResponse,
  readJson,
  requireDesktopUser,
} from '@/lib/desktop/http'
import {
  buildInsightsMessages,
  parseInsightsReply,
  UnusableReplyError,
} from '@/lib/desktop/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_SAMPLE_CHARS = 12_000

const bodySchema = z.object({
  question: z.string().max(2000).default(''),
  query: z.string().max(100_000),
  columns: z.array(z.string().max(512)).max(300),
  // Only sent when the user allows sharing result rows with the AI (off by default).
  rows: z.array(z.array(z.unknown()).max(300)).max(50).default([]),
  rowCount: z.number().int().min(0),
})

/** Summarizes a result for business users. */
export async function POST(request: Request) {
  const principal = await requireDesktopUser(request, {
    name: 'ai-insights',
    maxRequests: 20,
    windowSeconds: 60,
  })
  if (isResponse(principal)) return principal
  const body = await readJson(request, bodySchema, 400_000)
  if (isResponse(body)) return body

  // Keep the prompt small: drop rows from the end until the sample fits.
  const rows = [...body.rows]
  while (rows.length && JSON.stringify(rows).length > MAX_SAMPLE_CHARS) rows.pop()

  try {
    const reply = await complete(
      buildInsightsMessages({
        question: body.question,
        query: body.query.slice(0, 20_000),
        columns: body.columns,
        rows,
        rowCount: body.rowCount,
      }),
      { maxTokens: 900, temperature: 0.2 }
    )
    return desktopJson(parseInsightsReply(reply))
  } catch (error) {
    if (error instanceof UnusableReplyError) {
      return desktopError(502, 'ai_unusable', `${error.message} Try again.`)
    }
    return aiFailure(error)
  }
}
