// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyPeriodStart, isEmailDay } from '../nightly-insights'
import {
  readWeeklySummaryUnsubscribeToken,
  weeklySummaryUnsubscribeToken,
  weeklySummaryUnsubscribeUrl,
} from '../email-unsubscribe'
import { weeklySummaryEmailHtml, weeklySummaryEmailText, weeklySummarySubject } from '../email'
import type { InsightMetrics } from '../nightly-insights'

describe('dailyPeriodStart', () => {
  it('is today at 02:00 UTC once that time has passed', () => {
    expect(dailyPeriodStart(new Date('2026-10-12T08:30:00Z'), 2).toISOString()).toBe(
      '2026-10-12T02:00:00.000Z'
    )
  })

  it('is still yesterday before 02:00 UTC, so a late run catches up', () => {
    expect(dailyPeriodStart(new Date('2026-10-12T01:59:00Z'), 2).toISOString()).toBe(
      '2026-10-11T02:00:00.000Z'
    )
  })

  it('handles the 02:30 audit check and month ends', () => {
    expect(dailyPeriodStart(new Date('2026-11-01T02:10:00Z'), 2, 30).toISOString()).toBe(
      '2026-10-31T02:30:00.000Z'
    )
  })
})

describe('isEmailDay', () => {
  it('emails only with Monday’s summary', () => {
    // 2026-10-12 is a Monday.
    expect(isEmailDay(dailyPeriodStart(new Date('2026-10-12T09:00:00Z'), 2))).toBe(true)
    expect(isEmailDay(dailyPeriodStart(new Date('2026-10-13T09:00:00Z'), 2))).toBe(false)
    // Early Monday UTC still belongs to Sunday's period.
    expect(isEmailDay(dailyPeriodStart(new Date('2026-10-12T01:00:00Z'), 2))).toBe(false)
  })
})

describe('weekly summary unsubscribe token', () => {
  beforeEach(() => vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-with-enough-length-for-hmac'))
  afterEach(() => vi.unstubAllEnvs())

  it('reads back the account it was made for', () => {
    const token = weeklySummaryUnsubscribeToken('user_123')!
    expect(readWeeklySummaryUnsubscribeToken(token)).toBe('user_123')
  })

  it('rejects edited, foreign or missing tokens', () => {
    const token = weeklySummaryUnsubscribeToken('user_123')!
    const signature = token.split('.')[1]
    expect(readWeeklySummaryUnsubscribeToken(`user_456.${signature}`)).toBeNull()
    expect(readWeeklySummaryUnsubscribeToken(`${token}x`)).toBeNull()
    expect(readWeeklySummaryUnsubscribeToken('user_123')).toBeNull()
    expect(readWeeklySummaryUnsubscribeToken(undefined)).toBeNull()
  })

  it('stops working when the app secret changes', () => {
    const token = weeklySummaryUnsubscribeToken('user_123')!
    vi.stubEnv('NEXTAUTH_SECRET', 'a-different-secret-entirely-0123456789')
    expect(readWeeklySummaryUnsubscribeToken(token)).toBeNull()
  })

  it('makes no token without a secret, so no email goes out', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('AUTH_SECRET', '')
    expect(weeklySummaryUnsubscribeToken('user_123')).toBeNull()
  })

  it('builds the page link', () => {
    expect(weeklySummaryUnsubscribeUrl('https://naturequery.app/', 'a.b')).toBe(
      'https://naturequery.app/email/unsubscribe?t=a.b'
    )
  })
})

describe('weekly summary email', () => {
  const metrics: InsightMetrics = {
    queries7d: 42,
    queries7d_prev: 30,
    queries30d: 120,
    wowDelta: 40,
    wowDirection: 'up',
    connectionCount: 3,
    savedQueryCount: 1,
    topConnections: [{ name: '<script>alert(1)</script>', count: 20 }],
  }
  const input = {
    name: 'Ana <b>',
    narrative: 'You asked 42 questions. <img src=x onerror=alert(1)>',
    metrics,
    unsubscribeUrl: 'https://naturequery.app/email/unsubscribe?t=a.b',
    baseUrl: 'https://naturequery.app',
    date: new Date('2026-10-12T02:00:00Z'),
  }

  it('escapes names, the AI summary and connection names', () => {
    const html = weeklySummaryEmailHtml(input)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('Ana <b>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('carries the stop link, the figures and no em dash', () => {
    const html = weeklySummaryEmailHtml(input)
    expect(html).toContain(input.unsubscribeUrl)
    expect(html).toContain('up 40% on last week')
    expect(html).not.toContain('—')
    expect(weeklySummarySubject(metrics)).toBe('Your week in NatureQuery: 42 questions')
    expect(weeklySummaryEmailText(input)).toContain(
      'Stop weekly summaries: ' + input.unsubscribeUrl
    )
  })
})
