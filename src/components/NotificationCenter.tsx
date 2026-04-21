'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  AlertTriangle,
  Sparkles,
  Users,
  CreditCard,
  Info,
  Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationItem,
} from '@/actions/notifications'

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; bg: string; border: string }
> = {
  query_complete: {
    icon: Sparkles,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  threshold_alert: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  schedule_failed: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
  },
  team_invite: {
    icon: Users,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  billing: {
    icon: CreditCard,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  system: {
    icon: Info,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
  },
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    const result = await getNotifications(30)
    setIsLoading(false)
    if (result.success && result.data) {
      setNotifications(result.data.items)
      setUnreadCount(result.data.unreadCount)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 15000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      )
        setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [isOpen])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleDelete = async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.read)
    await deleteNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => {
          setIsOpen((o) => !o)
          if (!isOpen) loadNotifications()
        }}
        className={clsx(
          'relative p-2 rounded-lg transition-all',
          isOpen
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] flex items-center justify-center px-1 text-[9px] font-bold bg-primary text-primary-foreground rounded-full shadow-sm shadow-primary/40">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[min(400px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-scaleIn"
        >
          {/* Gradient accent top bar */}
          <div className="h-[3px] bg-gradient-to-r from-primary via-accent to-primary" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full shadow-sm shadow-primary/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[420px]">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
                <p className="text-xs text-muted-foreground">Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              /* ── Empty state ── */
              <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
                <div className="relative mb-5">
                  {/* Outer ring */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 flex items-center justify-center">
                    {/* Inner circle */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Bell className="w-6 h-6 text-primary/60" />
                    </div>
                  </div>
                  {/* Floating dots */}
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary/30 border-2 border-card" />
                  <span className="absolute bottom-2 left-0 w-2 h-2 rounded-full bg-accent/30 border-2 border-card" />
                </div>
                <p className="font-semibold text-sm mb-1.5">All caught up!</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                  You'll be notified when you reach query limits, scheduled queries run, and for
                  team activity.
                </p>
                {/* Decorative pills */}
                <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
                  {[
                    {
                      icon: AlertTriangle,
                      label: 'Usage alerts',
                      color: 'text-amber-500 bg-amber-500/10',
                    },
                    {
                      icon: Sparkles,
                      label: 'Scheduled queries',
                      color: 'text-violet-500 bg-violet-500/10',
                    },
                    { icon: Users, label: 'Team updates', color: 'text-blue-500 bg-blue-500/10' },
                  ].map(({ icon: Icon, label, color }) => (
                    <span
                      key={label}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border border-border/50 ${color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                  const Icon = cfg.icon
                  return (
                    <div
                      key={n.id}
                      className={clsx(
                        'flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors group',
                        !n.read && 'bg-primary/[0.025]'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border',
                          cfg.bg,
                          cfg.border
                        )}
                      >
                        <Icon className={clsx('w-4 h-4', cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={clsx(
                              'text-sm leading-snug',
                              !n.read ? 'font-semibold' : 'font-medium'
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5 shadow-sm shadow-primary/50" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(n.createdAt)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button
                                onClick={() => handleMarkRead(n.id)}
                                className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(n.id)}
                              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-border/60 bg-secondary/20">
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Showing last {notifications.length} notification
                {notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
