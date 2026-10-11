'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { brandFonts } from '@/app/fonts'
import { AppLogo } from '@/components/AppLogo'
import { useTranslation } from '@/contexts/LocaleContext'

export default function NotFound() {
  const { t } = useTranslation()
  const pathname = usePathname() || '/'
  return (
    <div className={`mk ${brandFonts} flex min-h-screen flex-col`}>
      <header className="mx-auto w-full max-w-[1200px] px-5 py-6 sm:px-8">
        <Link href="/" aria-label="NatureQuery home" className="inline-flex">
          <AppLogo size="sm" textClassName="font-semibold tracking-tight" />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-5 pb-24 sm:px-8">
        <p className="mk-label">404</p>
        <h1 className="mt-5 max-w-3xl text-balance font-nq-serif text-[clamp(2.6rem,6vw,5rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          {t('pages.notFound.title')}
        </h1>
        <pre className="mt-8 max-w-full overflow-x-auto rounded-lg border border-mk-rule bg-mk-surface px-5 py-4 font-nq-mono text-[0.85rem] leading-relaxed text-mk-ink [font-variant-ligatures:none]">
          <code>
            <span className="text-mk-violet">SELECT</span> *{' '}
            <span className="text-mk-violet">FROM</span> pages{' '}
            <span className="text-mk-violet">WHERE</span> path ={' '}
            <span className="text-mk-signal-ink">&apos;{pathname}&apos;</span>;{'\n'}
            <span className="text-mk-ink-3">-- 0 rows</span>
          </code>
        </pre>
        <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-mk-ink-2">
          {t('pages.notFound.description')}
        </p>
        <Link href="/" className="mk-btn mk-btn-primary mt-8 self-start">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('pages.notFound.backToDashboard')}
        </Link>
      </main>
    </div>
  )
}
