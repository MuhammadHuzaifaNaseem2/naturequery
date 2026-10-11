'use client'

import { useState } from 'react'
import {
  Clock,
  Calendar,
  Play,
  Pause,
  Trash2,
  Mail,
  Plus,
  X,
  Check,
  AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from '@/contexts/LocaleContext'

type ScheduleType = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface ScheduledQuery {
  id: string
  name: string
  question: string
  sql: string
  connectionId: string
  connectionName: string
  schedule: {
    type: ScheduleType
    time?: string // HH:MM, 24-hour; missing on schedules saved before times were stored
    dayOfWeek?: number // 0-6 for weekly
    dayOfMonth?: number // 1-31 for monthly
    timezone?: string // IANA zone the time is on, e.g. "Asia/Karachi"
  }
  notifications: {
    email?: boolean
    inApp?: boolean
  }
  notifyEmails?: string[] // actual email addresses to notify
  isActive: boolean
  lastRun?: Date
  nextRun?: Date
  lastStatus?: 'success' | 'failed' | null
  lastError?: string | null
  createdAt: Date
}

/** A schedule as /api/scheduled-queries returns it. */
export interface ScheduleRecord {
  id: string
  name: string
  question: string
  sql: string
  connectionId?: string | null
  connectionName?: string | null
  frequency: string
  timeOfDay?: string | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  timezone?: string | null
  enabled: boolean
  notifyEmails?: string[]
  lastStatus?: string | null
  lastError?: string | null
  createdAt: string
  nextRunAt?: string | null
  lastRunAt?: string | null
}

export function scheduleFromApi(s: ScheduleRecord): ScheduledQuery {
  return {
    id: s.id,
    name: s.name,
    question: s.question,
    sql: s.sql,
    connectionId: s.connectionId ?? '',
    connectionName: s.connectionName ?? '',
    schedule: {
      type: s.frequency.toLowerCase() as ScheduleType,
      time: s.timeOfDay ?? undefined,
      dayOfWeek: s.dayOfWeek ?? undefined,
      dayOfMonth: s.dayOfMonth ?? undefined,
      timezone: s.timezone ?? undefined,
    },
    notifications: {},
    notifyEmails: s.notifyEmails ?? [],
    isActive: s.enabled,
    lastStatus: s.lastStatus === 'success' || s.lastStatus === 'failed' ? s.lastStatus : null,
    lastError: s.lastError ?? null,
    createdAt: new Date(s.createdAt),
    nextRun: s.nextRunAt ? new Date(s.nextRunAt) : undefined,
    lastRun: s.lastRunAt ? new Date(s.lastRunAt) : undefined,
  }
}

// The runner is called once an hour, so schedules offer whole hours.
const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)

interface QuerySchedulerProps {
  queries: ScheduledQuery[]
  onCreateSchedule: (
    schedule: Omit<ScheduledQuery, 'id' | 'lastRun' | 'nextRun' | 'createdAt'>
  ) => void
  onDeleteSchedule: (id: string) => void
  onToggleSchedule: (id: string) => void
  onEditSchedule: (schedule: ScheduledQuery) => void
  currentQuestion?: string
  currentSql?: string
  connectionId?: string
  connectionName?: string
}

export function QueryScheduler({
  queries,
  onCreateSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onEditSchedule,
  currentQuestion,
  currentSql,
  connectionId,
  connectionName,
}: QuerySchedulerProps) {
  const { t, locale } = useTranslation()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    type: 'daily' as ScheduleType,
    time: '09:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    timeZone: 'UTC',
    notifyEmails: [] as string[],
    emailInput: '',
  })

  const openCreateModal = () => {
    setNewSchedule({
      name: currentQuestion?.slice(0, 50) || 'Scheduled Query',
      type: 'daily',
      time: '09:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      timeZone: browserTimeZone(),
      notifyEmails: [],
      emailInput: '',
    })
    setShowCreateModal(true)
  }

  const handleCreate = () => {
    if (!newSchedule.name || !currentSql || !connectionId) return

    onCreateSchedule({
      name: newSchedule.name,
      question: currentQuestion || '',
      sql: currentSql,
      connectionId,
      connectionName: connectionName || 'Unknown',
      schedule: {
        type: newSchedule.type,
        time: newSchedule.type !== 'hourly' ? newSchedule.time : undefined,
        dayOfWeek: newSchedule.type === 'weekly' ? newSchedule.dayOfWeek : undefined,
        dayOfMonth: newSchedule.type === 'monthly' ? newSchedule.dayOfMonth : undefined,
        timezone: newSchedule.timeZone,
      },
      notifications: {},
      notifyEmails: newSchedule.notifyEmails,
      isActive: true,
    })
    setShowCreateModal(false)
  }

  const getNextRunText = (query: ScheduledQuery) => {
    if (!query.isActive) return t('dashboard.scheduler.paused')
    if (!query.nextRun) return t('dashboard.scheduler.pending')
    return formatDateTime(query.nextRun, locale)
  }

  const getScheduleText = (schedule: ScheduledQuery['schedule']) => {
    if (schedule.type === 'hourly') return t('dashboard.scheduler.everyHour')

    // Schedules saved before times were stored only know how often they run.
    if (!schedule.time) {
      if (schedule.type === 'weekly') return t('dashboard.scheduler.everyWeek')
      if (schedule.type === 'monthly') return t('dashboard.scheduler.everyMonth')
      return t('dashboard.scheduler.everyDay')
    }

    const time = formatTimeOfDay(schedule.time, locale)
    let text: string
    if (schedule.type === 'weekly') {
      text = t('dashboard.scheduler.weeklyOn', {
        day: weekdayName(schedule.dayOfWeek ?? 1, locale),
        time,
      })
    } else if (schedule.type === 'monthly') {
      text = t('dashboard.scheduler.monthlyOn', { day: schedule.dayOfMonth ?? 1, time })
    } else {
      text = t('dashboard.scheduler.dailyAt', { time })
    }
    // Name the time zone when it is not the viewer's own.
    if (schedule.timezone && schedule.timezone !== browserTimeZone()) {
      text += ` (${zoneName(schedule.timezone, locale)})`
    }
    return text
  }

  // Reads the schedule being made back in one sentence, with the hour it runs in.
  const getRunSummary = () => {
    const { type, time, dayOfWeek, dayOfMonth, timeZone } = newSchedule
    if (type === 'hourly') return t('dashboard.scheduler.summaryHourly')

    const hour = Number(time.slice(0, 2))
    const start = formatTimeOfDay(time, locale)
    const end = formatTimeOfDay(`${String((hour + 1) % 24).padStart(2, '0')}:00`, locale)
    const zone = zoneName(timeZone, locale)

    if (type === 'weekly') {
      return t('dashboard.scheduler.summaryWeekly', {
        day: weekdayName(dayOfWeek, locale),
        start,
        end,
        zone,
      })
    }
    if (type === 'monthly') {
      const text = t('dashboard.scheduler.summaryMonthly', { day: dayOfMonth, start, end, zone })
      return dayOfMonth > 28 ? `${text} ${t('dashboard.scheduler.shortMonths')}` : text
    }
    return t('dashboard.scheduler.summaryDaily', { start, end, zone })
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {t('dashboard.scheduler.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('dashboard.scheduler.subtitle')}
          </p>
        </div>
        {currentSql && (
          <button onClick={openCreateModal} className="btn-primary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" />
            {t('dashboard.scheduler.scheduleCurrentQuery')}
          </button>
        )}
      </div>

      {/* Scheduled Queries List */}
      {queries.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl">
          <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('dashboard.scheduler.noSchedules')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t('dashboard.scheduler.noSchedulesHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {queries.map((query) => (
            <div
              key={query.id}
              className={clsx(
                'border rounded-lg p-4 transition-all',
                query.isActive
                  ? 'border-border bg-card'
                  : 'border-border/50 bg-secondary/30 opacity-75'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm truncate">{query.name}</h4>
                    {query.isActive ? (
                      <span className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] rounded-full">
                        {t('dashboard.scheduler.active')}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-full">
                        {t('dashboard.scheduler.paused')}
                      </span>
                    )}
                    {query.lastStatus === 'success' && (
                      <span className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] rounded-full">
                        last run: ok
                      </span>
                    )}
                    {query.lastStatus === 'failed' && (
                      <span
                        className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] rounded-full"
                        title={query.lastError ?? ''}
                      >
                        last run: failed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                    {query.question || query.sql.slice(0, 50) + '...'}
                  </p>
                  {query.lastStatus === 'failed' && query.lastError && (
                    <p
                      className="text-xs text-destructive mt-0.5 truncate max-w-md"
                      title={query.lastError}
                    >
                      {query.lastError}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getScheduleText(query.schedule)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('dashboard.scheduler.next')} {getNextRunText(query)}
                    </span>
                    {(query.notifyEmails?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {query.notifyEmails!.length} email
                        {query.notifyEmails!.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => onToggleSchedule(query.id)}
                    className={clsx(
                      'p-1.5 rounded-lg transition-colors',
                      query.isActive
                        ? 'text-warning hover:bg-warning/10'
                        : 'text-success hover:bg-success/10'
                    )}
                    title={
                      query.isActive
                        ? t('dashboard.scheduler.pause')
                        : t('dashboard.scheduler.resume')
                    }
                  >
                    {query.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onDeleteSchedule(query.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t('dashboard.scheduler.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center z-50 overflow-y-auto p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md my-auto shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">{t('dashboard.scheduler.scheduleQuery')}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="schedule-name" className="text-sm font-medium mb-1.5 block">
                  {t('dashboard.scheduler.name')}
                </label>
                <input
                  id="schedule-name"
                  type="text"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule((s) => ({ ...s, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t('dashboard.scheduler.namePlaceholder')}
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('dashboard.scheduler.frequency')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewSchedule((s) => ({ ...s, type }))}
                      className={clsx(
                        'py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                        newSchedule.type === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time (for non-hourly) */}
              {newSchedule.type !== 'hourly' && (
                <div>
                  <label htmlFor="schedule-time" className="text-sm font-medium mb-1.5 block">
                    {t('dashboard.scheduler.time')}
                  </label>
                  <select
                    id="schedule-time"
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule((s) => ({ ...s, time: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatTimeOfDay(hour, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Day of Week (for weekly) */}
              {newSchedule.type === 'weekly' && (
                <div>
                  <label htmlFor="schedule-weekday" className="text-sm font-medium mb-1.5 block">
                    {t('dashboard.scheduler.dayOfWeek')}
                  </label>
                  <select
                    id="schedule-weekday"
                    value={newSchedule.dayOfWeek}
                    onChange={(e) =>
                      setNewSchedule((s) => ({ ...s, dayOfWeek: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <option key={day} value={day}>
                        {weekdayName(day, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {newSchedule.type === 'monthly' && (
                <div>
                  <label htmlFor="schedule-monthday" className="text-sm font-medium mb-1.5 block">
                    {t('dashboard.scheduler.dayOfMonth')}
                  </label>
                  <select
                    id="schedule-monthday"
                    value={newSchedule.dayOfMonth}
                    onChange={(e) =>
                      setNewSchedule((s) => ({ ...s, dayOfMonth: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notify emails */}
              <div>
                <label htmlFor="schedule-email" className="text-sm font-medium mb-1.5 block">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Email notifications
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                </label>
                {/* Tag list */}
                {newSchedule.notifyEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newSchedule.notifyEmails.map((email) => (
                      <span
                        key={email}
                        className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() =>
                            setNewSchedule((s) => ({
                              ...s,
                              notifyEmails: s.notifyEmails.filter((e) => e !== email),
                            }))
                          }
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    id="schedule-email"
                    type="email"
                    value={newSchedule.emailInput}
                    onChange={(e) => setNewSchedule((s) => ({ ...s, emailInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        const email = newSchedule.emailInput.trim()
                        if (email && !newSchedule.notifyEmails.includes(email)) {
                          setNewSchedule((s) => ({
                            ...s,
                            notifyEmails: [...s.notifyEmails, email],
                            emailInput: '',
                          }))
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="email@example.com, then press Enter"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const email = newSchedule.emailInput.trim()
                      if (email && !newSchedule.notifyEmails.includes(email)) {
                        setNewSchedule((s) => ({
                          ...s,
                          notifyEmails: [...s.notifyEmails, email],
                          emailInput: '',
                        }))
                      }
                    }}
                    className="btn-secondary px-3 py-2 text-sm"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  These addresses will be notified after each run.
                </p>
              </div>

              {/* When it runs, read back in one sentence */}
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {getRunSummary()}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
                {t('dashboard.scheduler.cancel')}
              </button>
              <button onClick={handleCreate} disabled={!newSchedule.name} className="btn-primary">
                <Check className="w-4 h-4" />
                {t('dashboard.scheduler.createSchedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

// "09:00" in the reader's own style, such as "9:00 AM".
function formatTimeOfDay(time: string, locale: string): string {
  const [hour, minute] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)))
}

function weekdayName(day: number, locale: string): string {
  // 2023-01-01 was a Sunday.
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 1 + day))
  )
}

// A readable name for a time zone, such as "Pakistan Standard Time", or its ID.
function zoneName(timeZone: string, locale: string): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? timeZone
  } catch {
    return timeZone
  }
}
