'use client'

import { brandFonts } from '@/app/fonts'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Check, Copy, Laptop, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { approveDesktopSignIn } from './actions'

interface Props {
  valid: boolean
  challenge: string
  state: string
  deviceName: string | null
  account: { email: string; name: string | null }
}

type Step =
  | { kind: 'confirm' }
  | { kind: 'working' }
  | { kind: 'approved'; code: string }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }

function openApp(params: Record<string, string>) {
  window.location.href = `naturequery://auth?${new URLSearchParams(params).toString()}`
}

function initials(name: string | null, email: string): string {
  const source = (name || email).trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

export function AuthorizeDesktop({ valid, challenge, state, deviceName, account }: Props) {
  const [step, setStep] = useState<Step>(
    valid
      ? { kind: 'confirm' }
      : {
          kind: 'error',
          message:
            'This sign-in link is not valid or is incomplete. Start signing in again from NatureQuery Desktop.',
        }
  )
  const [copied, setCopied] = useState(false)

  async function allow() {
    setStep({ kind: 'working' })
    try {
      const result = await approveDesktopSignIn(challenge, deviceName ?? undefined)
      if (!result.ok) {
        setStep({ kind: 'error', message: result.error })
        return
      }
      setStep({ kind: 'approved', code: result.code })
      openApp({ code: result.code, state })
    } catch {
      setStep({
        kind: 'error',
        message: 'Something went wrong. Check your connection and try again.',
      })
    }
  }

  function deny() {
    setStep({ kind: 'denied' })
    openApp({ error: 'access_denied', state })
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function switchAccount() {
    const back = `/desktop/authorize?${new URLSearchParams({
      challenge,
      state,
      ...(deviceName ? { device: deviceName } : {}),
    }).toString()}`
    await signOut({ callbackUrl: `/login?callbackUrl=${encodeURIComponent(back)}` })
  }

  return (
    <main className={`mk ${brandFonts} min-h-screen flex items-center justify-center px-4 py-12`}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AppLogo size="lg" />
        </div>

        <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-7">
          {(step.kind === 'confirm' || step.kind === 'working') && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Laptop className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">
                    Sign in to NatureQuery Desktop
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {deviceName ? `On ${deviceName}` : 'On this computer'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 mb-5">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                  {initials(account.name, account.email)}
                </div>
                <div className="min-w-0 flex-1">
                  {account.name && <p className="text-sm font-medium truncate">{account.name}</p>}
                  <p className="text-sm text-muted-foreground truncate">{account.email}</p>
                </div>
                <button
                  type="button"
                  onClick={switchAccount}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Not you?
                </button>
              </div>

              <p className="text-sm font-medium mb-2">NatureQuery Desktop will be able to:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-5 list-disc pl-5">
                <li>Use AI to write, fix and explain queries (questions count toward your plan)</li>
                <li>See your name, email address and plan</li>
              </ul>
              <p className="flex gap-2 text-sm text-muted-foreground mb-6">
                <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" aria-hidden />
                Your database passwords and query results stay on your computer.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={deny}
                  disabled={step.kind === 'working'}
                  className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={allow}
                  disabled={step.kind === 'working'}
                  className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {step.kind === 'working' && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Allow
                </button>
              </div>
            </>
          )}

          {step.kind === 'approved' && (
            <>
              <div className="h-11 w-11 rounded-full bg-success/10 text-success flex items-center justify-center mb-4">
                <Check className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-lg font-semibold mb-1">You are signed in</h1>
              <p className="text-sm text-muted-foreground mb-5">
                Return to NatureQuery Desktop. You can close this tab.
              </p>
              <button
                type="button"
                onClick={() => openApp({ code: step.code, state })}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 mb-5"
              >
                Open NatureQuery Desktop
              </button>
              <p className="text-sm font-medium mb-2">
                If the app did not open, copy this code into it:
              </p>
              <div className="flex gap-2 mb-3">
                <code className="flex-1 min-w-0 truncate rounded-lg border border-border bg-muted px-3 py-2 text-xs">
                  {step.code}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(step.code)}
                  className="h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted inline-flex items-center gap-1.5"
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                The code works once, for 5 minutes. Only paste it into NatureQuery Desktop on your
                own computer. NatureQuery will never ask you for it.
              </p>
            </>
          )}

          {step.kind === 'denied' && (
            <>
              <h1 className="text-lg font-semibold mb-1">Sign-in canceled</h1>
              <p className="text-sm text-muted-foreground">
                NatureQuery Desktop was not signed in. You can close this tab.
              </p>
            </>
          )}

          {step.kind === 'error' && (
            <>
              <div className="h-11 w-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                <XCircle className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-lg font-semibold mb-1">Could not sign in</h1>
              <p className="text-sm text-muted-foreground">{step.message}</p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
