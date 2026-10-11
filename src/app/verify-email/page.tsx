'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { verifyEmail } from '@/actions/auth-email'
import { useTranslation } from '@/contexts/LocaleContext'
import { safeCallbackUrl } from '@/lib/safe-redirect'
import { AuthLayout } from '@/components/AuthLayout'
import { AuthHeading } from '@/components/auth/AuthParts'

function VerifyEmailContent() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  // Set when the account was created from NatureQuery Desktop's sign-in.
  const next = safeCallbackUrl(searchParams.get('next'))
  const toDesktop = next.startsWith('/desktop/authorize')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError(t('auth.verifyEmail.noToken'))
      return
    }

    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setError(err.message || t('auth.verifyEmail.failed'))
      })
  }, [token])

  if (status === 'loading') {
    return (
      <div className="animate-fadeIn" role="status">
        <AuthHeading
          eyebrow={t('auth.verifyEmail.eyebrow')}
          title={t('auth.verifyEmail.checking')}
        />
        <Loader2 className="mt-8 h-5 w-5 animate-spin text-mk-ink-3" aria-hidden />
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="animate-fadeIn">
        <AuthHeading eyebrow={t('auth.verifyEmail.eyebrow')} title={t('auth.verifyEmail.verified')}>
          {t('auth.verifyEmail.verifiedMessage')}
        </AuthHeading>
        <Link href={next} className="mk-btn mk-btn-primary mt-8">
          {toDesktop
            ? t('auth.verifyEmail.continueToDesktop')
            : t('auth.verifyEmail.goToDashboard')}
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <AuthHeading eyebrow={t('auth.verifyEmail.eyebrow')} title={t('auth.verifyEmail.failed')}>
        {error}
      </AuthHeading>
      <Link href="/login" className="mk-btn mk-btn-quiet mt-8">
        {t('auth.forgotPassword.backToSignIn')}
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="h-56" aria-hidden />}>
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  )
}
