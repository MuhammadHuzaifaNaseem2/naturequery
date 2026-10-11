'use client'

import Link from 'next/link'
import { brandFonts } from '@/app/fonts'
import { AppLogo } from '@/components/AppLogo'

interface AuthLayoutProps {
  children: React.ReactNode
}

// The same example as the home page: a real question, the SQL NatureQuery wrote
// for it and the answer, from the built-in sample store.
const QUESTION = 'Which 5 customers spent the most this year?'
const SQL = `SELECT c.name, SUM(o.total_amount) AS total_spent
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status IN ('completed', 'shipped')
  AND o.order_date >= '2026-01-01'
GROUP BY c.id, c.name
ORDER BY total_spent DESC
LIMIT 5;`
const ROWS = [
  ['Lucia Lopez', '17,647.20'],
  ['Lucia Kowalski', '14,454.90'],
  ['Ruby Muller', '13,912.20'],
]
const KEYWORDS = new Set([
  'SELECT',
  'SUM',
  'AS',
  'FROM',
  'JOIN',
  'ON',
  'WHERE',
  'IN',
  'AND',
  'GROUP',
  'BY',
  'ORDER',
  'DESC',
  'LIMIT',
])

/** Keywords in light violet and values in marigold; the panel is dark in every theme. */
function highlight(sql: string) {
  return sql.split(/('[^']*'|\b[A-Z]+\b)/g).map((part, index) => {
    if (part.startsWith("'")) {
      return (
        <span key={index} className="text-[hsl(40_92%_70%)]">
          {part}
        </span>
      )
    }
    if (KEYWORDS.has(part)) {
      return (
        <span key={index} className="text-[hsl(252_90%_82%)]">
          {part}
        </span>
      )
    }
    return part
  })
}

function StepNode({ answer = false }: { answer?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        answer
          ? 'absolute left-0 top-0.5 h-[15px] w-[15px] rounded-full bg-mk-signal'
          : 'absolute left-0 top-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-mk-band-ink-2/70 bg-mk-band dark:bg-mk-surface'
      }
    >
      {!answer && <span className="h-[5px] w-[5px] rounded-full bg-mk-band-ink" />}
    </span>
  )
}

const step =
  'font-nq-mono text-[0.68rem] font-medium uppercase tracking-[0.08em] text-mk-band-ink-2'

/**
 * Sign-in, sign-up and password screens: the form on paper, and beside it
 * (on wide screens) how one question becomes an answer.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className={`mk ${brandFonts} min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]`}
    >
      {/* The form */}
      <div className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
        <header>
          <Link href="/" aria-label="NatureQuery home" className="inline-flex">
            <AppLogo size="sm" textClassName="text-[15px] font-semibold tracking-[-0.01em]" />
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[23.5rem]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-nq-mono text-[0.7rem] text-mk-ink-3">
          <span>&copy; {new Date().getFullYear()} NatureQuery</span>
          <nav className="flex gap-4" aria-label="Legal">
            <Link href="/privacy" className="hover:text-mk-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-mk-ink">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-mk-ink">
              Help
            </Link>
          </nav>
        </footer>
      </div>

      {/* How a question becomes an answer */}
      <aside className="relative hidden flex-col justify-between bg-mk-band px-12 py-12 text-mk-band-ink dark:border-l dark:border-mk-rule dark:bg-mk-surface lg:flex xl:px-16">
        <p className={step}>From the sample store</p>

        <ol className="relative max-w-[31rem] space-y-9">
          <span
            aria-hidden
            className="absolute bottom-3 left-[7px] top-3 w-px bg-mk-band-rule dark:bg-mk-rule"
          />
          <li className="relative pl-9">
            <StepNode />
            <p className={step}>01 You ask</p>
            <p className="mt-3 font-nq-serif text-[clamp(1.5rem,2.2vw,1.95rem)] italic leading-[1.18] tracking-[-0.01em]">
              &ldquo;{QUESTION}&rdquo;
            </p>
          </li>
          <li className="relative pl-9">
            <StepNode />
            <p className={step}>02 NatureQuery writes</p>
            <pre className="mt-3 overflow-x-auto font-nq-mono text-[0.74rem] leading-[1.7] text-mk-band-ink [font-variant-ligatures:none]">
              {highlight(SQL)}
            </pre>
            <p className="mt-2 text-[0.8rem] text-mk-band-ink-2">
              Read-only, checked before it runs
            </p>
          </li>
          <li className="relative pl-9">
            <StepNode answer />
            <p className={step}>03 The answer</p>
            <table className="mt-2 w-full text-left text-[0.9rem]">
              <caption className="sr-only">Top customers in the sample store</caption>
              <tbody>
                {ROWS.map(([name, spent], index) => (
                  <tr key={name} className="border-b border-mk-band-rule dark:border-mk-rule">
                    <td className="py-2.5">{name}</td>
                    <td className="py-2.5 text-right font-nq-mono text-[0.82rem] tabular-nums">
                      {index === 0 ? <span className="mk-highlight">${spent}</span> : `$${spent}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        </ol>

        <p className={step}>Read-only queries &middot; AES-256-GCM encrypted credentials</p>
      </aside>
    </div>
  )
}
