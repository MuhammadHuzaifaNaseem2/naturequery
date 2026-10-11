'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  CreditCard,
  Check,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Calendar,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  Download,
  Receipt,
  Users,
} from 'lucide-react'
import {
  getUserSubscription,
  createCheckoutSession,
  cancelSubscription,
  resumeSubscription,
  syncSubscriptionFromLS,
  getBillingDetails,
  type BillingDetails,
} from '@/actions/billing'
import { useTranslation } from '@/contexts/LocaleContext'

type SubInfo = Awaited<ReturnType<typeof getUserSubscription>>

const PLAN_FEATURES: Record<string, { name: string; features: string[] }> = {
  FREE: {
    name: 'Free',
    features: [
      '50 AI questions a month',
      '1 database connection',
      'Excel and CSV export',
      '30 days of query history',
    ],
  },
  PRO: {
    name: 'Pro',
    features: [
      'Unlimited AI questions',
      '10 database connections',
      'You and up to 4 team members',
      'Dashboards and scheduled queries',
      'Shared query links and API access',
      'Priority support',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    features: [
      'Everything in Pro',
      'Unlimited database connections',
      'Unlimited team members',
      'Audit logs',
      'Dedicated support and SLA',
    ],
  },
}

const PLAN_PRICES: Record<string, string> = { FREE: '$0', PRO: '$20', ENTERPRISE: '$79' }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: {
    label: 'Active',
    color: 'text-success bg-success/5 border-success/20',
    icon: CheckCircle2,
  },
  TRIALING: { label: 'Trial', color: 'text-primary bg-primary/5 border-primary/20', icon: Clock },
  PAST_DUE: {
    label: 'Past Due',
    color: 'text-warning bg-warning/5 border-warning/20',
    icon: AlertCircle,
  },
  CANCELED: {
    label: 'Cancelled',
    color: 'text-destructive bg-destructive/5 border-destructive/20',
    icon: XCircle,
  },
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
  const [billing, setBilling] = useState<BillingDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showCancelModal, setShowCancelModal] = useState(false)

  useEffect(() => {
    Promise.all([
      getUserSubscription(),
      fetch('/api/usage').then((r) => r.json()),
      getBillingDetails(),
    ])
      .then(([subData, usageData, billingData]) => {
        setSub(subData)
        if (usageData.usage) setUsage(usageData.usage)
        setBilling(billingData)
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
        if (url) window.location.assign(url)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  async function refreshAll() {
    await syncSubscriptionFromLS()
    const [updated, billingData] = await Promise.all([getUserSubscription(), getBillingDetails()])
    setSub(updated)
    setBilling(billingData)
  }

  function handleRefreshPlan() {
    startTransition(async () => {
      try {
        setError(null)
        await refreshAll()
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleResume() {
    startTransition(async () => {
      try {
        setError(null)
        await resumeSubscription()
        await refreshAll()
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
        await refreshAll()
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
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {sub.teamPlan && (
        <div className="card p-4 flex items-start gap-3">
          <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden />
          <p className="text-sm">
            Your plan comes from the <span className="font-semibold">{sub.teamPlan.teamName}</span>{' '}
            team. Its {sub.teamPlan.planName} plan covers your AI questions and features in
            NatureQuery and NatureQuery Desktop, so you don&apos;t need a plan of your own.
          </p>
        </div>
      )}

      {/* ── Subscription Overview Card ── */}
      <div className="card overflow-hidden">
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Current plan
            </p>
            <p className="mt-0.5 font-serif text-2xl leading-tight">{sub.planName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}
            >
              <StatusIcon className="w-3 h-3" aria-hidden />
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
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
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
            {isPaidPlan && sub.cancelAtPeriodEnd && sub.billingEnabled && (
              <button
                onClick={handleResume}
                disabled={isPending}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 text-success hover:bg-success/5 border-success/20"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Resume Subscription
              </button>
            )}
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

      {/* ── Payment Method ── */}
      {isPaidPlan && billing?.paymentMethod && (
        <div className="card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                Payment Method
              </p>
              <p className="font-semibold text-sm capitalize">
                {billing.paymentMethod.brand} ending in{' '}
                <span className="font-mono">{billing.paymentMethod.lastFour}</span>
              </p>
            </div>
          </div>
          {billing.updatePaymentUrl && (
            <a
              href={billing.updatePaymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm flex items-center gap-2 flex-shrink-0"
            >
              <CreditCard className="w-4 h-4" />
              Update Card
            </a>
          )}
        </div>
      )}

      {/* ── Billing History ── */}
      {isPaidPlan && billing && billing.invoices.filter((inv) => inv.total > 0).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Billing History</h3>
          </div>
          <div className="divide-y divide-border">
            {billing.invoices
              .filter((inv) => inv.total > 0)
              .map((inv) => {
                const date = inv.date
                  ? new Date(inv.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'
                const isPaid = inv.status === 'paid'
                const isRefunded = inv.status === 'refunded'
                return (
                  <div key={inv.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <p className="font-medium">{date}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inv.amount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isPaid
                            ? 'bg-success/5 text-success'
                            : isRefunded
                              ? 'bg-warning/5 text-warning'
                              : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {isPaid ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                      {inv.invoiceUrl && (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Invoice
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Usage Stats ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Queries / month',
            current: usage?.queries.current,
            limit: sub.effectiveLimits.queriesPerMonth,
          },
          {
            label: 'Connections',
            current: usage?.connections.current,
            limit: sub.effectiveLimits.connections,
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
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-1.5 font-mono text-xl tabular-nums">
                {limit === -1
                  ? '∞'
                  : limit === 0
                    ? '—'
                    : current !== undefined
                      ? `${current}/${limit}`
                      : limit}
              </p>
              {limit > 0 && current !== undefined && (
                <div className="mt-3 h-[3px] bg-secondary rounded-full overflow-hidden">
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
        <div className="card p-4 border-warning/40">
          <p className="text-sm text-foreground">{t('settings.billing.stripeNotConfigured')}</p>
        </div>
      )}

      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        {(['FREE', 'PRO', 'ENTERPRISE'] as const).map((planKey) => {
          const planInfo = PLAN_FEATURES[planKey]
          const isCurrent = sub.plan === planKey
          const isPro = planKey === 'PRO'

          return (
            <div key={planKey} className="flex flex-col bg-card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-base font-semibold">{planInfo.name}</h4>
                {isCurrent ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                    {t('settings.billing.currentPlanBtn')}
                  </span>
                ) : isPro ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-primary">
                    {t('settings.billing.mostPopular')}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="font-serif text-4xl leading-none">{PLAN_PRICES[planKey]}</span>
                <span className="text-sm text-muted-foreground">
                  {t('settings.billing.perMonth')}
                </span>
              </p>

              <ul className="mt-5 mb-6 flex-1 space-y-2">
                {planInfo.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
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
                  className={`w-full text-sm flex items-center justify-center gap-1.5 ${isPro ? 'btn-primary' : 'btn-secondary'}`}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 animate-fadeIn">
          <div className="relative bg-card border border-border shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] rounded-lg p-6 w-full max-w-md animate-fadeIn">
            <h3 className="text-lg font-semibold">Cancel your subscription?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your subscription will be cancelled but you keep full access until{' '}
              <span className="font-semibold text-foreground">{fmt(sub.currentPeriodEnd)}</span>. No
              charges after that date.
            </p>
            <div className="mt-4 p-3 rounded-md border border-border text-xs text-muted-foreground space-y-1">
              <p>• Access continues until end of billing period</p>
              <p>• No refund for the current period</p>
              <p>• You can re-subscribe anytime</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary flex-1">
                Keep my plan
              </button>
              <button onClick={confirmCancel} className="btn-destructive flex-1">
                Cancel subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
