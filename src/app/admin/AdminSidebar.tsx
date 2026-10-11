'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { clsx } from 'clsx'
import { LayoutDashboard, Database, Users, Settings, ArrowLeft, LogOut } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'

export const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'People', icon: Users },
  { href: '/admin/connections', label: 'Connections', icon: Database },
]

export function isAdminNavActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href)
}

const navLink =
  'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-ring'

export default function AdminSidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null; role?: string }
}) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <Link href="/admin" className="flex items-center gap-2" aria-label="Admin overview">
          <AppLogo size="sm" textClassName="text-[15px] font-semibold tracking-[-0.01em]" />
        </Link>
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Admin
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3" aria-label="Admin">
        <p className="px-2 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Console
        </p>
        {ADMIN_NAV.map((item) => {
          const active = isAdminNavActive(pathname, item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                navLink,
                active
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden />
              {item.label}
            </Link>
          )
        })}

        <p className="px-2 pb-2 pt-6 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Your account
        </p>
        <Link
          href="/dashboard"
          className={clsx(
            navLink,
            'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
          )}
        >
          <ArrowLeft className="h-4 w-4 flex-shrink-0" aria-hidden />
          Dashboard
        </Link>
        <Link
          href="/settings"
          className={clsx(
            navLink,
            'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4 flex-shrink-0" aria-hidden />
          Settings
        </Link>
      </nav>

      <div className="border-t border-border p-4">
        <p className="truncate text-sm font-medium">{user.name || 'Admin'}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="btn-ghost -ml-2 mt-2 h-8 px-2 text-xs"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  )
}
