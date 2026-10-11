'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { requestPasswordReset } from '@/actions/auth-email'
import { useTranslation } from '@/contexts/LocaleContext'
import { AuthLayout } from '@/components/AuthLayout'
import { AuthAlert, AuthHeading, authInput, authLabel } from '@/components/auth/AuthParts'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [devUrl, setDevUrl] = useState<string | null>(null)
  const [emailConfigured, setEmailConfigured] = useState(true)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    startTransition(async () => {
      try {
        setError('')
        const result = await requestPasswordReset(email)
        setSent(true)
        setEmailConfigured(result.emailConfigured)
        setDevUrl(result.devUrl ?? null)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
      }
    })
  }

  return (
    <AuthLayout>
      {sent ? (
        <div className="animate-fadeIn">
          <AuthHeading
            eyebrow={t('auth.forgotPassword.eyebrow')}
            title={t('auth.forgotPassword.checkEmail')}
          >
            {t('auth.forgotPassword.accountExists', { email })}
          </AuthHeading>

          {/* Dev fallback: email sending failed, show direct link so dev can still test */}
          {!emailConfigured && devUrl && (
            <div className="mt-6">
              <AuthAlert tone="note">
                <p className="text-mk-ink-2">{t('auth.forgotPassword.devFallback')}</p>
                <a href={devUrl} className="mk-link mt-1 block break-all font-nq-mono text-xs">
                  {devUrl}
                </a>
              </AuthAlert>
            </div>
          )}

          <Link href="/login" className="mk-btn mk-btn-quiet mt-8">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </div>
      ) : (
        <div className="animate-fadeIn">
          <AuthHeading
            eyebrow={t('auth.forgotPassword.eyebrow')}
            title={t('auth.forgotPassword.pageTitle')}
          >
            {t('auth.forgotPassword.pageSubtitle')}
          </AuthHeading>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && <AuthAlert>{error}</AuthAlert>}

            <div>
              <label htmlFor="email" className={authLabel}>
                {t('auth.forgotPassword.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                className={authInput}
                suppressHydrationWarning
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mk-btn mk-btn-primary !mt-6 w-full disabled:opacity-70"
              suppressHydrationWarning
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-label={t('common.loading')} />
              ) : (
                t('auth.forgotPassword.submit')
              )}
            </button>
          </form>

          <p className="mt-6 text-sm">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-mk-ink-3 transition-colors hover:text-mk-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t('auth.forgotPassword.backToSignIn')}
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  )
}
