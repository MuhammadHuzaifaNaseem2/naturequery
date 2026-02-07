'use client'

import { type Ref } from 'react'
import { FileText, Keyboard, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { HistoryItem } from '@/components/QueryHistory'
import { SavedConnection } from './types'

interface WorkspaceHeaderProps {
  activeConnection: SavedConnection | undefined
  queryHistory: HistoryItem[]
  showHistory: boolean
  onToggleHistory: () => void
  onShowShortcuts: () => void
  showProfileMenu: boolean
  onToggleProfileMenu: () => void
  profileRef: Ref<HTMLDivElement>
}

export function WorkspaceHeader({
  activeConnection,
  queryHistory,
  showHistory,
  onToggleHistory,
  onShowShortcuts,
  showProfileMenu,
  onToggleProfileMenu,
  profileRef,
}: WorkspaceHeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()

  return (
    <header className="relative z-20 border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold">Query Workspace</h2>
        <p className="text-sm text-muted-foreground">
          {activeConnection ? `Connected to ${activeConnection.name}` : 'Select a connection'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleHistory}
          className={clsx(
            'btn-ghost text-sm',
            showHistory && 'bg-secondary'
          )}
        >
          <FileText className="w-4 h-4" />
          History
          {queryHistory.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {queryHistory.length}
            </span>
          )}
        </button>
        <button
          onClick={onShowShortcuts}
          className="btn-ghost text-sm"
          title="Keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={onToggleProfileMenu}
            className="btn-ghost text-sm flex items-center gap-2"
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
                {(session?.user as any)?.role && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                    {(session?.user as any)?.role}
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
                  Settings
                </button>
                <button
                  onClick={async () => {
                    onToggleProfileMenu()
                    await signOut({ redirect: false })
                    window.location.href = '/login'
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
