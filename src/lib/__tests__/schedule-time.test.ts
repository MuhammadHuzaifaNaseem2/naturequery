// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { nextRunAt, readScheduleTiming } from '../schedule-time'

const at = (iso: string) => new Date(iso)
const next = (timing: Parameters<typeof nextRunAt>[0], after: string) =>
  nextRunAt(timing, at(after)).toISOString()

describe('nextRunAt', () => {
  it('runs a daily schedule at the chosen time in the chosen zone', () => {
    const daily = { frequency: 'DAILY', timeOfDay: '09:00', timezone: 'Asia/Karachi' }
    // 08:00 in Karachi: today at 09:00 is still ahead.
    expect(next(daily, '2026-10-12T03:00:00Z')).toBe('2026-10-12T04:00:00.000Z')
    // 09:07 in Karachi: today's run has happened, so tomorrow.
    expect(next(daily, '2026-10-12T04:07:00Z')).toBe('2026-10-13T04:00:00.000Z')
  })

  it('handles zones that are a half hour off UTC', () => {
    const daily = { frequency: 'DAILY', timeOfDay: '09:00', timezone: 'Asia/Kolkata' }
    expect(next(daily, '2026-10-12T00:00:00Z')).toBe('2026-10-12T03:30:00.000Z')
  })

  it('runs a weekly schedule on the chosen weekday and follows daylight saving', () => {
    // Mondays at 09:00 in London. 2026-10-12 is a Monday; British Summer Time ends 2026-10-25.
    const weekly = {
      frequency: 'WEEKLY',
      timeOfDay: '09:00',
      dayOfWeek: 1,
      timezone: 'Europe/London',
    }
    expect(next(weekly, '2026-10-12T07:00:00Z')).toBe('2026-10-12T08:00:00.000Z')
    expect(next(weekly, '2026-10-12T09:30:00Z')).toBe('2026-10-19T08:00:00.000Z')
    expect(next(weekly, '2026-10-19T08:07:00Z')).toBe('2026-10-26T09:00:00.000Z')
  })

  it('uses the last day of the month when the month is too short', () => {
    const monthly = { frequency: 'MONTHLY', timeOfDay: '09:00', dayOfMonth: 31, timezone: 'UTC' }
    expect(next(monthly, '2027-02-01T00:00:00Z')).toBe('2027-02-28T09:00:00.000Z')
    expect(next(monthly, '2027-02-28T10:00:00Z')).toBe('2027-03-31T09:00:00.000Z')
  })

  it('moves to the next month once this month has run', () => {
    const monthly = { frequency: 'MONTHLY', timeOfDay: '06:00', dayOfMonth: 12, timezone: 'UTC' }
    expect(next(monthly, '2026-10-12T06:07:00Z')).toBe('2026-11-12T06:00:00.000Z')
  })

  it('runs an hour later when daylight saving skips the chosen time', () => {
    // New York skips 02:00 to 03:00 on 2027-03-14.
    const daily = { frequency: 'DAILY', timeOfDay: '02:00', timezone: 'America/New_York' }
    expect(next(daily, '2027-03-14T05:00:00Z')).toBe('2027-03-14T07:00:00.000Z')
    const morning = { frequency: 'DAILY', timeOfDay: '09:00', timezone: 'America/New_York' }
    expect(next(morning, '2027-03-13T15:00:00Z')).toBe('2027-03-14T13:00:00.000Z')
  })

  it('runs hourly schedules at the start of the next hour', () => {
    expect(next({ frequency: 'HOURLY' }, '2026-10-12T10:07:30Z')).toBe('2026-10-12T11:00:00.000Z')
    expect(next({ frequency: 'HOURLY' }, '2026-10-12T11:00:00Z')).toBe('2026-10-12T12:00:00.000Z')
  })

  it('keeps the fixed interval for schedules saved without a time', () => {
    expect(next({ frequency: 'DAILY' }, '2026-10-12T10:00:00Z')).toBe('2026-10-13T10:00:00.000Z')
    expect(next({ frequency: 'MONTHLY', timeOfDay: null }, '2026-10-12T10:00:00Z')).toBe(
      '2026-11-11T10:00:00.000Z'
    )
  })

  it('treats an unknown zone as UTC', () => {
    const daily = { frequency: 'DAILY', timeOfDay: '09:00', timezone: 'Mars/Olympus_Mons' }
    expect(next(daily, '2026-10-12T00:00:00Z')).toBe('2026-10-12T09:00:00.000Z')
  })
})

describe('readScheduleTiming', () => {
  it('accepts a weekly schedule', () => {
    expect(
      readScheduleTiming('WEEKLY', { timeOfDay: '09:00', dayOfWeek: 1, timezone: 'Asia/Karachi' })
    ).toEqual({
      timing: { timeOfDay: '09:00', dayOfWeek: 1, dayOfMonth: null, timezone: 'Asia/Karachi' },
    })
  })

  it('asks for the weekday on weekly schedules and the date on monthly ones', () => {
    expect(readScheduleTiming('WEEKLY', { timeOfDay: '09:00' })).toHaveProperty('error')
    expect(readScheduleTiming('MONTHLY', { timeOfDay: '09:00', dayOfMonth: 32 })).toHaveProperty(
      'error'
    )
  })

  it('rejects times and zones it cannot use', () => {
    expect(readScheduleTiming('DAILY', { timeOfDay: '9:00' })).toHaveProperty('error')
    expect(readScheduleTiming('DAILY', { timeOfDay: '24:00' })).toHaveProperty('error')
    expect(
      readScheduleTiming('DAILY', { timeOfDay: '09:00', timezone: 'Mars/Olympus_Mons' })
    ).toHaveProperty('error')
  })

  it('stores no time for hourly schedules or for requests without one', () => {
    expect(readScheduleTiming('HOURLY', { timeOfDay: '09:00', timezone: 'UTC' })).toEqual({
      timing: { timeOfDay: null, dayOfWeek: null, dayOfMonth: null, timezone: 'UTC' },
    })
    expect(readScheduleTiming('DAILY', {})).toEqual({
      timing: { timeOfDay: null, dayOfWeek: null, dayOfMonth: null, timezone: null },
    })
  })

  it('uses UTC when no zone is sent', () => {
    expect(readScheduleTiming('DAILY', { timeOfDay: '07:00' })).toEqual({
      timing: { timeOfDay: '07:00', dayOfWeek: null, dayOfMonth: null, timezone: 'UTC' },
    })
  })
})
