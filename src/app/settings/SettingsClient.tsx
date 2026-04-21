'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { syncSubscriptionFromStripe } from '@/actions/billing'
import { ArrowLeft, User, Users, Key, ScrollText, CreditCard, Shield, Globe } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from '@/contexts/LocaleContext'
import { ProfileSettings } from './ProfileSettings'
import { TeamSettings } from './TeamSettings'
import { ApiKeySettings } from './ApiKeySettings'
import { AuditLogViewer } from './AuditLogViewer'
import { BillingSettings } from './BillingSettings'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import SecurityClient from './security/SecurityClient'

type SettingsTab = 'profile' | 'billing' | 'teams' | 'api-keys' | 'audit' | 'security' | 'language'

interface SettingsClientProps {
  initialTwoFactorEnabled: boolean
}

export default function SettingsClient({ initialTwoFactorEnabled }: SettingsClientProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // After Stripe checkout redirect, sync subscription state immediately
  // so the user sees their new plan without waiting for the webhook.
  useEffect(() => {
    const tab = searchParams.get('tab')
    const status = searchParams.get('status')
    if (tab === 'billing') {
      setActiveTab('billing')
      if (status === 'success') {
        syncSubscriptionFromStripe()
      }
    }
  }, [searchParams])

  const TABS = [
    { id: 'profile' as const, label: t('settings.profile.title'), icon: User },
    { id: 'security' as const, label: t('settings.security.title'), icon: Shield },
    { id: 'language' as const, label: t('settings.language.title'), icon: Globe },
    { id: 'billing' as const, label: t('settings.billing.title'), icon: CreditCard },
    { id: 'teams' as const, label: t('settings.team.title'), icon: Users },
    { id: 'api-keys' as const, label: t('settings.apiKeys.title'), icon: Key },
    { id: 'audit' as const, label: 'Audit Log', icon: ScrollText },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
            title={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{t('settings.title')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Manage your account, teams, and API access
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Sidebar Navigation — horizontal scroll on mobile, vertical on desktop */}
        <nav className="lg:w-48 lg:flex-shrink-0">
          <div className="flex lg:block gap-1 lg:gap-0 lg:space-y-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 lg:overflow-visible pb-2 lg:pb-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={clsx(
                  'flex items-center gap-2 lg:gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 lg:w-full',
                  activeTab === id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && session?.user && (
            <ProfileSettings
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
                role: (session.user as any).role,
              }}
            />
          )}
          {activeTab === 'teams' && session?.user?.id && <TeamSettings userId={session.user.id} />}
          {activeTab === 'security' && (
            <SecurityClient initialTwoFactorEnabled={initialTwoFactorEnabled} />
          )}
          {activeTab === 'language' && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">{t('settings.language.title')}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t('settings.language.selectLanguage')}
              </p>
              <LanguageSwitcher />
            </div>
          )}
          {activeTab === 'billing' && <BillingSettings />}
          {activeTab === 'api-keys' && <ApiKeySettings />}
          {activeTab === 'audit' && <AuditLogViewer />}
        </div>
      </div>
    </div>
  )
}
