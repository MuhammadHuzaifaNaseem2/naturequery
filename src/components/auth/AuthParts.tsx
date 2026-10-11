'use client'

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'

/** One field style for every sign-in, sign-up and password screen. */
export const authInput =
  'h-11 w-full rounded-md border border-mk-rule bg-mk-surface px-3.5 text-[0.9375rem] text-mk-ink placeholder:text-mk-ink-3/80 transition-colors hover:border-mk-ink-3/60 focus:border-mk-violet focus:outline-none focus:ring-[3px] focus:ring-mk-violet/15 disabled:opacity-60'

export const authLabel = 'mb-1.5 block text-sm font-medium text-mk-ink'

export const authFieldError = 'mt-1.5 text-sm text-destructive'

/** The opening of each screen: what this step is, in mono; what to do, in serif. */
export function AuthHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  return (
    <div>
      <p className="mk-label">{eyebrow}</p>
      <h1 className="mt-3 text-balance font-nq-serif text-[clamp(2.1rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.02em] text-mk-ink">
        {title}
      </h1>
      {children && (
        <div className="mt-3 text-[0.9375rem] leading-relaxed text-mk-ink-2">{children}</div>
      )}
    </div>
  )
}

/** Problems get a red edge; everything else stays neutral. */
export function AuthAlert({
  children,
  tone = 'error',
}: {
  children: ReactNode
  tone?: 'error' | 'note'
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx(
        'flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm text-mk-ink',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/[0.06]'
          : 'border-mk-rule bg-mk-surface'
      )}
    >
      {tone === 'error' && (
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 font-nq-mono text-[0.7rem] uppercase tracking-[0.08em] text-mk-ink-3">
      <span className="h-px flex-1 bg-mk-rule" aria-hidden />
      {label}
      <span className="h-px flex-1 bg-mk-rule" aria-hidden />
    </div>
  )
}

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <input
          ref={ref}
          {...props}
          type={visible ? 'text' : 'password'}
          className={clsx(authInput, 'pr-11', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-2 text-mk-ink-3 transition-colors hover:text-mk-ink"
          suppressHydrationWarning
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

/** Google and GitHub, when they are configured. Renders nothing otherwise. */
export function OAuthButtons({
  google,
  github,
  disabled,
  onSelect,
  label,
}: {
  google: boolean
  github: boolean
  disabled?: boolean
  onSelect: (provider: 'google' | 'github') => void
  /** "Continue with Google" in the reader's language. */
  label: (provider: string) => string
}) {
  if (!google && !github) return null
  return (
    <div className="grid gap-2.5">
      {google && (
        <button
          type="button"
          onClick={() => onSelect('google')}
          disabled={disabled}
          className="mk-btn mk-btn-quiet w-full gap-2.5 disabled:opacity-60"
        >
          <GoogleMark />
          {label('Google')}
        </button>
      )}
      {github && (
        <button
          type="button"
          onClick={() => onSelect('github')}
          disabled={disabled}
          className="mk-btn mk-btn-quiet w-full gap-2.5 disabled:opacity-60"
        >
          <GitHubMark />
          {label('GitHub')}
        </button>
      )}
    </div>
  )
}
