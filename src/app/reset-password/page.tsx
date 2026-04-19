'use client'

import { useState, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { resetPassword } from '@/actions/auth-email'
import { useTranslation } from '@/contexts/LocaleContext'

function ResetPasswordForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8 || password.length > 128) {
      setError('Password must be between 8 and 128 characters')
      return
    }
    const cats = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length
    if (cats < 3) {
      setError('Password must contain at least 3 of: uppercase, lowercase, number, special character')
      return
    }

    startTransition(async () => {
      try {
        setError('')
        await resetPassword(token, password)
        setSuccess(true)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
      }
    })
  }

  if (!token) {
    return (
      <div className="card p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="font-semibold text-lg mb-2">{t('auth.resetPassword.invalidLink')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t('auth.resetPassword.invalidLinkMessage')}
        </p>
        <Link href="/forgot-password" className="btn-primary text-sm">
          {t('auth.resetPassword.requestNewLink')}
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="card p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
        <h2 className="font-semibold text-lg mb-2">{t('auth.resetPassword.passwordUpdated')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t('auth.resetPassword.passwordUpdatedMessage')}
        </p>
        <Link href="/login" className="btn-primary text-sm">
          {t('common.signIn')}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1.5">
          {t('auth.resetPassword.password')}
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.resetPassword.atLeast8')}
            className="input w-full pr-10"
            suppressHydrationWarning
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            suppressHydrationWarning
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium mb-1.5">
          {t('auth.resetPassword.confirmPassword')}
        </label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('auth.resetPassword.confirmPlaceholder')}
            className="input w-full pr-10"
            suppressHydrationWarning
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            suppressHydrationWarning
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full flex items-center justify-center gap-2"
        suppressHydrationWarning
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.resetPassword.submit')}
      </button>
    </form>
  )
}

function ResetPasswordPageContent() {
  const { t } = useTranslation()

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <AppLogo size="lg" />
        </Link>
        <h1 className="text-2xl font-bold">{t('auth.resetPassword.pageTitle')}</h1>
      </div>
      <Suspense fallback={<div className="card p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <ResetPasswordPageContent />
    </div>
  )
}


