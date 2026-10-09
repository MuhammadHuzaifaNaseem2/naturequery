import { z } from 'zod'
import {
  aiFailure,
  complete,
  desktopSchemaSchema,
  dialectSchema,
  schemaText,
} from '@/lib/desktop/ai'
import {
  desktopError,
  desktopJson,
  isResponse,
  readJson,
  requireDesktopUser,
} from '@/lib/desktop/http'
import { buildFixMessages, parseQueryReply, UnusableReplyError } from '@/lib/desktop/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  question: z.string().max(2000).default(''),
  failedQuery: z.string().trim().min(1).max(100_000),
  errorMessage: z.string().trim().min(1).max(4000),
  dialect: dialectSchema,
  schema: desktopSchemaSchema,
})

/** Suggests a corrected query after the database rejected one. */
export async function POST(request: Request) {
  const principal = await requireDesktopUser(request, {
    name: 'ai-fix',
    maxRequests: 20,
    windowSeconds: 60,
  })
  if (isResponse(principal)) return principal
  const body = await readJson(request, bodySchema, 3_000_000)
  if (isResponse(body)) return body

  let outcome
  try {
    const reply = await complete(
      buildFixMessages({
        dialect: body.dialect,
        question: body.question,
        failedQuery: body.failedQuery,
        errorMessage: body.errorMessage,
        schemaText: schemaText(`${body.question} ${body.failedQuery}`, body.schema, body.dialect),
      }),
      { maxTokens: 2048, temperature: 0.1 }
    )
    outcome = parseQueryReply(reply, body.dialect)
  } catch (error) {
    if (error instanceof UnusableReplyError) {
      return desktopError(502, 'ai_unusable', `${error.message} Try fixing the query by hand.`)
    }
    return aiFailure(error)
  }

  if (outcome.kind === 'clarify') return desktopJson({ clarification: outcome.message })
  if (outcome.kind === 'refuse') return desktopJson({ refused: outcome.message })
  return desktopJson({ query: outcome.text })
}
