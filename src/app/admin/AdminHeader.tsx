'use client'

import { usePathname } from 'next/navigation'
import { Shield, ChevronRight, Sun, Moon, Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAdminTheme, useAdminClasses } from './AdminThemeProvider'

const PAGE_META: Record<string, { title: string; description: string }> = {
  '/admin':             { title: 'Overview',            description: 'System metrics and activity' },
  '/admin/users':       { title: 'User Management',     description: 'Manage users, roles and permissions' },
  '/admin/connections': { title: 'Database Connections', description: 'Monitor all database connections' },
}

export default function AdminHeader() {
  const pathname = usePathname()
  const { isDark, toggle } = useAdminTheme()
  const t = useAdminClasses()
  const page = PAGE_META[pathname] || { title: 'Admin', description: '' }

  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className={`border-b ${t.header} px-6 lg:px-8 py-3.5 backdrop-blur-sm transition-colors duration-200`}>
      <div className="flex items-center justify-between gap-4">

        {/* Left: breadcrumb + title */}
        <div>
          <div className={`flex items-center gap-1.5 text-[11px] mb-1 ${t.textSubtle}`}>
            <Shield className="w-3 h-3" />
            <span>Admin</span>
            <ChevronRight className="w-3 h-3 opacity-50" />
            <span className="text-purple-500 font-medium">{page.title}</span>
          </div>
          <h1 className={`text-lg font-bold leading-none ${t.text}`}>{page.title}</h1>
          {page.description && (
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>{page.description}</p>
          )}
        </div>

        {/* Right: clock + theme toggle */}
        <div className="flex items-center gap-2">
          {/* Live clock */}
          <div className={`hidden md:flex flex-col items-end px-3 py-1.5 rounded-xl border ${isDark ? 'bg-neutral-800/40 border-neutral-700/50' : 'bg-slate-100 border-slate-200'} transition-colors`}>
            <span className={`text-xs font-mono font-semibold tabular-nums ${t.text}`}>{time}</span>
            <span className={`text-[10px] ${t.textSubtle}`}>{date}</span>
          </div>

          {/* System status */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-[11px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>All systems operational</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-neutral-800/40 border-neutral-700/50 text-neutral-400 hover:text-white hover:bg-neutral-800' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
