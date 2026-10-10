import { useState } from 'react'
import { ExternalLink, LogIn, ShieldCheck } from 'lucide-react'
import { Logo } from '../../components/brand'
import { Button, Input, Spinner } from '../../components/ui'
import { api, asAppError } from '../../lib/nq'
import { startSignIn } from '../../store/assistant'
import { useApp } from '../../store/app-store'

const STEPS = [
  'A sign-in page opened in your browser.',
  'Sign in or create a free account, then choose Allow.',
  'Your browser brings you back here.',
]

/**
 * The first screen. Everything in NatureQuery belongs to a signed-in account,
 * so the workspace only opens after signing in, and signing out comes back here.
 */
export function SignInScreen() {
  const auth = useApp((state) => state.auth)
  const version = useApp((state) => state.info?.version)
  const pending = auth.status === 'pending'
  const notice = auth.status === 'signed-out' ? auth.error : undefined
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setCodeError(null)
    try {
      await api.auth.submitCode(code)
    } catch (caught) {
      const appError = asAppError(caught)
      setCodeError([appError.message, appError.hint].filter(Boolean).join(' '))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto bg-background px-6">
      <div className="m-auto w-full max-w-[420px] py-10">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-12" />
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Welcome to NatureQuery</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground [text-wrap:balance]">
            Sign in to connect your databases and ask questions in plain English.
          </p>
        </div>

        <div className="mt-7 rounded-xl border border-border bg-card p-5 shadow-sm">
          {notice && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-border bg-secondary/60 px-3 py-2 text-[12.5px] leading-relaxed"
            >
              {notice}
            </p>
          )}

          {!pending ? (
            <>
              <Button
                variant="primary"
                className="h-9 w-full justify-center text-[13.5px]"
                icon={<LogIn className="h-4 w-4" />}
                onClick={() => void startSignIn()}
              >
                Sign in with your browser
              </Button>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
                No account yet? You can create a free one on the sign-in page.
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-[13px] font-medium">
                <Spinner className="h-3.5 w-3.5 text-primary" /> Waiting for your browser…
              </p>
              <ol className="space-y-2 text-[13px] leading-relaxed">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={() => void startSignIn()}
                >
                  Open the sign-in page again
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void api.auth.cancel()}>
                  Cancel
                </Button>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-[12.5px] font-medium">Did the browser not bring you back?</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  After choosing Allow, copy the code shown on the page and paste it here.
                </p>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                  }}
                >
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="nqd_code_..."
                    aria-label="Sign-in code"
                    className="flex-1 font-mono text-[12px]"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                    disabled={!code.trim()}
                  >
                    Continue
                  </Button>
                </form>
                {codeError && <p className="text-[12px] text-destructive">{codeError}</p>}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Queries run directly from this computer, and your data stays here. AI questions send
            only your question and the structure of your tables (names, columns, types and
            approximate sizes).
          </span>
        </p>
        {version && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground/70">Version {version}</p>
        )}
      </div>
    </main>
  )
}
