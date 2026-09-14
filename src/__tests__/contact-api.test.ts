import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn(),
  configured: vi.fn(),
  sendContact: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimitAsync: mocks.rateLimit,
  getClientIp: mocks.getClientIp,
}))
vi.mock('@/lib/email', () => ({
  isEmailConfigured: mocks.configured,
  sendContactEmail: mocks.sendContact,
}))

import { POST } from '@/app/api/contact/route'

const validMessage = {
  name: '  Ada Lovelace  ',
  email: '  ADA@Example.com ',
  company: 'Analytical Engines',
  reason: 'sales',
  message: 'Please tell me about your enterprise plan.',
  website: '',
}

function request(body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('203.0.113.10')
  mocks.rateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  mocks.configured.mockReturnValue(true)
  mocks.sendContact.mockResolvedValue(undefined)
})

describe('contact API', () => {
  it('accepts a validated message and normalizes identity fields', async () => {
    const response = await POST(request(validMessage))
    expect(response.status).toBe(202)
    expect(mocks.sendContact).toHaveBeenCalledWith({
      ...validMessage,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(1, 'contact:ip:203.0.113.10', {
      maxRequests: 5,
      windowSeconds: 600,
    })
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(2, 'contact:email:ada@example.com', {
      maxRequests: 3,
      windowSeconds: 3600,
    })
  })

  it('rejects malformed or unexpected fields before delivery', async () => {
    const response = await POST(request({ ...validMessage, message: 'short', admin: true }))
    expect(response.status).toBe(400)
    expect(mocks.sendContact).not.toHaveBeenCalled()
  })

  it('returns a retry delay when the request IP is rate limited', async () => {
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 90 })
    const response = await POST(request(validMessage))
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('90')
    expect(mocks.sendContact).not.toHaveBeenCalled()
  })

  it('quietly accepts bot-trap submissions without sending mail', async () => {
    const response = await POST(request({ ...validMessage, website: 'https://spam.invalid' }))
    expect(response.status).toBe(202)
    expect(mocks.sendContact).not.toHaveBeenCalled()
    expect(mocks.rateLimit).toHaveBeenCalledOnce()
  })

  it('reports unavailable provider configuration without claiming success', async () => {
    mocks.configured.mockReturnValue(false)
    const response = await POST(request(validMessage))
    expect(response.status).toBe(503)
    expect(mocks.sendContact).not.toHaveBeenCalled()
  })

  it('keeps the form recoverable when the provider rejects delivery', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.sendContact.mockRejectedValue(new Error('provider failure'))
    const response = await POST(request(validMessage))
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('try again') })
  })
})
