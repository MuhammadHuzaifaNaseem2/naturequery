'use client'

import { useState, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { resetPassword } from '@/actions/auth-email'
import { useTranslation } from '@/contexts/LocaleContext'
import { AuthLayout } from '@/components/AuthLayout'
import { AuthAlert, AuthHeading, PasswordInput, authLabel } from '@/components/auth/AuthParts'

function ResetPasswordForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    const cats = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
    if (cats < 3) {
      setError(
        'Password must contain at least 3 of: uppercase, lowercase, number, special character'
      )
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
      <div className="animate-fadeIn">
        <AuthHeading
          eyebrow={t('auth.resetPassword.eyebrow')}
          title={t('auth.resetPassword.invalidLink')}
        >
          {t('auth.resetPassword.invalidLinkMessage')}
        </AuthHeading>
        <Link href="/forgot-password" className="mk-btn mk-btn-primary mt-8">
          {t('auth.resetPassword.requestNewLink')}
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="animate-fadeIn">
        <AuthHeading
          eyebrow={t('auth.resetPassword.eyebrow')}
          title={t('auth.resetPassword.passwordUpdated')}
        >
          {t('auth.resetPassword.passwordUpdatedMessage')}
        </AuthHeading>
        <Link href="/login" className="mk-btn mk-btn-primary mt-8">
          {t('auth.login.submit')}
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <AuthHeading
        eyebrow={t('auth.resetPassword.eyebrow')}
        title={t('auth.resetPassword.pageTitle')}
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && <AuthAlert>{error}</AuthAlert>}

        <div>
          <label htmlFor="password" className={authLabel}>
            {t('auth.resetPassword.password')}
          </label>
          <PasswordInput
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.resetPassword.atLeast8')}
            suppressHydrationWarning
          />
        </div>

        <div>
          <label htmlFor="confirm" className={authLabel}>
            {t('auth.resetPassword.confirmPassword')}
          </label>
          <PasswordInput
            id="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('auth.resetPassword.confirmPlaceholder')}
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
            t('auth.resetPassword.submit')
          )}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="h-72" aria-hidden />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  )
}
