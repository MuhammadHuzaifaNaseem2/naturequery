'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { syncSubscriptionFromLS, syncBySubscriptionId } from '@/actions/billing'
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
import type { DesktopSessionView } from './security/DesktopSessions'

type SettingsTab = 'profile' | 'billing' | 'teams' | 'api-keys' | 'audit' | 'security' | 'language'

interface SettingsClientProps {
  initialTwoFactorEnabled: boolean
  desktopSessions: DesktopSessionView[]
}

export default function SettingsClient({
  initialTwoFactorEnabled,
  desktopSessions,
}: SettingsClientProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // After Lemon Squeezy checkout, sync the subscription immediately.
  // LS appends subscription_id to the redirect URL — use it directly if present,
  // otherwise fall back to email-based discovery.
  useEffect(() => {
    const tab = searchParams.get('tab')
    const status = searchParams.get('status')
    const subscriptionId = searchParams.get('subscription_id')
    if (tab === 'billing') {
      setActiveTab('billing')
      if (status === 'success') {
        if (subscriptionId) {
          syncBySubscriptionId(subscriptionId).catch(() => syncSubscriptionFromLS())
        } else {
          syncSubscriptionFromLS()
        }
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
      <header className="border-b border-border bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            {t('dashboard.title')}
          </button>
          <span className="text-muted-foreground/50" aria-hidden>
            /
          </span>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {t('settings.title')}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col lg:flex-row gap-6 lg:gap-12">
        {/* Sidebar Navigation — horizontal scroll on mobile, vertical on desktop */}
        <nav className="lg:w-48 lg:flex-shrink-0" aria-label={t('settings.title')}>
          <div className="flex lg:block gap-1 lg:gap-0 lg:space-y-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 lg:overflow-visible pb-2 lg:pb-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-2 lg:gap-2.5 px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap flex-shrink-0 lg:w-full',
                  activeTab === id
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                <Icon className="w-4 h-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <h1 className="mb-6 font-serif text-[2rem] font-normal leading-tight tracking-[-0.015em]">
            {TABS.find((tab) => tab.id === activeTab)?.label}
          </h1>
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
            <SecurityClient
              initialTwoFactorEnabled={initialTwoFactorEnabled}
              desktopSessions={desktopSessions}
              embedded
            />
          )}
          {activeTab === 'language' && (
            <div className="bg-card border border-border rounded-lg p-6">
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
