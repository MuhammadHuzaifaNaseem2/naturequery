import { notFound } from 'next/navigation'
import { getPublicDashboardWidgets } from '@/actions/share-dashboard'
import { PublicDashboardWidgets } from './PublicDashboardWidgets'
import { Activity } from 'lucide-react'

interface PublicDashboardProps {
  params: Promise<{
    token: string
  }>
}

export default async function PublicDashboard({ params }: PublicDashboardProps) {
  const { token } = await params

  if (!token) {
    notFound()
  }

  const result = await getPublicDashboardWidgets(token)

  if (!result.success || !result.widgets) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Activity className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h1 className="text-2xl font-bold mb-2">Dashboard Not Found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {result.error || 'This dashboard link is invalid or has been set to private.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold">{result.ownerName}&apos;s Dashboard</h1>
            <p className="text-xs text-muted-foreground">Generated via NatureQuery</p>
          </div>
        </div>
        <a 
          href="/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          Build your own
        </a>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto w-full max-w-7xl mx-auto">
        {result.widgets.length === 0 ? (
          <div className="h-64 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground">
            <p>This dashboard is empty.</p>
          </div>
        ) : (
          <PublicDashboardWidgets widgets={result.widgets} />
        )}
      </main>
    </div>
  )
}
