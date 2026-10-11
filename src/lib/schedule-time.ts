/**
 * When a scheduled query runs next.
 *
 * People pick a time on their own clock ("every Monday at 9:00"), so the next run is
 * worked out on the calendar and clock of their time zone, then stored as an instant.
 * The runner (/api/cron/run-schedules) is called once an hour, so a schedule runs
 * within the hour after its time.
 */

export interface ScheduleTiming {
  frequency: string
  /** "HH:MM", 24-hour, on the clock of `timezone`. Null on schedules made before times were saved. */
  timeOfDay?: string | null
  /** 0 = Sunday to 6 = Saturday, for weekly schedules. */
  dayOfWeek?: number | null
  /** 1 to 31, for monthly schedules. Months without that day use their last day. */
  dayOfMonth?: number | null
  /** IANA time zone, such as "Asia/Karachi". */
  timezone?: string | null
}

export interface StoredTiming {
  timeOfDay: string | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  timezone: string | null
}

interface CalendarDate {
  year: number
  month: number // 1-12
  day: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Schedules saved before the time was stored keep running on a fixed interval.
const LEGACY_INTERVALS: Record<string, number> = {
  HOURLY: HOUR,
  DAILY: DAY,
  WEEKLY: 7 * DAY,
  MONTHLY: 30 * DAY,
}

export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export function parseTimeOfDay(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== 'string') return null
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null
}

/**
 * Checks the timing fields sent with a new schedule. A request without a time is
 * accepted and keeps the old fixed-interval behaviour.
 */
export function readScheduleTiming(
  frequency: string,
  input: Record<string, unknown>
): { timing: StoredTiming } | { error: string } {
  if (input.timezone !== undefined && input.timezone !== null && !isValidTimeZone(input.timezone)) {
    return { error: 'timezone must be an IANA time zone such as "Europe/London"' }
  }
  const timezone = isValidTimeZone(input.timezone) ? input.timezone : 'UTC'

  if (frequency === 'HOURLY') {
    return { timing: { timeOfDay: null, dayOfWeek: null, dayOfMonth: null, timezone } }
  }
  if (input.timeOfDay === undefined || input.timeOfDay === null) {
    return { timing: { timeOfDay: null, dayOfWeek: null, dayOfMonth: null, timezone: null } }
  }
  if (!parseTimeOfDay(input.timeOfDay)) {
    return { error: 'timeOfDay must be a 24-hour time such as "09:00"' }
  }

  const timing: StoredTiming = {
    timeOfDay: input.timeOfDay as string,
    dayOfWeek: null,
    dayOfMonth: null,
    timezone,
  }
  if (frequency === 'WEEKLY') {
    if (!isWholeNumberBetween(input.dayOfWeek, 0, 6)) {
      return { error: 'dayOfWeek must be 0 (Sunday) to 6 (Saturday) for weekly schedules' }
    }
    timing.dayOfWeek = input.dayOfWeek
  }
  if (frequency === 'MONTHLY') {
    if (!isWholeNumberBetween(input.dayOfMonth, 1, 31)) {
      return { error: 'dayOfMonth must be 1 to 31 for monthly schedules' }
    }
    timing.dayOfMonth = input.dayOfMonth
  }
  return { timing }
}

/** The first time the schedule is due strictly after `after`. */
export function nextRunAt(timing: ScheduleTiming, after: Date = new Date()): Date {
  const frequency = String(timing.frequency).toUpperCase()

  if (frequency === 'HOURLY') {
    // The next hour on the clock: a run at 10:07 is followed by 11:00.
    return new Date(Math.floor(after.getTime() / HOUR) * HOUR + HOUR)
  }

  const time = parseTimeOfDay(timing.timeOfDay)
  if (!time) {
    return new Date(after.getTime() + (LEGACY_INTERVALS[frequency] ?? DAY))
  }

  const zone = isValidTimeZone(timing.timezone) ? timing.timezone : 'UTC'
  const today = calendarDateIn(after, zone)

  // Two months of days always contains the next matching one.
  for (let offset = 0; offset <= 62; offset++) {
    const date = addDays(today, offset)
    if (!isScheduledDay(frequency, date, timing)) continue
    const at = zonedTimeToUtc(date, time.hour, time.minute, zone)
    if (at.getTime() > after.getTime()) return at
  }
  return new Date(after.getTime() + (LEGACY_INTERVALS[frequency] ?? DAY))
}

function isScheduledDay(frequency: string, date: CalendarDate, timing: ScheduleTiming): boolean {
  if (frequency === 'WEEKLY') {
    return weekday(date) === (timing.dayOfWeek ?? 1)
  }
  if (frequency === 'MONTHLY') {
    const wanted = Math.min(timing.dayOfMonth ?? 1, daysInMonth(date.year, date.month))
    return date.day === wanted
  }
  return true
}

function isWholeNumberBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

// The clock fields an instant shows in a time zone.
function partsIn(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  }
}

function calendarDateIn(instant: Date, timeZone: string): CalendarDate {
  const { year, month, day } = partsIn(instant, timeZone)
  return { year, month, day }
}

// The clock time an instant shows in the zone, written as if it were UTC.
function wallClock(instant: number, timeZone: string): number {
  const p = partsIn(new Date(instant), timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

// How far the zone's clock is ahead of UTC at an instant.
function offsetAt(instant: number, timeZone: string): number {
  return wallClock(instant, timeZone) - Math.floor(instant / 1000) * 1000
}

/** The instant when the zone's clock shows this date and time. */
function zonedTimeToUtc(date: CalendarDate, hour: number, minute: number, timeZone: string): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day, hour, minute)
  const first = wall - offsetAt(wall, timeZone)
  const second = wall - offsetAt(first, timeZone)
  if (wallClock(second, timeZone) === wall) return new Date(second)
  if (wallClock(first, timeZone) === wall) return new Date(first)
  // The clock skipped this time when daylight saving began; run an hour later instead.
  return new Date(Math.max(first, second))
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() }
}

function weekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
