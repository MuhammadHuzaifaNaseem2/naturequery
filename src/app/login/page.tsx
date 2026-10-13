'use client'

import { Suspense, useState, useRef } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft } from 'lucide-react'
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
import { preFlightCheck } from '@/actions/auth'
import { requestEmailVerification } from '@/actions/auth-email'
import { safeCallbackUrl } from '@/lib/safe-redirect'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

const SIGN_IN_TIMEOUT = 20000
const SIGN_IN_TIMEOUT_MESSAGE = 'Sign-in is taking too long. Check your connection and try again.'

function withSignInTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(SIGN_IN_TIMEOUT_MESSAGE)), SIGN_IN_TIMEOUT)
    }),
  ]).finally(() => clearTimeout(timer))
}

const EMPTY_CODE = ['', '', '', '', '', '']

function LoginForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const oauthProviders = useOAuthProviders()
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'))
  const { data: session, status } = useSession()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  // 2FA challenge state
  const [show2FA, setShow2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState(EMPTY_CODE)
  const [savedCredentials, setSavedCredentials] = useState<LoginFormData | null>(null)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    let navigating = false

    try {
      // Step 1: Pre-flight check — validate credentials & detect 2FA before calling NextAuth
      // NextAuth v5 (Auth.js) swallows error strings so we can't rely on result.error for 2FA detection
      const preflight = await withSignInTimeout(preFlightCheck(data.email, data.password))

      if (preflight.error) {
        setError(preflight.error)
        if (preflight.error.toLowerCase().includes('verify your email')) {
          setUnverifiedEmail(data.email)
          setResendState('idle')
        } else {
          setUnverifiedEmail(null)
        }
        return
      }

      if (preflight.requires2FA) {
        // Don't call signIn yet — just show the 2FA input form
        setSavedCredentials(data)
        setShow2FA(true)
        setError(null)
        return
      }

      // Step 2: No 2FA, proceed with full NextAuth sign-in
      const result = await withSignInTimeout(
        signIn('credentials', {
          email: data.email,
          password: data.password,
          redirect: false,
          callbackUrl,
        })
      )

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        navigating = true
        window.location.href = result?.url || callbackUrl
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message === SIGN_IN_TIMEOUT_MESSAGE
          ? err.message
          : 'An error occurred. Please try again.'
      )
    } finally {
      // Keep the spinner while the browser moves on, instead of flashing the
      // "already signed in" panel for a moment.
      if (!navigating) setIsLoading(false)
    }
  }

  const handle2FASubmit = async () => {
    if (!savedCredentials) return

    const code = useBackupCode ? backupCode.trim() : twoFactorCode.join('')
    if (!useBackupCode && code.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }
    if (useBackupCode && !code) {
      setError('Please enter a backup code')
      return
    }

    setIsLoading(true)
    setError(null)
    let navigating = false

    try {
      const result = await withSignInTimeout(
        signIn('credentials', {
          email: savedCredentials.email,
          password: savedCredentials.password,
          twoFactorCode: code,
          redirect: false,
          callbackUrl,
        })
      )

      if (result?.error) {
        setError('That code did not work. Please try again.')
        setTwoFactorCode(EMPTY_CODE)
        codeInputsRef.current[0]?.focus()
      } else {
        navigating = true
        window.location.href = result?.url || callbackUrl
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message === SIGN_IN_TIMEOUT_MESSAGE
          ? err.message
          : 'An error occurred. Please try again.'
      )
    } finally {
      if (!navigating) setIsLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '')
    if (value && !digits) return

    // A pasted or auto-filled code arrives all at once: spread it across the boxes.
    if (digits.length > 1) {
      const next = [...twoFactorCode]
      for (let i = 0; i < digits.length && index + i < 6; i++) next[index + i] = digits[i]
      setTwoFactorCode(next)
      codeInputsRef.current[Math.min(index + digits.length, 5)]?.focus()
      return
    }

    const next = [...twoFactorCode]
    next[index] = digits.slice(-1)
    setTwoFactorCode(next)
    if (digits && index < 5) {
      codeInputsRef.current[index + 1]?.focus()
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      handle2FASubmit()
    }
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendState !== 'idle') return
    setResendState('sending')
    try {
      await requestEmailVerification(unverifiedEmail)
      setResendState('sent')
    } catch {
      setResendState('idle')
      setError('Could not resend verification email. Please try again in a moment.')
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    setError(null)
    try {
      await withSignInTimeout(signIn(provider, { callbackUrl }))
    } catch (err) {
      setError(
        err instanceof Error && err.message === SIGN_IN_TIMEOUT_MESSAGE
          ? err.message
          : 'Could not start sign-in. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Already signed in, for example after opening the site from a search: offer to
  // continue instead of asking for the password again.
  if (status === 'authenticated' && !isLoading && !show2FA) {
    return (
      <div className="animate-fadeIn">
        <AuthHeading eyebrow={t('auth.login.eyebrow')} title={t('auth.login.signedInTitle')}>
          {session?.user?.email ? t('auth.login.signedInAs', { email: session.user.email }) : null}
        </AuthHeading>
        <div className="mt-8 space-y-3">
          <a href={callbackUrl} className="mk-btn mk-btn-primary w-full">
            {t('auth.login.continue')}
          </a>
          <button
            type="button"
            onClick={() => signOut({ redirect: false })}
            className="mk-btn w-full text-mk-ink-2 hover:text-mk-ink"
          >
            {t('auth.login.useAnotherAccount')}
          </button>
        </div>
      </div>
    )
  }

  // Two-step verification
  if (show2FA) {
    return (
      <div className="animate-fadeIn">
        <AuthHeading
          eyebrow={t('auth.login.twoFactorEyebrow')}
          title={t('auth.login.twoFactorTitle')}
        >
          {useBackupCode ? t('auth.login.backupHelp') : t('auth.login.twoFactorHelp')}
        </AuthHeading>

        <div className="mt-8 space-y-5">
          {error && <AuthAlert>{error}</AuthAlert>}

          {useBackupCode ? (
            <div>
              <label htmlFor="backup-code" className={authLabel}>
                {t('auth.login.backupCode')}
              </label>
              <input
                id="backup-code"
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handle2FASubmit()}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="one-time-code"
                className={clsx(authInput, 'font-nq-mono tracking-[0.12em]')}
                autoFocus
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="flex gap-2" role="group" aria-label={t('auth.login.twoFactorTitle')}>
              {twoFactorCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    codeInputsRef.current[index] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1}`}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  className="h-14 w-full min-w-0 rounded-md border border-mk-rule bg-mk-surface text-center font-nq-mono text-2xl text-mk-ink transition-colors focus:border-mk-violet focus:outline-none focus:ring-[3px] focus:ring-mk-violet/15 disabled:opacity-60"
                  autoFocus={index === 0}
                  disabled={isLoading}
                />
              ))}
            </div>
          )}

          <button
            onClick={handle2FASubmit}
            disabled={isLoading}
            className="mk-btn mk-btn-primary w-full disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('auth.login.signingIn')}
              </>
            ) : (
              t('auth.login.verify')
            )}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => {
                setShow2FA(false)
                setSavedCredentials(null)
                setError(null)
                setTwoFactorCode(EMPTY_CODE)
                setBackupCode('')
                setUseBackupCode(false)
              }}
              className="inline-flex items-center gap-1 text-mk-ink-3 transition-colors hover:text-mk-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t('common.back')}
            </button>
            <button
              onClick={() => {
                setUseBackupCode(!useBackupCode)
                setError(null)
              }}
              className="mk-link"
            >
              {useBackupCode ? t('auth.login.useApp') : t('auth.login.useBackup')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasOAuth = oauthProviders.google || oauthProviders.github

  return (
    <div className="animate-fadeIn">
      <AuthHeading eyebrow={t('auth.login.eyebrow')} title={t('auth.login.title')}>
        {t('auth.login.subtitle')}
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

        {error && (
          <AuthAlert>
            <p>{error}</p>
            {unverifiedEmail && (
              <div className="mt-1.5">
                {resendState === 'sent' ? (
                  <p className="text-mk-ink-2">
                    Verification email sent. Check your inbox and your spam folder.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendState === 'sending'}
                    className="mk-link disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
          </AuthAlert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className={authLabel}>
              {t('auth.login.email')}
            </label>
            <input
              {...register('email')}
              id="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder={t('auth.login.emailPlaceholder')}
              className={authInput}
              disabled={isLoading}
              aria-invalid={errors.email ? true : undefined}
              suppressHydrationWarning
            />
            {errors.email && <p className={authFieldError}>{errors.email.message}</p>}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="password" className="text-sm font-medium text-mk-ink">
                {t('auth.login.password')}
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-mk-ink-3 transition-colors hover:text-mk-ink"
              >
                {t('auth.login.forgotPassword')}
              </Link>
            </div>
            <PasswordInput
              {...register('password')}
              id="password"
              autoComplete="current-password"
              disabled={isLoading}
              aria-invalid={errors.password ? true : undefined}
              suppressHydrationWarning
            />
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
                {t('auth.login.signingIn')}
              </>
            ) : (
              t('auth.login.submit')
            )}
          </button>
        </form>

        <p className="text-sm text-mk-ink-2">
          {t('auth.login.noAccount')}{' '}
          {/* New accounts continue where sign-in was going, for example NatureQuery Desktop. */}
          <Link
            href={
              callbackUrl === '/dashboard'
                ? '/register'
                : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
            }
            className="mk-link"
          >
            {t('auth.login.signUp')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="h-80" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  )
}
