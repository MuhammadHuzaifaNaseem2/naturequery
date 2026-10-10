// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('verification email link', () => {
  beforeEach(() => {
    // Without a mail provider the link is returned instead of sent.
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('SMTP_USER', '')
    vi.stubEnv('SMTP_PASSWORD', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://naturequery.app')
    vi.resetModules()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('brings people who signed up from NatureQuery Desktop back to its sign-in', async () => {
    const { sendVerificationEmail } = await import('../email')
    const next = '/desktop/authorize?challenge=abc&state=xyz&device=Office PC'
    const link = new URL(await sendVerificationEmail('new@example.com', 'token123', next))
    expect(link.origin).toBe('https://naturequery.app')
    expect(link.pathname).toBe('/verify-email')
    expect(link.searchParams.get('token')).toBe('token123')
    expect(link.searchParams.get('next')).toBe(next)
  })

  it('has no return address for a normal sign-up', async () => {
    const { sendVerificationEmail } = await import('../email')
    const link = new URL(await sendVerificationEmail('new@example.com', 'token123'))
    expect(link.searchParams.has('next')).toBe(false)
  })
})
