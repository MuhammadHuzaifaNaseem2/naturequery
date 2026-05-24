'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createCheckoutSession } from '@/actions/billing'

interface Props {
  planKey: 'PRO' | 'ENTERPRISE' | null
  fallbackHref: string
  label: string
  highlighted: boolean
}

export function PricingCTAButton({ planKey, fallbackHref, label, highlighted }: Props) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (!planKey) {
      window.location.href = fallbackHref
      return
    }
    setIsLoading(true)
    try {
      const { url } = await createCheckoutSession(planKey)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // Not logged in or Stripe not configured — send to register
      window.location.href = fallbackHref
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${
        highlighted ? 'btn-primary shadow-lg' : 'btn-secondary'
      }`}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </button>
  )
}
