export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">← Dashboard</span>
          <span className="text-muted-foreground/40">/</span>
          <h1 className="text-lg font-semibold">AI Insights</h1>
          <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
            Beta
          </span>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Nightly AI-generated digest of your query activity
        </p>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4 mb-4" />
            <div className="h-3 bg-muted rounded w-full mb-2" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
