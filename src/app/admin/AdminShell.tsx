import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'

/** The admin console frame: navigation on the left, the page on the right. */
export default function AdminShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role?: string }
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <AdminSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
