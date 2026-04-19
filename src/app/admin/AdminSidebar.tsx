'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { LayoutDashboard, Database, Users, Settings, ExternalLink } from 'lucide-react'
import SignOutButton from '@/components/SignOutButton'
import { AppLogo } from '@/components/AppLogo'

import { useAdminTheme, useAdminClasses } from './AdminThemeProvider'

interface AdminSidebarProps {
  user: { name?: string | null; email?: string | null; role?: string }
}

const NAV_ITEMS = [
  { href: '/admin',             label: 'Overview',    icon: LayoutDashboard, exact: true },
  { href: '/admin/users',       label: 'Users',       icon: Users },
  { href: '/admin/connections', label: 'Connections', icon: Database },
]

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const { isDark } = useAdminTheme()
  const t = useAdminClasses()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside className={`w-[260px] flex flex-col border-r ${t.sidebar} transition-colors duration-200`}>

      {/* Top gradient line */}
      <div className="h-[2px] bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 opacity-80" />

      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <AppLogo size="md" showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`font-bold text-[15px] tracking-tight ${t.text}`}>NatureQuery</h1>
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                Admin
              </span>
            </div>
            <p className={`text-[10px] ${t.textSubtle} mt-0.5`}>Control Panel</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className={`mx-4 border-t ${isDark ? 'border-neutral-800/60' : 'border-slate-100'}`} />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className={`px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest ${t.textSubtle}`}>
          Dashboard
        </p>

        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active ? t.navActive : t.navInactive
              )}
            >
              <item.icon className={clsx('w-[17px] h-[17px] flex-shrink-0', active ? 'text-purple-500' : '')} />
              <span>{item.label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/60" />
              )}
            </Link>
          )
        })}

        <div className="pt-5">
          <p className={`px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest ${t.textSubtle}`}>
            System
          </p>
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${t.navInactive}`}
          >
            <Settings className="w-[17px] h-[17px] flex-shrink-0" />
            <span>Settings</span>
          </Link>
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${t.navInactive}`}
          >
            <ExternalLink className="w-[17px] h-[17px] flex-shrink-0" />
            <span>Main App</span>
          </Link>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-3">
        <div className={`p-3 rounded-xl border ${t.userCard} transition-colors duration-200`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md shadow-purple-500/20">
              {user.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${t.text}`}>{user.name || 'Admin'}</p>
              <p className={`text-[11px] truncate ${t.textSubtle}`}>{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                {user.role || 'ADMIN'}
              </span>
            </div>
            <div className="ml-auto">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
