'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Users, Key, ScrollText } from 'lucide-react'
import { clsx } from 'clsx'
import { ProfileSettings } from './ProfileSettings'
import { TeamSettings } from './TeamSettings'
import { ApiKeySettings } from './ApiKeySettings'
import { AuditLogViewer } from './AuditLogViewer'

type SettingsTab = 'profile' | 'teams' | 'api-keys' | 'audit'

const TABS = [
  { id: 'profile' as const, label: 'Profile', icon: User },
  { id: 'teams' as const, label: 'Teams', icon: Users },
  { id: 'api-keys' as const, label: 'API Keys', icon: Key },
  { id: 'audit' as const, label: 'Audit Log', icon: ScrollText },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account, teams, and API access</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-48 flex-shrink-0">
          <div className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
          {activeTab === 'teams' && session?.user?.id && (
            <TeamSettings userId={session.user.id} />
          )}
          {activeTab === 'api-keys' && <ApiKeySettings />}
          {activeTab === 'audit' && <AuditLogViewer />}
        </div>
      </div>
    </div>
  )
}
