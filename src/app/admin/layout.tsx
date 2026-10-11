import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import AdminShell from './AdminShell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Console',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect('/login')

  if (session.user.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Admin console
          </p>
          <h1 className="mt-3 font-serif text-[2rem] font-normal leading-tight tracking-[-0.02em]">
            This account can&apos;t open the admin console.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Only accounts with the Admin role can see it. If you need access, ask an admin to change
            your role.
          </p>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card p-4 font-mono text-xs">
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="truncate">{session.user.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{session.user.role || 'None'}</dd>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/dashboard" className="btn-primary">
              Back to the dashboard
            </Link>
            <div className="w-auto">
              <SignOutButton />
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <AdminShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    >
      {children}
    </AdminShell>
  )
}
