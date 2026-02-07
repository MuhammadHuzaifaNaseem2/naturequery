'use client'

import { useState } from 'react'
import { User, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { clsx } from 'clsx'

interface ProfileSettingsProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
  }
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const { theme, setTheme } = useTheme()
  const [name] = useState(user.name || '')

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            {user.image ? (
              <img src={user.image} alt={name} className="w-14 h-14 rounded-full" />
            ) : (
              <User className="w-6 h-6 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{name || 'User'}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium capitalize">
              {(user.role || 'analyst').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Theme Selector */}
      <div className="card p-5">
        <h4 className="font-medium mb-3">Appearance</h4>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={clsx(
                'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                theme === value
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Account Info */}
      <div className="card p-5">
        <h4 className="font-medium mb-3">Account</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{(user.role || 'analyst').toLowerCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
