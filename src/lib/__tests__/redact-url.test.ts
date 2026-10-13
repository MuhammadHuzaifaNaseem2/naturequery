// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { redactRequest, redactUrl, redactUrlFields } from '../redact-url'

describe('secrets in addresses', () => {
  it('blanks out tokens in links people receive by email', () => {
    expect(redactUrl('https://www.naturequery.app/reset-password?token=abc123')).toBe(
      'https://www.naturequery.app/reset-password?token=redacted'
    )
    expect(redactUrl('/verify-email?token=abc123&next=%2Fdesktop')).toBe(
      '/verify-email?token=redacted&next=%2Fdesktop'
    )
    expect(redactUrl('/invite?token=abc123#join')).toBe('/invite?token=redacted#join')
    expect(redactUrl('/api/email/unsubscribe?t=abc123')).toBe('/api/email/unsubscribe?t=redacted')
  })

  it('blanks out shared dashboard links', () => {
    expect(redactUrl('https://www.naturequery.app/public/dashboard/k3Y_9x?theme=dark')).toBe(
      'https://www.naturequery.app/public/dashboard/redacted?theme=dark'
    )
  })

  it('leaves ordinary addresses alone', () => {
    for (const url of [
      'https://www.naturequery.app/dashboard?tab=history',
      '/pricing',
      '/docs/api#auth',
      '/settings?section=tokens',
    ]) {
      expect(redactUrl(url)).toBe(url)
    }
  })

  it('redacts the request in error reports', () => {
    const asString = {
      url: 'https://www.naturequery.app/reset-password?token=abc',
      query_string: 'token=abc&lang=en',
      headers: { Referer: 'https://www.naturequery.app/invite?token=abc', 'User-Agent': 'x' },
    }
    redactRequest(asString)
    expect(asString).toEqual({
      url: 'https://www.naturequery.app/reset-password?token=redacted',
      query_string: 'token=redacted&lang=en',
      headers: { Referer: 'https://www.naturequery.app/invite?token=redacted', 'User-Agent': 'x' },
    })

    const asObject = { query_string: { t: 'abc', page: '2' } }
    redactRequest(asObject)
    expect(asObject.query_string).toEqual({ t: 'redacted', page: '2' })

    const asPairs: { query_string: Array<[string, string]> } = {
      query_string: [
        ['code', 'abc'],
        ['tab', 'x'],
      ],
    }
    redactRequest(asPairs)
    expect(asPairs.query_string).toEqual([
      ['code', 'redacted'],
      ['tab', 'x'],
    ])
  })

  it('redacts address fields of analytics events and breadcrumbs', () => {
    const fields = {
      $current_url: 'https://www.naturequery.app/reset-password?token=abc',
      $referrer: 'https://mail.example.com/?token=abc',
      $pathname: '/public/dashboard/abc',
      from: '/invite?token=abc',
      count: 3,
      title: 'Reset your password?token=abc',
    }
    expect(redactUrlFields(fields)).toEqual({
      $current_url: 'https://www.naturequery.app/reset-password?token=redacted',
      $referrer: 'https://mail.example.com/?token=redacted',
      $pathname: '/public/dashboard/redacted',
      from: '/invite?token=redacted',
      count: 3,
      title: 'Reset your password?token=abc',
    })
  })
})
