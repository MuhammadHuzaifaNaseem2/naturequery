import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isEmailConfigured, sendContactEmail } from '@/lib/email'
import { getClientIp, rateLimitAsync } from '@/lib/rate-limit'

const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    company: z.string().trim().max(120).optional().default(''),
    reason: z.enum(['general', 'sales', 'support', 'partnership', 'feedback']),
    message: z.string().trim().min(10).max(5000),
    website: z.string().trim().max(200).optional().default(''),
  })
  .strict()

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const ipLimit = await rateLimitAsync(`contact:ip:${ip}`, {
    maxRequests: 5,
    windowSeconds: 60 * 10,
  })
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    )
  }

  let parsed: z.infer<typeof contactSchema>
  try {
    parsed = contactSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 })
  }

  if (parsed.website) return NextResponse.json({ accepted: true }, { status: 202 })

  const emailLimit = await rateLimitAsync(`contact:email:${parsed.email}`, {
    maxRequests: 3,
    windowSeconds: 60 * 60,
  })
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
    )
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Message delivery is temporarily unavailable. Please email hello@naturequery.app.' },
      { status: 503 }
    )
  }

  try {
    await sendContactEmail(parsed)
    return NextResponse.json({ accepted: true }, { status: 202 })
  } catch (error) {
    console.error(
      '[contact] Email provider rejected the message:',
      error instanceof Error ? error.message : 'Unknown provider error'
    )
    return NextResponse.json(
      { error: 'We could not accept your message. Please try again or email us directly.' },
      { status: 502 }
    )
  }
}
