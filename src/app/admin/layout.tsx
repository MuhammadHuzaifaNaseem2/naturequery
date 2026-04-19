import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import SignOutButton from '@/components/SignOutButton'
import AdminThemeProvider from './AdminThemeProvider'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Console — NatureQuery',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect('/login')

  if (session.user.role !== 'ADMIN') {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-white flex-col gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-neutral-500">You do not have permission to view this page.</p>
        </div>
        <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 font-mono text-sm text-neutral-500 flex flex-col gap-1.5">
          <div>User: <span className="text-neutral-300">{session.user.email}</span></div>
          <div>Role: <span className="text-neutral-300">{session.user.role || 'None'}</span></div>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-5 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors text-sm">
            Return to App
          </Link>
          <SignOutButton />
        </div>
      </div>
    )
  }

  return (
    <AdminThemeProvider user={{
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    }}>
      {children}
    </AdminThemeProvider>
  )
}
