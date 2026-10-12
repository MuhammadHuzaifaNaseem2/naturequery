'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { getWeeklySummaryEmail, setWeeklySummaryEmail } from '@/actions/email-preferences'

/** The Monday summary email switch. The switch shows the result, so success doesn't toast. */
export function EmailSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [included, setIncluded] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWeeklySummaryEmail()
      .then((res) => {
        if (!res.success) return
        setEnabled(!!res.enabled)
        setIncluded(!!res.included)
      })
      .catch(() => {})
  }, [])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const previous = enabled
    setEnabled(next)
    try {
      const res = await setWeeklySummaryEmail(next)
      if (!res.success) throw new Error(res.error)
    } catch {
      setEnabled(previous)
      toast.error('Could not change the weekly summary email. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const loading = enabled === null

  return (
    <div className="card p-5" id="weekly-summary">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="font-medium">Weekly summary email</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Every Monday: how many questions you asked, your busiest connections and a short summary
            of the week.{' '}
            {included
              ? 'Your summaries also appear on the Insights page.'
              : 'Summaries come with the Pro and Enterprise plans.'}
          </p>
        </div>
        <label
          className={clsx(
            'relative mt-0.5 inline-flex shrink-0 items-center',
            loading || saving ? 'cursor-wait opacity-60' : 'cursor-pointer'
          )}
        >
          <input
            id="weekly-summary-email"
            type="checkbox"
            className="peer sr-only"
            checked={!!enabled}
            disabled={loading || saving}
            onChange={(e) => toggle(e.target.checked)}
            aria-label="Weekly summary email"
          />
          <div className="h-6 w-11 rounded-full bg-muted transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring/60"></div>
        </label>
      </div>
    </div>
  )
}
