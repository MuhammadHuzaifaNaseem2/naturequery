'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { verifyEmail } from '@/actions/auth-email'
import { useTranslation } from '@/contexts/LocaleContext'

function VerifyEmailContent() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
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
      <div className="card p-8 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
        <h2 className="font-semibold text-lg mb-2">{t('auth.verifyEmail.verified')}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('auth.verifyEmail.verifiedMessage')}
        </p>
        <Link href="/dashboard" className="btn-primary text-sm">
          {t('auth.verifyEmail.goToDashboard')}
        </Link>
      </div>
    )
  }

  return (
    <div className="card p-8 text-center">
      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <h2 className="font-semibold text-lg mb-2">{t('auth.verifyEmail.failed')}</h2>
      <p className="text-sm text-muted-foreground mb-6">{error}</p>
      <Link href="/login" className="btn-primary text-sm">
        {t('auth.forgotPassword.backToSignIn')}
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <AppLogo size="lg" />
          </Link>
        </div>
        <Suspense fallback={<div className="card p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  )
}


