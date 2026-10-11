'use client'

import { type Ref } from 'react'
import {
  History,
  Keyboard,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Menu,
  PanelRight,
  Search,
  Share2,
  Clipboard,
  Check,
  Brain,
  HelpCircle,
  Clock,
  Scale,
  Shield,
} from 'lucide-react'
import { NotificationCenter } from '@/components/NotificationCenter'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { toggleDashboardSharing, getDashboardShareStatus } from '@/actions/share-dashboard'
import { adminSwitchPersonalPlan } from '@/actions/admin'
import type { QueryHistoryItem } from '@/actions/queries'
import { SavedConnection } from './types'
import { useTranslation } from '@/contexts/LocaleContext'

interface WorkspaceHeaderProps {
  activeConnection: SavedConnection | undefined
  queryHistory: QueryHistoryItem[]
  queryHistoryTotal?: number
  showHistory: boolean
  onToggleHistory: () => void
  onOpenScheduler?: () => void
  scheduledCount?: number
  onShowShortcuts: () => void
  showProfileMenu: boolean
  onToggleProfileMenu: () => void
  profileRef: Ref<HTMLDivElement>
  onToggleLeftSidebar?: () => void
  onToggleRightSidebar?: () => void
  onOpenCommandPalette?: () => void
  viewMode?: 'editor' | 'dashboard'
  onViewModeChange?: (mode: 'editor' | 'dashboard') => void
}

/** A tool in the top bar: an icon, with its label from very wide screens up. */
const tool =
  'relative inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

export function WorkspaceHeader({
  activeConnection,
  queryHistory,
  queryHistoryTotal,
  showHistory,
  onToggleHistory,
  onOpenScheduler,
  scheduledCount,
  onShowShortcuts,
  showProfileMenu,
  onToggleProfileMenu,
  profileRef,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onOpenCommandPalette,
  viewMode = 'editor',
  onViewModeChange,
}: WorkspaceHeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useTranslation()

  const [shareStatus, setShareStatus] = useState<{ isPublic: boolean; token?: string }>({
    isPublic: false,
  })
  const [showShareModal, setShowShareModal] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (session?.user) {
      getDashboardShareStatus()
        .then((res) => {
          if (res.success) {
            setShareStatus({ isPublic: res.isPublic, token: res.token })
          }
        })
        .catch(() => {})
    }
  }, [session])

  // The switch and the link field show the result, so these don't toast on success.
  const handleToggleShare = async (isPublic: boolean) => {
    const res = await toggleDashboardSharing(isPublic)
    if (res.success) {
      setShareStatus({ isPublic, token: res.token })
    } else {
      toast.error(t('dashboard.header.failedToShare'))
    }
  }

  const handleCopyLink = () => {
    if (!shareStatus.token) return
    const url = `${window.location.origin}/public/dashboard/${shareStatus.token}`
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const historyCount = queryHistoryTotal ?? queryHistory.length
  const tableCount = activeConnection?.schema?.tables.length
  const initial = session?.user?.name?.charAt(0)?.toUpperCase()

  return (
    <>
      <header className="relative z-20 flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {/* Hamburger - mobile only */}
          {onToggleLeftSidebar && (
            <button
              onClick={onToggleLeftSidebar}
              className={clsx(tool, 'lg:hidden')}
              title={t('dashboard.header.toggleSidebar')}
              aria-label={t('dashboard.header.toggleSidebar')}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">
              {activeConnection ? activeConnection.name : t('dashboard.header.queryWorkspace')}
            </h1>
            <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
              {activeConnection
                ? [
                    activeConnection.dbType,
                    tableCount ? `${tableCount} ${t('common.tables')}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t('dashboard.header.selectConnection')}
            </p>
          </div>

          <div
            role="tablist"
            aria-label={t('dashboard.header.editor')}
            className="ml-1 hidden flex-shrink-0 items-center rounded-md border border-border bg-card p-0.5 md:flex"
          >
            {(['editor', 'dashboard'] as const).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={viewMode === mode}
                onClick={() => onViewModeChange?.(mode)}
                className={clsx(
                  'rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
                  viewMode === mode
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`dashboard.header.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          {/* Command palette trigger */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="mr-1 hidden h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:inline-flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>{t('common.search')}</span>
              <kbd className="hidden rounded border border-border bg-background px-1 font-mono text-[10px] md:inline">
                Ctrl K
              </kbd>
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/insights')}
            className={clsx(tool, 'hidden sm:inline-flex')}
            title={t('dashboard.header.aiInsights')}
            aria-label={t('dashboard.header.insights')}
          >
            <Brain className="h-4 w-4" aria-hidden />
            <span className="hidden 2xl:inline">{t('dashboard.header.insights')}</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/investigate')}
            className={clsx(tool, 'hidden sm:inline-flex')}
            title="Investigate report differences"
            aria-label="Investigate"
          >
            <Scale className="h-4 w-4" aria-hidden />
            <span className="hidden 2xl:inline">Investigate</span>
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className={clsx(tool, 'hidden sm:inline-flex')}
            title={t('dashboard.header.shareDashboard')}
            aria-label={t('dashboard.header.share')}
          >
            <Share2 className="h-4 w-4" aria-hidden />
            <span className="hidden 2xl:inline">{t('dashboard.header.share')}</span>
          </button>
          <button
            onClick={onToggleHistory}
            className={clsx('tour-step-3', tool, showHistory && 'bg-secondary text-foreground')}
            title={t('dashboard.sidebar.history')}
            aria-label={t('dashboard.sidebar.history')}
            aria-pressed={showHistory}
          >
            <History className="h-4 w-4" aria-hidden />
            <span className="hidden 2xl:inline">{t('dashboard.sidebar.history')}</span>
            {historyCount > 0 && (
              <span className="font-mono text-[11px] tabular-nums">{historyCount}</span>
            )}
          </button>
          {onOpenScheduler && (
            <button
              onClick={onOpenScheduler}
              className={tool}
              title={t('dashboard.scheduler.title')}
              aria-label={t('dashboard.scheduler.title')}
            >
              <Clock className="h-4 w-4" aria-hidden />
              <span className="hidden 2xl:inline">{t('dashboard.scheduler.title')}</span>
              {(scheduledCount ?? 0) > 0 && (
                <span className="font-mono text-[11px] tabular-nums">{scheduledCount}</span>
              )}
            </button>
          )}
          <NotificationCenter />
          <button
            onClick={onShowShortcuts}
            className={clsx(tool, 'hidden sm:inline-flex')}
            title={t('dashboard.header.keyboardShortcuts')}
            aria-label={t('dashboard.header.keyboardShortcuts')}
          >
            <Keyboard className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('restart-product-tour'))}
            className={clsx(tool, 'hidden sm:inline-flex')}
            title="Product tour"
            aria-label="Product tour"
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
          </button>
          {/* Right sidebar toggle - mobile only */}
          {onToggleRightSidebar && (
            <button
              onClick={onToggleRightSidebar}
              className={clsx(tool, 'lg:hidden')}
              title={t('dashboard.header.togglePanel')}
              aria-label={t('dashboard.header.togglePanel')}
            >
              <PanelRight className="h-5 w-5" />
            </button>
          )}

          {/* User Profile */}
          <div className="relative ml-1" ref={profileRef}>
            <button
              onClick={onToggleProfileMenu}
              className={clsx('tour-step-4', tool, 'pl-1')}
              title={session?.user?.name || 'Profile'}
              aria-expanded={showProfileMenu}
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                  {initial || <User className="h-3.5 w-3.5" />}
                </span>
              )}
              <span className="hidden max-w-[120px] truncate text-foreground xl:inline">
                {session?.user?.name || 'User'}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-[0_24px_48px_-24px_hsl(var(--foreground)/0.45)] animate-fadeIn">
                <div className="border-b border-border p-4">
                  <div className="flex items-center gap-3">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="" className="h-9 w-9 rounded-full" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                        {initial || <User className="h-4 w-4" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {session?.user?.name || 'User'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                  </div>
                  {session?.user?.role && (
                    <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                      {session.user.role}
                    </p>
                  )}
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      onToggleProfileMenu()
                      router.push('/settings')
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {t('common.settings')}
                  </button>
                  {session?.user?.role === 'ADMIN' && (
                    <>
                      <button
                        onClick={() => {
                          onToggleProfileMenu()
                          router.push('/admin')
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                      >
                        <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {t('dashboard.header.adminPanel')}
                      </button>

                      <div className="mx-3 my-1 border-t border-border" />
                      <div className="mb-1 px-3 py-1.5">
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Admin testing
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-muted-foreground">Simulate plan</span>
                          <select
                            className="w-[100px] cursor-pointer rounded-md border border-input bg-card px-2 py-1 text-xs outline-none focus:border-foreground/40"
                            defaultValue={session?.user?.plan || 'FREE'}
                            onChange={async (e) => {
                              const newPlan = e.target.value as 'FREE' | 'PRO' | 'ENTERPRISE'
                              const toastId = toast.loading('Switching plan...')
                              const res = await adminSwitchPersonalPlan(newPlan)
                              if (res.success) {
                                toast(`Switched to the ${newPlan} plan`, { id: toastId })
                                setTimeout(() => {
                                  window.location.reload()
                                }, 500)
                              } else {
                                toast.error('Failed to switch plan', { id: toastId })
                              }
                            }}
                          >
                            <option value="FREE">Free</option>
                            <option value="PRO">Pro</option>
                            <option value="ENTERPRISE">Enterprise</option>
                          </select>
                        </div>
                      </div>
                      <div className="mx-3 my-1 border-t border-border" />
                    </>
                  )}
                  <button
                    onClick={async () => {
                      onToggleProfileMenu()
                      await signOut({ redirect: false })
                      window.location.href = '/login'
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    {t('common.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showShareModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            role="dialog"
            aria-labelledby="share-dashboard-title"
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="share-dashboard-title" className="text-base font-semibold">
              {t('dashboard.header.shareDashboard')}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('dashboard.header.shareDescription')}
            </p>

            <div className="mt-5 flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <span className="text-sm font-medium">{t('dashboard.header.publicLinkAccess')}</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={shareStatus.isPublic}
                  onChange={(e) => handleToggleShare(e.target.checked)}
                  aria-label={t('dashboard.header.publicLinkAccess')}
                />
                <div className="h-6 w-11 rounded-full bg-muted transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring/60"></div>
              </label>
            </div>

            {shareStatus.isPublic && shareStatus.token ? (
              <div className="mt-4 animate-fadeIn">
                <label
                  htmlFor="public-dashboard-link"
                  className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {t('dashboard.header.publicDashboardLink')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="public-dashboard-link"
                    type="text"
                    readOnly
                    value={`${window.location.origin}/public/dashboard/${shareStatus.token}`}
                    className="input flex-1 font-mono text-xs"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="btn-secondary h-9 px-3"
                    aria-label={isCopied ? t('common.copied') : t('common.copy')}
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowShareModal(false)} className="btn-secondary">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
