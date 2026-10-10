import { z } from 'zod'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import { desktopJson, isResponse, readJson, requireDesktopUser } from '@/lib/desktop/http'
import { AI_REPORT_REASON_LABELS, isEmailConfigured, sendAiReportEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const reasons = Object.keys(AI_REPORT_REASON_LABELS) as [
  keyof typeof AI_REPORT_REASON_LABELS,
  ...(keyof typeof AI_REPORT_REASON_LABELS)[],
]

const bodySchema = z.object({
  kind: z.enum(['query', 'explanation', 'summary']),
  reason: z.enum(reasons),
  comment: z.string().trim().max(2000).default(''),
  question: z.string().trim().max(2000).default(''),
  content: z.string().trim().min(1, 'There is no answer to report').max(20_000),
})

/**
 * Lets people report an AI answer that is wrong or inappropriate (Microsoft
 * Store policy 11.16). Each report is kept in the audit log and emailed to the
 * team for review.
 */
export async function POST(request: Request) {
  const principal = await requireDesktopUser(request, {
    name: 'ai-report',
    maxRequests: 10,
    windowSeconds: 60 * 60,
  })
  if (isResponse(principal)) return principal
  const body = await readJson(request, bodySchema, 50_000)
  if (isResponse(body)) return body

  await writeImmutableAuditLog({
    userId: principal.userId,
    action: 'AI_OUTPUT_REPORTED',
    resource: 'desktopAi',
    metadata: {
      kind: body.kind,
      reason: body.reason,
      comment: body.comment,
      question: body.question,
      content: body.content.slice(0, 5000),
    },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  }).catch((error) => console.error('[desktop-ai-report] audit log failed:', error))

  if (isEmailConfigured()) {
    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: { email: true, name: true },
    })
    if (user?.email) {
      await sendAiReportEmail({
        reporterEmail: user.email,
        reporterName: user.name,
        ...body,
      }).catch((error) =>
        console.error(
          '[desktop-ai-report] email failed:',
          error instanceof Error ? error.message : 'Unknown provider error'
        )
      )
    }
  }

  return desktopJson({ received: true }, 202)
}
