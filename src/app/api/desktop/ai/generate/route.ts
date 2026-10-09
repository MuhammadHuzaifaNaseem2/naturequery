import { z } from 'zod'
import { checkPlanLimits, maybeNotifyQueryThreshold, recordUsage } from '@/lib/plan-limits'
import { desktopPlanUsage } from '@/lib/desktop/account'
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
import { buildGenerateMessages, parseQueryReply, UnusableReplyError } from '@/lib/desktop/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  question: z.string().trim().min(1, 'Ask a question first').max(2000),
  dialect: dialectSchema,
  schema: desktopSchemaSchema,
  conversation: z
    .array(z.object({ question: z.string().max(2000), query: z.string().max(20_000) }))
    .max(10)
    .optional(),
})

/**
 * Turns a question into a read-only query for the connected database. A
 * question counts toward the plan's monthly allowance only when a query is
 * returned.
 */
export async function POST(request: Request) {
  const principal = await requireDesktopUser(request, {
    name: 'ai-generate',
    maxRequests: 30,
    windowSeconds: 60,
  })
  if (isResponse(principal)) return principal
  const body = await readJson(request, bodySchema, 3_000_000)
  if (isResponse(body)) return body

  const quota = await checkPlanLimits(principal.userId, 'QUERY')
  if (!quota.allowed) {
    return desktopError(
      402,
      'plan_limit',
      `You have used all ${quota.limit} AI questions included in the ${quota.planName} plan this month.`,
      { plan: await desktopPlanUsage(principal.userId) }
    )
  }

  let outcome
  try {
    const context = [body.question, ...(body.conversation ?? []).map((turn) => turn.question)].join(
      ' '
    )
    const reply = await complete(
      buildGenerateMessages({
        dialect: body.dialect,
        question: body.question,
        schemaText: schemaText(context, body.schema, body.dialect),
        conversation: body.conversation,
      }),
      { maxTokens: 2048, temperature: 0.1 }
    )
    outcome = parseQueryReply(reply, body.dialect)
  } catch (error) {
    if (error instanceof UnusableReplyError) {
      return desktopError(502, 'ai_unusable', `${error.message} Try asking in a different way.`)
    }
    return aiFailure(error)
  }

  if (outcome.kind === 'clarify') return desktopJson({ clarification: outcome.message })
  if (outcome.kind === 'refuse') return desktopJson({ refused: outcome.message })

  await recordUsage(principal.userId, 'QUERY')
  maybeNotifyQueryThreshold(principal.userId).catch(() => {})
  return desktopJson({ query: outcome.text, plan: await desktopPlanUsage(principal.userId) })
}
