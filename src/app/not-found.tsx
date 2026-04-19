'use client'

import { FileQuestion, Home } from 'lucide-react'
import { useTranslation } from '@/contexts/LocaleContext'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center text-center max-w-md p-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <FileQuestion className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('pages.notFound.title')}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t('pages.notFound.description')}
        </p>
        <a href="/" className="btn-primary">
          <Home className="w-4 h-4" />
          {t('pages.notFound.backToDashboard')}
        </a>
      </div>
    </div>
  )
}
