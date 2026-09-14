import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimitAsync: mocks.rateLimit }))

import { sendContactEmail } from '@/lib/email'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('CONTACT_EMAIL', 'support@example.com')
  mocks.rateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('contact email delivery', () => {
  it('escapes submitted content and sets a safe reply-to address', async () => {
    await sendContactEmail({
      name: '<script>alert(1)</script>',
      email: 'sender@example.com',
      company: 'A & B',
      reason: 'support',
      message: '<b>database problem</b>',
    })

    expect(mocks.rateLimit).toHaveBeenCalledWith('email:contact:sender@example.com', {
      maxRequests: 5,
      windowSeconds: 60,
    })
    expect(fetch).toHaveBeenCalledOnce()
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, string>
    expect(body.to).toBe('support@example.com')
    expect(body.reply_to).toBe('sender@example.com')
    expect(body.subject).toBe('[NatureQuery contact] Technical support')
    expect(body.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(body.html).toContain('A &amp; B')
    expect(body.html).toContain('&lt;b&gt;database problem&lt;/b&gt;')
    expect(body.html).not.toContain('<script>')
  })

  it('surfaces provider rejection to the API caller', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('rejected', { status: 422 })))
    await expect(
      sendContactEmail({
        name: 'Ada',
        email: 'sender@example.com',
        reason: 'general',
        message: 'This is a valid contact message.',
      })
    ).rejects.toThrow('Resend error')
  })
})
