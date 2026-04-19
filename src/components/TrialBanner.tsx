'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getUserSubscription, createCheckoutSession } from '@/actions/billing'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/contexts/LocaleContext'

export function TrialBanner() {
  const router = useRouter()
  const { t } = useTranslation()
  const [trialInfo, setTrialInfo] = useState<{
    isTrialing: boolean
    daysLeft: number
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('trial-banner-dismissed')) {
      setDismissed(true)
      return
    }
    getUserSubscription().then((sub) => {
      if (sub.status === 'TRIALING' && sub.trialEndsAt) {
        const msLeft = new Date(sub.trialEndsAt).getTime() - Date.now()
        const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
        setTrialInfo({ isTrialing: true, daysLeft })
      }
    })
  }, [])

  if (!trialInfo?.isTrialing || dismissed) return null

  const isUrgent = trialInfo.daysLeft <= 2

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const result = await createCheckoutSession('PRO')
      if (result.url) window.location.href = result.url
    } catch {
      router.push('/settings?tab=billing')
    }
    setUpgrading(false)
  }

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('trial-banner-dismissed', '1')
  }

  return (
    <div className={`h-8 flex items-center justify-center text-[11px] tracking-wide ${
      isUrgent
        ? 'bg-amber-500 text-black'
        : 'bg-primary text-primary-foreground'
    }`}>
      <span className="font-medium">
        {trialInfo.daysLeft === 0
          ? t('settings.billing.trialEndsToday')
          : trialInfo.daysLeft === 1
          ? t('settings.billing.trialDaysRemaining', { days: trialInfo.daysLeft })
          : t('settings.billing.trialDaysRemainingPlural', { days: trialInfo.daysLeft })}
      </span>
      <button
        onClick={handleUpgrade}
        disabled={upgrading}
        className={`ml-2 px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider transition-opacity ${
          isUrgent
            ? 'bg-black/20 hover:bg-black/30'
            : 'bg-white/20 hover:bg-white/30'
        }`}
      >
        {upgrading ? '...' : t('settings.billing.upgrade')}
      </button>
      <button
        onClick={handleDismiss}
        className="absolute right-3 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
