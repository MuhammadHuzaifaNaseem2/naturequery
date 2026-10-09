import { z } from 'zod'
import { aiFailure, complete, dialectSchema } from '@/lib/desktop/ai'
import { desktopJson, isResponse, readJson, requireDesktopUser } from '@/lib/desktop/http'
import { buildExplainMessages, parseExplainReply } from '@/lib/desktop/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  query: z.string().trim().min(1, 'Write a query first').max(100_000),
  dialect: dialectSchema,
})

/** Explains a query in plain language. */
export async function POST(request: Request) {
  const principal = await requireDesktopUser(request, {
    name: 'ai-explain',
    maxRequests: 20,
    windowSeconds: 60,
  })
  if (isResponse(principal)) return principal
  const body = await readJson(request, bodySchema, 200_000)
  if (isResponse(body)) return body

  try {
    const reply = await complete(
      buildExplainMessages({ dialect: body.dialect, query: body.query }),
      {
        maxTokens: 700,
        temperature: 0.3,
      }
    )
    return desktopJson({ explanation: parseExplainReply(reply) })
  } catch (error) {
    return aiFailure(error)
  }
}
