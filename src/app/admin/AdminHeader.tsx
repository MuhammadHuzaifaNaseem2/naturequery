'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { ADMIN_NAV, isAdminNavActive } from './AdminSidebar'

export default function AdminHeader() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const current = ADMIN_NAV.find((item) => isAdminNavActive(pathname, item.href, item.exact))

  return (
    <header className="border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em]"
        >
          <span className="text-muted-foreground">Admin</span>
          <span className="text-muted-foreground/50" aria-hidden>
            /
          </span>
          <span className="truncate text-foreground" aria-current="page">
            {current?.label ?? 'Console'}
          </span>
        </nav>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="btn-ghost h-8 w-8 p-0"
          title={isDark ? 'Use the light theme' : 'Use the dark theme'}
          aria-label={isDark ? 'Use the light theme' : 'Use the dark theme'}
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden />
          ) : (
            <Moon className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {/* On phones the sidebar is hidden, so its links sit here */}
      <nav
        aria-label="Admin"
        className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden"
      >
        {ADMIN_NAV.map((item) => {
          const active = isAdminNavActive(pathname, item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-colors',
                active
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          )
        })}
        <Link
          href="/dashboard"
          className="whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
        </Link>
      </nav>
    </header>
  )
}
