'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  CreditCard,
  Check,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Zap,
  Building2,
  Calendar,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import {
  getUserSubscription,
  createCheckoutSession,
  cancelSubscription,
  syncSubscriptionFromLS,
} from '@/actions/billing'
import { useTranslation } from '@/contexts/LocaleContext'

type SubInfo = Awaited<ReturnType<typeof getUserSubscription>>

const PLAN_FEATURES: Record<string, { icon: typeof Sparkles; features: string[] }> = {
  FREE: {
    icon: Zap,
    features: [
      '50 queries per month',
      '1 database connection',
      'Excel & CSV export',
      'Query history (30 days)',
    ],
  },
  PRO: {
    icon: Sparkles,
    features: [
      'Unlimited queries',
      '10 database connections',
      'Team collaboration (5 members)',
      'Data visualization',
      'Saved queries & bookmarks',
      'API access',
      'Priority support',
    ],
  },
  ENTERPRISE: {
    icon: Building2,
    features: [
      'Everything in Pro',
      'Unlimited connections & members',
      'SSO / SAML',
      'Audit log & compliance',
      'Custom AI models',
      'Dedicated support & SLA',
    ],
  },
}

const PLAN_PRICES: Record<string, string> = { FREE: '$0', PRO: '$20', ENTERPRISE: '$79' }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: {
    label: 'Active',
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: CheckCircle2,
  },
  TRIALING: { label: 'Trial', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
  PAST_DUE: {
    label: 'Past Due',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    icon: AlertCircle,
  },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  EXPIRED: {
    label: 'Expired',
    color: 'text-muted-foreground bg-secondary border-border',
    icon: XCircle,
  },
}

interface UsageData {
  queries: { current: number; limit: number }
  connections: { current: number; limit: number }
  teamMembers: { current: number; limit: number }
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function daysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export function BillingSettings() {
  const { t } = useTranslation()
  const [sub, setSub] = useState<SubInfo | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showCancelModal, setShowCancelModal] = useState(false)

  useEffect(() => {
    Promise.all([getUserSubscription(), fetch('/api/usage').then((r) => r.json())])
      .then(([subData, usageData]) => {
        setSub(subData)
        if (usageData.usage) setUsage(usageData.usage)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleUpgrade(plan: 'PRO' | 'ENTERPRISE') {
    startTransition(async () => {
      try {
        setError(null)
        const { url, error: err } = await createCheckoutSession(plan)
        if (err) {
          setError(err)
          return
        }
        if (url) window.location.href = url
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleRefreshPlan() {
    startTransition(async () => {
      try {
        setError(null)
        await syncSubscriptionFromLS()
        const updated = await getUserSubscription()
        setSub(updated)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function confirmCancel() {
    setShowCancelModal(false)
    startTransition(async () => {
      try {
        setError(null)
        await cancelSubscription()
        const updated = await getUserSubscription()
        setSub(updated)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load billing information.</p>
        {error && <p className="mt-2 text-sm text-destructive font-mono break-all px-4">{error}</p>}
      </div>
    )
  }

  const isFreePlan = sub.plan === 'FREE'
  const isPaidPlan = sub.plan === 'PRO' || sub.plan === 'ENTERPRISE'
  const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG['ACTIVE']
  const StatusIcon = statusCfg.icon
  const days = daysRemaining(sub.currentPeriodEnd)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Billing &amp; Subscription</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan, usage, and billing details.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Subscription Overview Card ── */}
      <div className="card overflow-hidden">
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Current Plan
              </p>
              <p className="font-bold text-base leading-tight">{sub.planName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.color}`}
            >
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
              {sub.cancelAtPeriodEnd && ' · Cancels at period end'}
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Started
            </div>
            <p className="text-sm font-semibold">{fmt(sub.currentPeriodStart ?? null)}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {sub.cancelAtPeriodEnd ? 'Access Until' : 'Renews On'}
            </div>
            <p className="text-sm font-semibold">{fmt(sub.currentPeriodEnd)}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Clock className="w-3.5 h-3.5" />
              Days Remaining
            </div>
            <p className="text-sm font-semibold">
              {days !== null ? (
                <span className={days <= 5 ? 'text-destructive' : undefined}>
                  {days} day{days !== 1 ? 's' : ''}
                </span>
              ) : isFreePlan ? (
                'Forever'
              ) : (
                '—'
              )}
            </p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Price
            </div>
            <p className="text-sm font-semibold">
              {isFreePlan ? 'Free forever' : `${PLAN_PRICES[sub.plan]}/month`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {sub.cancelAtPeriodEnd
              ? `Your subscription is cancelled. You have access until ${fmt(sub.currentPeriodEnd)}.`
              : isFreePlan
                ? 'You are on the free plan. Upgrade anytime to unlock more features.'
                : `Your subscription renews automatically on ${fmt(sub.currentPeriodEnd)}.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshPlan}
              disabled={isPending}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync
            </button>
            {isPaidPlan && !sub.cancelAtPeriodEnd && sub.billingEnabled && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={isPending}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Usage Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Queries / month',
            current: usage?.queries.current,
            limit: sub.limits.queriesPerMonth,
          },
          {
            label: 'Connections',
            current: usage?.connections.current,
            limit: sub.limits.connections,
          },
          {
            label: 'Team Members',
            current: usage?.teamMembers.current,
            limit: sub.limits.teamMembers,
          },
        ].map(({ label, current, limit }) => {
          const pct =
            limit === -1 || limit === 0 ? 0 : Math.min(100, ((current ?? 0) / limit) * 100)
          const barColor = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary'
          return (
            <div key={label} className="glass-card rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-xl font-bold stat-number">
                {limit === -1
                  ? '∞'
                  : limit === 0
                    ? '—'
                    : current !== undefined
                      ? `${current}/${limit}`
                      : limit}
              </p>
              {limit > 0 && current !== undefined && (
                <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Plan Cards ── */}
      {!sub.billingEnabled && (
        <div className="card p-4 bg-warning/5 border-warning/20">
          <p className="text-sm text-warning font-medium">
            {t('settings.billing.stripeNotConfigured')}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {(['FREE', 'PRO', 'ENTERPRISE'] as const).map((planKey) => {
          const planInfo = PLAN_FEATURES[planKey]
          const Icon = planInfo.icon
          const isCurrent = sub.plan === planKey
          const isPro = planKey === 'PRO'
          const isEnterprise = planKey === 'ENTERPRISE'

          return (
            <div
              key={planKey}
              className={`relative p-5 flex flex-col rounded-xl transition-all duration-300 ${
                isCurrent
                  ? 'card-animated-border ring-2 ring-primary/50'
                  : isPro
                    ? 'card-gradient-border hover-scale premium-glow'
                    : 'card hover-scale'
              }`}
            >
              {isPro && !isCurrent && (
                <span className="badge-popular">{t('settings.billing.mostPopular')}</span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isPro
                      ? 'bg-gradient-to-br from-primary to-accent'
                      : isEnterprise
                        ? 'bg-gradient-to-br from-accent to-primary'
                        : 'bg-primary/10'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${isPro || isEnterprise ? 'text-white' : 'text-primary'}`}
                  />
                </div>
                <div>
                  <h4 className="font-bold text-base">{planKey}</h4>
                  <div className="price-display">
                    <span className="amount">{PLAN_PRICES[planKey]}</span>
                    <span className="period">{t('settings.billing.perMonth')}</span>
                  </div>
                </div>
              </div>

              <ul className="feature-list flex-1 mb-5">
                {planInfo.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground">
                    <Check className="check-icon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button className="btn-secondary w-full text-sm opacity-60 cursor-default" disabled>
                  {t('settings.billing.currentPlanBtn')}
                </button>
              ) : planKey === 'FREE' ? (
                isPaidPlan && !sub.cancelAtPeriodEnd ? (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={isPending || !sub.billingEnabled}
                    className="btn-secondary w-full text-sm text-destructive hover:bg-destructive/10"
                  >
                    {t('settings.billing.downgrade')}
                  </button>
                ) : null
              ) : (
                <button
                  onClick={() => handleUpgrade(planKey as 'PRO' | 'ENTERPRISE')}
                  disabled={isPending || !sub.billingEnabled}
                  className={`w-full text-sm flex items-center justify-center gap-1.5 ${isPro ? 'btn-gradient' : 'btn-primary'}`}
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      {t('settings.billing.upgradeBtn')} <ArrowUpRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Cancel Confirm Modal ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-card border border-border shadow-2xl rounded-2xl p-6 w-full max-w-md animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
              <XCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold">Cancel Subscription</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your subscription will be cancelled but you keep full access until{' '}
              <span className="font-semibold text-foreground">{fmt(sub.currentPeriodEnd)}</span>. No
              charges after that date.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-secondary/60 text-xs text-muted-foreground space-y-1">
              <p>• Access continues until end of billing period</p>
              <p>• No refund for the current period</p>
              <p>• You can re-subscribe anytime</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary flex-1">
                Keep Subscription
              </button>
              <button
                onClick={confirmCancel}
                className="btn-primary flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
