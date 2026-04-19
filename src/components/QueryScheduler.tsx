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

export interface ScheduledQuery {
    id: string
    name: string
    question: string
    sql: string
    connectionId: string
    connectionName: string
    schedule: {
        type: 'hourly' | 'daily' | 'weekly' | 'monthly'
        time?: string // HH:MM format
        dayOfWeek?: number // 0-6 for weekly
        dayOfMonth?: number // 1-31 for monthly
    }
    notifications: {
        email?: boolean
        inApp?: boolean
    }
    notifyEmails?: string[]     // actual email addresses to notify
    isActive: boolean
    lastRun?: Date
    nextRun?: Date
    lastStatus?: 'success' | 'failed' | null
    lastError?: string | null
    createdAt: Date
}

interface QuerySchedulerProps {
    queries: ScheduledQuery[]
    onCreateSchedule: (schedule: Omit<ScheduledQuery, 'id' | 'lastRun' | 'nextRun' | 'createdAt'>) => void
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
    const { t } = useTranslation()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newSchedule, setNewSchedule] = useState({
        name: '',
        type: 'daily' as 'hourly' | 'daily' | 'weekly' | 'monthly',
        time: '09:00',
        dayOfWeek: 1,
        dayOfMonth: 1,
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
        return formatDateTime(query.nextRun)
    }

    const getScheduleText = (schedule: ScheduledQuery['schedule']) => {
        switch (schedule.type) {
            case 'hourly':
                return t('dashboard.scheduler.everyHour')
            case 'daily':
                return t('dashboard.scheduler.dailyAt').replace('{{time}}', schedule.time || '')
            case 'weekly':
                return t('dashboard.scheduler.weeklyOn').replace('{{day}}', getDayName(schedule.dayOfWeek!)).replace('{{time}}', schedule.time || '')
            case 'monthly':
                return t('dashboard.scheduler.monthlyOn').replace('{{day}}', String(schedule.dayOfMonth)).replace('{{time}}', schedule.time || '')
            default:
                return ''
        }
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
                    <button
                        onClick={openCreateModal}
                        className="btn-primary text-xs py-1.5 px-3"
                    >
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
                                            <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] rounded-full" title={query.lastError ?? ''}>
                                                last run: failed
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                        {query.question || query.sql.slice(0, 50) + '...'}
                                    </p>
                                    {query.lastStatus === 'failed' && query.lastError && (
                                        <p className="text-xs text-destructive mt-0.5 truncate max-w-md" title={query.lastError}>
                                            {query.lastError}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
                                                {query.notifyEmails!.length} email{query.notifyEmails!.length !== 1 ? 's' : ''}
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
                                                ? 'text-amber-500 hover:bg-amber-500/10'
                                                : 'text-success hover:bg-success/10'
                                        )}
                                        title={query.isActive ? t('dashboard.scheduler.pause') : t('dashboard.scheduler.resume')}
                                    >
                                        {query.isActive ? (
                                            <Pause className="w-4 h-4" />
                                        ) : (
                                            <Play className="w-4 h-4" />
                                        )}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-scaleIn">
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
                                <label className="text-sm font-medium mb-1.5 block">{t('dashboard.scheduler.name')}</label>
                                <input
                                    type="text"
                                    value={newSchedule.name}
                                    onChange={(e) => setNewSchedule(s => ({ ...s, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    placeholder={t('dashboard.scheduler.namePlaceholder')}
                                />
                            </div>

                            {/* Frequency */}
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">{t('dashboard.scheduler.frequency')}</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setNewSchedule(s => ({ ...s, type }))}
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
                                    <label className="text-sm font-medium mb-1.5 block">{t('dashboard.scheduler.time')}</label>
                                    <input
                                        type="time"
                                        value={newSchedule.time}
                                        onChange={(e) => setNewSchedule(s => ({ ...s, time: e.target.value }))}
                                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                            )}

                            {/* Day of Week (for weekly) */}
                            {newSchedule.type === 'weekly' && (
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t('dashboard.scheduler.dayOfWeek')}</label>
                                    <select
                                        value={newSchedule.dayOfWeek}
                                        onChange={(e) => setNewSchedule(s => ({ ...s, dayOfWeek: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                                            <option key={i} value={i}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Day of Month (for monthly) */}
                            {newSchedule.type === 'monthly' && (
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t('dashboard.scheduler.dayOfMonth')}</label>
                                    <select
                                        value={newSchedule.dayOfMonth}
                                        onChange={(e) => setNewSchedule(s => ({ ...s, dayOfMonth: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                            <option key={day} value={day}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Notify emails */}
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">
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
                                                    onClick={() => setNewSchedule(s => ({ ...s, notifyEmails: s.notifyEmails.filter(e => e !== email) }))}
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
                                        type="email"
                                        value={newSchedule.emailInput}
                                        onChange={(e) => setNewSchedule(s => ({ ...s, emailInput: e.target.value }))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault()
                                                const email = newSchedule.emailInput.trim()
                                                if (email && !newSchedule.notifyEmails.includes(email)) {
                                                    setNewSchedule(s => ({ ...s, notifyEmails: [...s.notifyEmails, email], emailInput: '' }))
                                                }
                                            }
                                        }}
                                        className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        placeholder="email@example.com — press Enter to add"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const email = newSchedule.emailInput.trim()
                                            if (email && !newSchedule.notifyEmails.includes(email)) {
                                                setNewSchedule(s => ({ ...s, notifyEmails: [...s.notifyEmails, email], emailInput: '' }))
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

                            {/* Info */}
                            <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    {t('dashboard.scheduler.infoText')}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="btn-secondary"
                            >
                                {t('dashboard.scheduler.cancel')}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newSchedule.name}
                                className="btn-primary"
                            >
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
function formatDateTime(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function getDayName(day: number): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
}
