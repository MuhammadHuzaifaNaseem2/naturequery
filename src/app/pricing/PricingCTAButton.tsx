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
      if (url) window.location.assign(url)
    } catch {
      // Not signed in or billing not configured: send them to sign up first.
      window.location.href = fallbackHref
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`mk-btn w-full disabled:opacity-70 ${highlighted ? 'mk-btn-primary' : 'mk-btn-quiet'}`}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {label}
    </button>
  )
}
