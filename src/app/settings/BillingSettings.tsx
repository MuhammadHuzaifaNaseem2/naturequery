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
} from 'lucide-react'
import {
  getUserSubscription,
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
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

interface UsageData {
  queries: { current: number; limit: number }
  connections: { current: number; limit: number }
  teamMembers: { current: number; limit: number }
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
        const { url } = await createCheckoutSession(plan)
        if (url) window.location.href = url
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleManageBilling() {
    startTransition(async () => {
      try {
        setError(null)
        const { url } = await createBillingPortalSession()
        if (url) window.location.href = url
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleCancel() {
    setShowCancelModal(true)
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
      <div className="flex items-center justify-center py-12">
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings.billing.title')} &amp; {t('common.settings')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.billing.subtitle')}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Current Plan */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t('settings.billing.currentPlan')}</h3>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {sub.planName}
              </span>
              {sub.cancelAtPeriodEnd && (
                <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-semibold">
                  {t('settings.billing.cancelsAtPeriodEnd')}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {sub.status === 'TRIALING' && sub.trialEndsAt
                ? (() => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil(
                        (new Date(sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      )
                    )
                    return `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${new Date(sub.trialEndsAt).toLocaleDateString()}). Upgrade to keep PRO features.`
                  })()
                : isFreePlan
                  ? t('settings.billing.freeForever')
                  : sub.currentPeriodEnd
                    ? t('settings.billing.renews', {
                        date: new Date(sub.currentPeriodEnd).toLocaleDateString(),
                      })
                    : t('settings.billing.activeSubscription')}
            </p>
          </div>
          {isPaidPlan && sub.stripeEnabled && (
            <button
              onClick={handleManageBilling}
              disabled={isPending}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5" />
              )}
              {t('settings.billing.manageBilling')}
            </button>
          )}
        </div>

        {/* Plan usage & limits */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t('settings.billing.queriesPerMonth')}
            </p>
            <p className="text-xl font-bold stat-number">
              {sub.limits.queriesPerMonth === -1
                ? '∞'
                : usage
                  ? `${usage.queries.current}/${sub.limits.queriesPerMonth}`
                  : sub.limits.queriesPerMonth}
            </p>
            {usage && sub.limits.queriesPerMonth !== -1 && (
              <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.queries.current / sub.limits.queriesPerMonth > 0.9
                      ? 'bg-destructive'
                      : usage.queries.current / sub.limits.queriesPerMonth > 0.7
                        ? 'bg-warning'
                        : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.queries.current / sub.limits.queriesPerMonth) * 100)}%`,
                  }}
                />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">this calendar month</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t('settings.billing.connections')}
            </p>
            <p className="text-xl font-bold stat-number">
              {sub.limits.connections === -1
                ? '∞'
                : usage
                  ? `${usage.connections.current}/${sub.limits.connections}`
                  : sub.limits.connections}
            </p>
            {usage && sub.limits.connections !== -1 && (
              <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.connections.current / sub.limits.connections >= 1
                      ? 'bg-destructive'
                      : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.connections.current / sub.limits.connections) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t('settings.billing.teamMembers')}
            </p>
            <p className="text-xl font-bold stat-number">
              {sub.limits.teamMembers === -1
                ? '∞'
                : sub.limits.teamMembers === 0
                  ? '—'
                  : usage
                    ? `${usage.teamMembers.current}/${sub.limits.teamMembers}`
                    : sub.limits.teamMembers}
            </p>
            {usage && sub.limits.teamMembers > 0 && (
              <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.teamMembers.current / sub.limits.teamMembers >= 1
                      ? 'bg-destructive'
                      : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.teamMembers.current / sub.limits.teamMembers) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Cards */}
      {!sub.stripeEnabled && (
        <div className="card p-4 bg-warning/5 border-warning/20">
          <p className="text-sm text-warning font-medium">
            {t('settings.billing.stripeNotConfigured')}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 stagger-children">
        {(['FREE', 'PRO', 'ENTERPRISE'] as const).map((planKey) => {
          const planInfo = PLAN_FEATURES[planKey]
          const Icon = planInfo.icon
          const isCurrent = sub.plan === planKey
          const isPro = planKey === 'PRO'
          const isEnterprise = planKey === 'ENTERPRISE'
          const prices = { FREE: '$0', PRO: '$29', ENTERPRISE: '$99' }

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
              {/* Popular badge for PRO */}
              {isPro && !isCurrent && (
                <span className="badge-popular">{t('settings.billing.mostPopular')}</span>
              )}

              {/* Plan header */}
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
                    <span className="amount">{prices[planKey]}</span>
                    <span className="period">{t('settings.billing.perMonth')}</span>
                  </div>
                </div>
              </div>

              {/* Features list */}
              <ul className="feature-list flex-1 mb-5">
                {planInfo.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground">
                    <Check className="check-icon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              {isCurrent ? (
                <button className="btn-secondary w-full text-sm opacity-60 cursor-default" disabled>
                  {t('settings.billing.currentPlanBtn')}
                </button>
              ) : planKey === 'FREE' ? (
                isPaidPlan && !sub.cancelAtPeriodEnd ? (
                  <button
                    onClick={handleCancel}
                    disabled={isPending || !sub.stripeEnabled}
                    className="btn-secondary w-full text-sm text-destructive hover:bg-destructive/10"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                    ) : (
                      t('settings.billing.downgrade')
                    )}
                  </button>
                ) : null
              ) : (
                <button
                  onClick={() => handleUpgrade(planKey as 'PRO' | 'ENTERPRISE')}
                  disabled={isPending || !sub.stripeEnabled}
                  className={`w-full text-sm flex items-center justify-center gap-1.5 ${
                    isPro ? 'btn-gradient' : 'btn-primary'
                  }`}
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

      {/* Cancel Confirm Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-card border border-border shadow-2xl rounded-2xl p-6 w-full max-w-md animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold">Cancel Subscription</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Are you sure you want to cancel? You will retain access until the end of your billing
              period.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmCancel}
                className="btn-primary flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              >
                Yes, Cancel
              </button>
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary flex-1">
                No, Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
