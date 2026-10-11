'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { brandFonts } from '@/app/fonts'
import { useTranslation } from '@/contexts/LocaleContext'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={`mk ${brandFonts} flex min-h-screen items-center`}>
      <div className="mx-auto w-full max-w-[1200px] px-5 py-24 sm:px-8">
        <p className="mk-label text-mk-signal-ink">Error</p>
        <h1 className="mt-5 max-w-3xl text-balance font-nq-serif text-[clamp(2.4rem,5vw,4.2rem)] font-normal leading-[1.04] tracking-[-0.025em] text-mk-ink">
          {t('pages.error.title')}
        </h1>
        <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-mk-ink-2">
          {error.message || t('pages.error.description')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="mk-btn mk-btn-primary">
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t('common.tryAgain')}
          </button>
          <Link href="/" className="mk-btn mk-btn-quiet">
            {t('common.goHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
