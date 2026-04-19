'use client'

import { type Ref } from 'react'
import { FileText, Keyboard, ChevronDown, LogOut, User, Settings, Menu, PanelRight, Search, Share2, Clipboard, Check, Sparkles, Bell, HelpCircle } from 'lucide-react'
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

export function WorkspaceHeader({
  activeConnection,
  queryHistory,
  queryHistoryTotal,
  showHistory,
  onToggleHistory,
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

  const [shareStatus, setShareStatus] = useState<{ isPublic: boolean; token?: string }>({ isPublic: false })
  const [showShareModal, setShowShareModal] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (session?.user) {
      getDashboardShareStatus().then(res => {
        if (res.success) {
          setShareStatus({ isPublic: res.isPublic, token: res.token })
        }
      })
    }
  }, [session])

  const handleToggleShare = async (isPublic: boolean) => {
    const res = await toggleDashboardSharing(isPublic)
    if (res.success) {
      setShareStatus({ isPublic, token: res.token })
      toast.success(isPublic ? t('dashboard.header.dashboardIsPublic') : t('dashboard.header.dashboardIsPrivate'))
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
    toast.success(t('dashboard.header.linkCopied'))
  }

  return (
    <>
    <header className="relative z-20 border-b border-border bg-card/50 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger - mobile only */}
        {onToggleLeftSidebar && (
          <button
            onClick={onToggleLeftSidebar}
            className="lg:hidden btn-ghost p-2"
            title={t('dashboard.header.toggleSidebar')}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold truncate">
            <span className="sm:hidden">NatureQuery</span>
            <span className="hidden sm:inline">{t('dashboard.header.queryWorkspace')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {activeConnection ? t('dashboard.header.connectedTo', { name: activeConnection.name }) : t('dashboard.header.selectConnection')}
          </p>
        </div>
      </div>

      <div className="hidden md:flex items-center mx-4 flex-shrink-0 bg-secondary/50 p-1 rounded-lg border border-border">
        <button
          onClick={() => onViewModeChange?.('editor')}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
            viewMode === 'editor' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-secondary'
          )}
        >
          {t('dashboard.header.editor')}
        </button>
        <button
          onClick={() => onViewModeChange?.('dashboard')}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
            viewMode === 'dashboard' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-secondary'
          )}
        >
          {t('dashboard.header.dashboard')}
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Command palette trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary/50 border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">{t('common.search')}...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded">
              Ctrl K
            </kbd>
          </button>
        )}
        <button
          onClick={() => router.push('/dashboard/insights')}
          className="hidden sm:flex btn-ghost text-sm items-center gap-1.5"
          title={t('dashboard.header.aiInsights')}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden lg:inline">{t('dashboard.header.insights')}</span>
        </button>
        <button
          onClick={() => setShowShareModal(true)}
          className="hidden sm:flex btn-ghost text-sm items-center gap-1.5"
          title={t('dashboard.header.shareDashboard')}
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden lg:inline">{t('dashboard.header.share')}</span>
        </button>
        <NotificationCenter />
        <button
          onClick={onToggleHistory}
          className={clsx(
            'tour-step-3 btn-ghost text-sm',
            showHistory && 'bg-secondary'
          )}
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">{t('dashboard.sidebar.history')}</span>
          {(queryHistoryTotal ?? queryHistory.length) > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {queryHistoryTotal ?? queryHistory.length}
            </span>
          )}
        </button>
        <button
          onClick={onShowShortcuts}
          className="hidden sm:flex btn-ghost text-sm"
          title={t('dashboard.header.keyboardShortcuts')}
        >
          <Keyboard className="w-4 h-4" />
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('restart-product-tour'))}
          className="hidden sm:flex btn-ghost text-sm"
          title="Product Tour"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        {/* Right sidebar toggle - mobile only */}
        {onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className="lg:hidden btn-ghost p-2"
            title={t('dashboard.header.togglePanel')}
          >
            <PanelRight className="w-5 h-5" />
          </button>
        )}

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={onToggleProfileMenu}
            className="tour-step-4 btn-ghost text-sm flex items-center gap-2"
            title={session?.user?.name || 'Profile'}
          >
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                {session?.user?.name?.charAt(0)?.toUpperCase() || <User className="w-3.5 h-3.5" />}
              </div>
            )}
            <span className="hidden sm:inline max-w-[120px] truncate">
              {session?.user?.name || 'User'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-fadeIn">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                      {session?.user?.name?.charAt(0)?.toUpperCase() || <User className="w-5 h-5" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{session?.user?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                </div>
                {session?.user?.role && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                    {session.user.role}
                  </span>
                )}
              </div>
              <div className="p-1">

                <button
                  onClick={() => {
                    onToggleProfileMenu()
                    router.push('/settings')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  {t('common.settings')}
                </button>
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => {
                        onToggleProfileMenu()
                        router.push('/admin')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      {t('dashboard.header.adminPanel')}
                    </button>

                    <div className="mx-3 my-1 border-t border-border"></div>
                    <div className="px-3 py-1.5 mb-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-primary" />
                        Admin Testing
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Simulate Plan</span>
                        <select 
                          className="bg-secondary/80 border border-border rounded-md text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-primary w-[100px] cursor-pointer"
                          defaultValue={session?.user?.plan || 'FREE'}
                          onChange={async (e) => {
                            const newPlan = e.target.value as 'FREE' | 'PRO' | 'ENTERPRISE'
                            const toastId = toast.loading('Switching plan...')
                            const res = await adminSwitchPersonalPlan(newPlan)
                            if (res.success) {
                              toast.success(`Switched to ${newPlan} plan!`, { id: toastId })
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
                    <div className="mx-3 my-1 border-t border-border"></div>
                  </>
                )}
                <button
                  onClick={async () => {
                    onToggleProfileMenu()
                    await signOut({ redirect: false })
                    window.location.href = '/login'
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t('common.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" /> {t('dashboard.header.shareDashboard')}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('dashboard.header.shareDescription')}
            </p>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border mb-4">
              <span className="font-medium text-sm">{t('dashboard.header.publicLinkAccess')}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={shareStatus.isPublic}
                  onChange={(e) => handleToggleShare(e.target.checked)}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {shareStatus.isPublic && shareStatus.token ? (
              <div className="mb-6 animate-fadeIn">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('dashboard.header.publicDashboardLink')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/public/dashboard/${shareStatus.token}`}
                    className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="btn-secondary"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
