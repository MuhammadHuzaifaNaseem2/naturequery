'use client'

import { useState } from 'react'
import { Lock, Zap, X, Database, ArrowRight, Loader2 } from 'lucide-react'
import { createCheckoutSession } from '@/actions/billing'

interface PlanLimitModalProps {
  onClose: () => void
  title?: string
  description?: string
  reason?: 'query' | 'connection'
}

export function PlanLimitModal({
  onClose,
  title = 'Connection Limit Reached',
  description = "You've reached the maximum number of database connections allowed on the Free plan.",
  reason = 'connection',
}: PlanLimitModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const { url } = await createCheckoutSession('PRO')
      if (url) window.location.assign(url)
    } catch {
      window.location.href = '/pricing'
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          <Lock className="w-5 h-5 mb-3 text-warning" aria-hidden />

          <h2 className="text-lg font-semibold mb-1.5">{title}</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>

          {/* Plan comparison */}
          <div className="rounded-xl border border-border bg-secondary/30 divide-y divide-border mb-6">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Free Plan</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {reason === 'query' ? '50 queries/mo' : '1 connection'}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Pro Plan</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                  $20/mo
                </span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {reason === 'query' ? 'Unlimited queries' : '10 connections'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Upgrade to Pro
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
