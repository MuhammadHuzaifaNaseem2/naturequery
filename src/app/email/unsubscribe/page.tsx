import Link from 'next/link'
import type { Metadata } from 'next'
import { AppLogo } from '@/components/AppLogo'
import { readWeeklySummaryUnsubscribeToken } from '@/lib/email-unsubscribe'

export const metadata: Metadata = {
  title: 'Weekly summary email',
  robots: { index: false, follow: false },
}

interface UnsubscribePageProps {
  searchParams: Promise<{ t?: string; done?: string }>
}

/** Where "Stop weekly summaries" in the email leads. Works without signing in. */
export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { t = '', done } = await searchParams
  const valid = !!readWeeklySummaryUnsubscribeToken(t)

  return (
    <div className="mk min-h-screen">
      <header className="border-b border-mk-rule">
        <div className="mx-auto flex max-w-5xl items-center px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="NatureQuery home">
            <AppLogo size="sm" textClassName="text-[15px] font-semibold tracking-[-0.01em]" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="mk-label">Weekly summary email</p>

        {!valid ? (
          <>
            <h1 className="mt-4 max-w-2xl text-balance font-nq-serif text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
              This link doesn&apos;t work.
            </h1>
            <p className="mt-4 max-w-xl leading-relaxed text-mk-ink-2">
              It may have been copied only in part. Sign in and turn the weekly summary off on the
              Settings page instead.
            </p>
            <Link href="/settings" className="mk-btn mk-btn-primary mt-8 inline-flex">
              Open Settings
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="mt-4 max-w-2xl text-balance font-nq-serif text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
              You won&apos;t get weekly summaries anymore.
            </h1>
            <p className="mt-4 max-w-xl leading-relaxed text-mk-ink-2">
              Your summaries still appear on the Insights page in NatureQuery. Changed your mind?
              Turn the email back on in Settings.
            </p>
            <Link href="/settings" className="mk-btn mk-btn-quiet mt-8 inline-flex">
              Open Settings
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-4 max-w-2xl text-balance font-nq-serif text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
              Stop the weekly summary email?
            </h1>
            <p className="mt-4 max-w-xl leading-relaxed text-mk-ink-2">
              You&apos;ll stop getting the Monday email. Your summaries still appear on the Insights
              page, and you can turn the email back on in Settings.
            </p>
            <form
              method="post"
              action={`/api/email/unsubscribe?t=${encodeURIComponent(t)}`}
              className="mt-8"
            >
              <input type="hidden" name="from" value="page" />
              <button type="submit" className="mk-btn mk-btn-primary">
                Stop weekly summaries
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
