'use client'

import { useMemo } from 'react'
import { BarChart3, Activity } from 'lucide-react'
import { GlowCard } from '@/components/GlowCard'

interface PublicWidget {
  id: string
  title: string
  question: string
  sql: string
  position: number
}

interface PublicDashboardWidgetsProps {
  widgets: PublicWidget[]
}

export function PublicDashboardWidgets({ widgets }: PublicDashboardWidgetsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {widgets.map((widget) => (
        <GlowCard key={widget.id} className="flex flex-col hover:border-primary/50 transition-colors p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm line-clamp-1" title={widget.title}>
                {widget.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{widget.question}</p>
            </div>
          </div>

          <div className="flex-1 min-h-[120px] flex items-center justify-center rounded-lg bg-secondary/30 border border-border/50 p-4">
            <div className="text-center text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Chart data loads on execution</p>
              <p className="text-[10px] mt-1 opacity-60 font-mono max-w-xs truncate">{widget.sql}</p>
            </div>
          </div>
        </GlowCard>
      ))}
    </div>
  )
}
