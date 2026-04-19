'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'

// ─── Theme Context ────────────────────────────────────────────────────────

interface ThemeContextValue {
  isDark: boolean
  toggle: () => void
}

const ThemeCtx = createContext<ThemeContextValue>({ isDark: true, toggle: () => {} })
export const useAdminTheme = () => useContext(ThemeCtx)

// ─── Semantic theme classes — import this in each page ───────────────────

export function useAdminClasses() {
  const { isDark } = useAdminTheme()
  return {
    page:          isDark ? 'bg-neutral-900' : 'bg-slate-50',
    card:          isDark ? 'bg-neutral-900/80 border-neutral-800/60' : 'bg-white border-slate-200',
    cardSolid:     isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200',
    sidebar:       isDark ? 'bg-neutral-950/90 border-neutral-800/60' : 'bg-white border-slate-200',
    header:        isDark ? 'bg-neutral-900/60 border-neutral-800/60' : 'bg-white/90 border-slate-200',
    text:          isDark ? 'text-white' : 'text-slate-900',
    textMuted:     isDark ? 'text-neutral-400' : 'text-slate-500',
    textSubtle:    isDark ? 'text-neutral-500' : 'text-slate-400',
    textTiny:      isDark ? 'text-neutral-600' : 'text-slate-300',
    input:         isDark ? 'bg-neutral-800/50 border-neutral-700/50 text-white placeholder:text-neutral-600 focus:ring-purple-500/50' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-purple-500/40',
    select:        isDark ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-300' : 'bg-white border-slate-300 text-slate-700',
    tableHead:     isDark ? 'text-neutral-500 border-neutral-800' : 'text-slate-400 border-slate-200',
    tableRow:      isDark ? 'hover:bg-white/[0.02] divide-neutral-800/50' : 'hover:bg-slate-50 divide-slate-100',
    tableExpanded: isDark ? 'bg-neutral-800/20 border-neutral-800/50' : 'bg-slate-50 border-slate-200',
    navActive:     isDark ? 'bg-purple-500/10 text-white border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200',
    navInactive:   isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
    userCard:      isDark ? 'bg-neutral-900/60 border-neutral-800/50' : 'bg-slate-50 border-slate-200',
    statBg:        isDark ? 'bg-neutral-800' : 'bg-slate-100',
    badge: {
      FREE:       isDark ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-slate-100 text-slate-500 border-slate-200',
      PRO:        isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200',
      ENTERPRISE: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-200',
      ADMIN:      isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200',
      ANALYST:    isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200',
      VIEWER:     isDark ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-slate-100 text-slate-500 border-slate-200',
    },
    btnSecondary:  isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/50' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300',
    pagination:    isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30',
  }
}

// ─── Provider (also renders the shell layout) ─────────────────────────────

export default function AdminThemeProvider({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role?: string }
  children: React.ReactNode
}) {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme')
    if (saved === 'light') setIsDark(false)
    setMounted(true)
  }, [])

  function toggle() {
    setIsDark(prev => {
      localStorage.setItem('admin-theme', prev ? 'light' : 'dark')
      return !prev
    })
  }

  // Prevent flash — render with default dark until localStorage is read
  const bg = !mounted ? 'bg-neutral-900' : isDark ? 'bg-neutral-900' : 'bg-slate-50'
  const text = !mounted ? 'text-neutral-100' : isDark ? 'text-neutral-100' : 'text-slate-900'

  return (
    <ThemeCtx.Provider value={{ isDark: mounted ? isDark : true, toggle }}>
      <div className={`flex h-screen ${bg} ${text} font-sans transition-colors duration-200`}>
        <AdminSidebar user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-auto">
            <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  )
}
