'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { useTranslation } from '@/contexts/LocaleContext'
import { AuthLayout } from '@/components/AuthLayout'
import {
  AuthAlert,
  AuthDivider,
  AuthHeading,
  OAuthButtons,
  PasswordInput,
  authFieldError,
  authInput,
  authLabel,
} from '@/components/auth/AuthParts'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { safeCallbackUrl } from '@/lib/safe-redirect'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
})

type RegisterFormData = z.infer<typeof registerSchema>

function RegisterForm() {
  const { t } = useTranslation()
  const oauthProviders = useOAuthProviders()
  // Where to continue after signing up, for example NatureQuery Desktop's sign-in.
  const requested = useSearchParams().get('callbackUrl')
  const callbackUrl = requested ? safeCallbackUrl(requested) : null
  const signInHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : '/login'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const password = watch('password')

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, callbackUrl: callbackUrl ?? undefined }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Registration failed')
        return
      }

      // Show the server's message, which says whether to check the inbox.
      setSuccessMessage(result.message)
      setSuccess(true)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    await signIn(provider, { callbackUrl: callbackUrl ?? '/onboarding' })
  }

  // Password strength: one point each for length, upper, lower, digit and symbol.
  const strength = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  })()
  const strengthLabel =
    strength <= 2
      ? t('auth.register.strengthWeak')
      : strength === 3
        ? t('auth.register.strengthFair')
        : strength === 4
          ? t('auth.register.strengthGood')
          : t('auth.register.strengthStrong')
  const strengthColor =
    strength <= 2
      ? 'bg-destructive'
      : strength === 3
        ? 'bg-warning'
        : strength === 4
          ? 'bg-mk-violet'
          : 'bg-success'

  // After signing up: what happens next, instead of the form.
  if (success) {
    const autoVerified = successMessage?.includes('auto-verified')
    return (
      <div className="animate-fadeIn">
        <AuthHeading
          eyebrow={t('auth.register.eyebrow')}
          title={autoVerified ? t('auth.register.readyTitle') : t('auth.register.checkInbox')}
        >
          {successMessage || t('auth.register.successMessage')}
        </AuthHeading>
        <Link
          href={signInHref}
          className={clsx('mt-8', autoVerified ? 'mk-btn mk-btn-primary' : 'mk-btn mk-btn-quiet')}
        >
          {t('auth.register.goToSignIn')}
        </Link>
      </div>
    )
  }

  const hasOAuth = oauthProviders.google || oauthProviders.github

  return (
    <div className="animate-fadeIn">
      <AuthHeading eyebrow={t('auth.register.eyebrow')} title={t('auth.register.title')}>
        {t('auth.register.subtitle')}
      </AuthHeading>

      <div className="mt-8 space-y-6">
        {hasOAuth && (
          <>
            <OAuthButtons
              google={oauthProviders.google}
              github={oauthProviders.github}
              disabled={isLoading}
              onSelect={handleOAuthSignIn}
              label={(provider) => t('auth.login.continueWith', { provider })}
            />
            <AuthDivider label={t('auth.login.orEmail')} />
          </>
        )}

        {error && <AuthAlert>{error}</AuthAlert>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className={authLabel}>
              {t('auth.register.fullName')}
            </label>
            <input
              {...register('name')}
              id="name"
              type="text"
              autoComplete="name"
              placeholder={t('auth.register.namePlaceholder')}
              className={authInput}
              disabled={isLoading}
              aria-invalid={errors.name ? true : undefined}
              suppressHydrationWarning
            />
            {errors.name && <p className={authFieldError}>{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className={authLabel}>
              {t('auth.login.email')}
            </label>
            <input
              {...register('email')}
              id="email"
              type="text"
              inputMode="email"
              autoComplete="email"
              placeholder={t('auth.login.emailPlaceholder')}
              className={authInput}
              disabled={isLoading}
              aria-invalid={errors.email ? true : undefined}
              suppressHydrationWarning
            />
            {errors.email && <p className={authFieldError}>{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className={authLabel}>
              {t('auth.login.password')}
            </label>
            <PasswordInput
              {...register('password')}
              id="password"
              autoComplete="new-password"
              disabled={isLoading}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={password ? 'password-strength' : undefined}
              suppressHydrationWarning
            />
            {password && (
              <div id="password-strength" className="mt-2.5 flex items-center gap-3">
                <div className="flex flex-1 gap-1" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={clsx(
                        'h-[3px] flex-1 rounded-full transition-colors',
                        n <= strength ? strengthColor : 'bg-mk-rule'
                      )}
                    />
                  ))}
                </div>
                <span className="font-nq-mono text-[0.7rem] text-mk-ink-3">
                  {t('auth.register.strength')}: {strengthLabel}
                </span>
              </div>
            )}
            {errors.password && <p className={authFieldError}>{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mk-btn mk-btn-primary !mt-6 w-full disabled:opacity-70"
            suppressHydrationWarning
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('auth.register.creating')}
              </>
            ) : (
              t('auth.register.submit')
            )}
          </button>
        </form>

        <p className="text-sm text-mk-ink-2">
          {t('auth.register.hasAccount')}{' '}
          <Link href={signInHref} className="mk-link">
            {t('auth.register.signIn')}
          </Link>
        </p>

        <p className="text-xs leading-relaxed text-mk-ink-3">
          {t('auth.register.terms')}{' '}
          <Link
            href="/terms"
            className="underline decoration-mk-rule underline-offset-2 hover:text-mk-ink"
          >
            {t('auth.register.termsLink')}
          </Link>{' '}
          {t('auth.register.and')}{' '}
          <Link
            href="/privacy"
            className="underline decoration-mk-rule underline-offset-2 hover:text-mk-ink"
          >
            {t('auth.register.privacyLink')}
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  )
}
