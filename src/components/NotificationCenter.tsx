'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
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
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  threshold_alert: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
  },
  schedule_failed: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
  },
  team_invite: {
    icon: Users,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  billing: {
    icon: CreditCard,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
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
    try {
      const result = await getNotifications(30)
      if (result.success && result.data) {
        setNotifications(result.data.items)
        setUnreadCount(result.data.unreadCount)
      }
    } catch {
      // Network error — silently ignore, notifications not critical
    } finally {
      setIsLoading(false)
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
          'relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          isOpen
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center px-1 font-mono text-[9px] font-medium bg-foreground text-background rounded-full tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] bg-card border border-border rounded-lg shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] z-50 overflow-hidden animate-fadeIn"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-baseline gap-2.5">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[420px]">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              /* ── Empty state ── */
              <div className="px-5 py-8">
                <p className="font-serif text-xl leading-snug">Nothing new.</p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-[300px]">
                  You'll be notified when you reach query limits, scheduled queries run, and for
                  team activity.
                </p>
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
                        'flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/40 transition-colors group',
                        !n.read && 'bg-secondary/40'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 bg-secondary'
                        )}
                      >
                        <Icon className={clsx('w-3.5 h-3.5', cfg.color)} />
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
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            {timeAgo(n.createdAt)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button
                                onClick={() => handleMarkRead(n.id)}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                title="Mark as read"
                                aria-label="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(n.id)}
                              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete"
                              aria-label="Delete notification"
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
            <div className="px-5 py-2.5 border-t border-border">
              <p className="font-mono text-[10.5px] text-muted-foreground text-center">
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
