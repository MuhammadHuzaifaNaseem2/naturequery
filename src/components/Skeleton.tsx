'use client'

import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
}

export function SkeletonLine({ className }: SkeletonProps) {
  return <div className={clsx('h-4 rounded skeleton-shine', className)} />
}

export function SkeletonCircle({ className }: SkeletonProps) {
  return <div className={clsx('rounded-full skeleton-shine', className || 'w-10 h-10')} />
}

export function SkeletonCard({ className }: SkeletonProps) {
  return <div className={clsx('rounded-xl skeleton-shine', className || 'h-24 w-full')} />
}

export function ConnectionListSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg skeleton-shine" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded skeleton-shine" />
              <div className="h-3 w-1/2 rounded skeleton-shine" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SchemaBrowserSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="h-8 rounded-lg skeleton-shine" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <div className="w-4 h-4 rounded skeleton-shine" />
          <div className="w-4 h-4 rounded skeleton-shine" />
          <div className="h-3.5 rounded skeleton-shine" style={{ width: `${50 + i * 8}%` }} />
        </div>
      ))}
    </div>
  )
}

export function QueryHistorySkeleton() {
  return (
    <div className="space-y-1">
      <div className="px-3 py-1.5">
        <div className="h-3 w-16 rounded skeleton-shine" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-3 border-b border-border/50">
          <div className="flex items-start gap-2">
            <div className="w-3.5 h-3.5 rounded-full skeleton-shine mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-4/5 rounded skeleton-shine" />
              <div className="h-3 w-3/5 rounded skeleton-shine" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SavedQueriesSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-border">
          <div className="space-y-2">
            <div className="h-3.5 w-3/4 rounded skeleton-shine" />
            <div className="h-3 w-full rounded skeleton-shine" />
            <div className="h-2.5 w-2/3 rounded skeleton-shine" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ResultsTableSkeleton() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex gap-0 border-b border-border bg-secondary/70">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 px-4 py-3">
            <div className="h-3.5 w-20 rounded skeleton-shine" />
          </div>
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className={`flex gap-0 border-b border-border/50 ${row % 2 === 0 ? 'bg-secondary/30' : ''}`}>
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="flex-1 px-4 py-2.5">
              <div className="h-3 rounded skeleton-shine" style={{ width: `${40 + col * 10}%` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
