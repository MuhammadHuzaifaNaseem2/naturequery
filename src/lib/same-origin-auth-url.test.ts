import { describe, expect, it } from 'vitest'
import { sameOriginAuthUrl } from './same-origin-auth-url'

const previewOrigin = 'https://naturequery-beta-example.vercel.app'

describe('sameOriginAuthUrl', () => {
  it('accepts relative and absolute URLs on the current deployment', () => {
    expect(sameOriginAuthUrl('/dashboard', previewOrigin)).toBe(`${previewOrigin}/dashboard`)
    expect(sameOriginAuthUrl(`${previewOrigin}/settings`, previewOrigin)).toBe(
      `${previewOrigin}/settings`
    )
  })

  it('blocks a preview callback that points to the live site', () => {
    expect(sameOriginAuthUrl('https://naturequery.app/dashboard', previewOrigin)).toBeNull()
  })

  it('blocks invalid and non-HTTP destinations', () => {
    expect(sameOriginAuthUrl('javascript:alert(1)', previewOrigin)).toBeNull()
    expect(sameOriginAuthUrl('http://[', previewOrigin)).toBeNull()
  })
})
