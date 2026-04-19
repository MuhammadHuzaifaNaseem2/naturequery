'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import { ArrowLeft, Mail, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { requestPasswordReset } from '@/actions/auth-email'
import { useTranslation } from '@/contexts/LocaleContext'

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <AppLogo size="lg" />
          </Link>
          <h1 className="text-2xl font-bold">{t('auth.forgotPassword.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t('auth.forgotPassword.pageSubtitle')}
          </p>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-2">{t('auth.forgotPassword.checkEmail')}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('auth.forgotPassword.accountExists', { email })}
            </p>

            {/* Dev fallback: email sending failed, show direct link so dev can still test */}
            {!emailConfigured && devUrl && (
              <div className="mb-4 p-3 rounded-lg bg-secondary border border-border text-left">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Email not delivered — use this link to reset:
                </div>
                <a
                  href={devUrl}
                  className="text-xs text-primary hover:underline break-all font-mono"
                >
                  {devUrl}
                </a>
              </div>
            )}

            <Link href="/login" className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('auth.forgotPassword.backToSignIn')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                {t('auth.forgotPassword.emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.login.emailPlaceholder')}
                  className="w-full px-4 py-3 pl-11 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all hover:border-border/80"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full flex items-center justify-center gap-2"
              suppressHydrationWarning
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('auth.forgotPassword.submit')
              )}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('auth.forgotPassword.backToSignIn')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}





