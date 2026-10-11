'use client'

import Link from 'next/link'
import { brandFonts } from '@/app/fonts'
import { AppLogo } from '@/components/AppLogo'

interface AuthLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

/**
 * Sign-in and sign-up pages: the form on paper, and beside it (on wide
 * screens) a real question and answer from the sample store.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={`mk ${brandFonts} flex min-h-screen`}>
      <aside className="relative hidden flex-col justify-between bg-mk-band p-12 text-mk-band-ink lg:flex lg:w-[46%] xl:p-16">
        <Link href="/" aria-label="NatureQuery home" className="inline-flex">
          <AppLogo size="sm" textClassName="font-semibold tracking-tight text-mk-band-ink" />
        </Link>

        <figure className="max-w-md">
          <p className="font-nq-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-mk-band-ink-2">
            You ask
          </p>
          <blockquote className="mt-3 font-nq-serif text-[2.1rem] italic leading-[1.15] tracking-[-0.015em]">
            &ldquo;Which 5 customers spent the most this year?&rdquo;
          </blockquote>
          <p className="mt-8 font-nq-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-mk-band-ink-2">
            NatureQuery answers
          </p>
          <table className="mt-3 w-full text-left text-[0.9375rem]">
            <caption className="sr-only">Top customers in the sample store</caption>
            <tbody>
              {[
                ['Lucia Lopez', '17,647.20'],
                ['Lucia Kowalski', '14,454.90'],
                ['Ruby Muller', '13,912.20'],
              ].map(([name, spent], index) => (
                <tr key={name} className="border-t border-mk-band-rule">
                  <td className="py-2.5">{name}</td>
                  <td className="py-2.5 text-right font-nq-mono text-[0.85rem] tabular-nums">
                    {index === 0 ? <span className="mk-highlight">${spent}</span> : `$${spent}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="mt-4 text-sm text-mk-band-ink-2">
            From NatureQuery&apos;s sample store, with read-only SQL written for you.
          </figcaption>
        </figure>

        <p className="font-nq-mono text-[0.72rem] uppercase tracking-[0.08em] text-mk-band-ink-2">
          Read-only queries &middot; AES-256-GCM encrypted credentials
        </p>
      </aside>

      <main className="flex w-full items-center justify-center px-5 py-12 sm:px-8 lg:w-[54%]">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="NatureQuery home" className="mb-10 inline-flex lg:hidden">
            <AppLogo size="sm" textClassName="font-semibold tracking-tight" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}
