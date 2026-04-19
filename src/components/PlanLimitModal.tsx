'use client'

import Link from 'next/link'
import { Lock, Zap, X, Database, ArrowRight } from 'lucide-react'

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
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-amber-500" />
          </div>

          {/* Text */}
          <h2 className="text-xl font-bold mb-2">{title}</h2>
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
                  $29/mo
                </span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {reason === 'query' ? 'Unlimited queries' : '10 connections'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              Upgrade to Pro
              <ArrowRight className="w-4 h-4" />
            </Link>
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
