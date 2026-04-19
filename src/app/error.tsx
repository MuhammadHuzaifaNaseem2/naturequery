'use client'

import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
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
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center text-center max-w-md p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('pages.error.title')}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {error.message || t('pages.error.description')}
        </p>
        <div className="flex gap-3">
          <button onClick={reset} className="btn-primary">
            <RefreshCw className="w-4 h-4" />
            {t('common.tryAgain')}
          </button>
          <a href="/" className="btn-secondary">
            <Home className="w-4 h-4" />
            {t('common.goHome')}
          </a>
        </div>
      </div>
    </div>
  )
}
