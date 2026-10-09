'use client'

import { useState } from 'react'
import { Laptop, Loader2 } from 'lucide-react'
import { revokeMyDesktopSession } from '@/actions/desktop-sessions'

export interface DesktopSessionView {
  id: string
  deviceName: string | null
  platform: string | null
  appVersion: string | null
  lastUsedAt: string
}

const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }

function lastActive(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 10) return 'Active now'
  if (minutes < 60) return `Active ${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Active ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `Active ${days} day${days === 1 ? '' : 's'} ago`
}

/** Computers signed in to NatureQuery Desktop, with a way to sign each out. */
export function DesktopSessions({ initial }: { initial: DesktopSessionView[] }) {
  const [sessions, setSessions] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function signOut(id: string) {
    setBusy(id)
    setError(null)
    try {
      const result = await revokeMyDesktopSession(id)
      if (result.ok) setSessions((current) => current.filter((session) => session.id !== id))
      else setError('That computer could not be signed out. Refresh the page and try again.')
    } catch {
      setError('That computer could not be signed out. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Laptop className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <div className="flex-1 w-full min-w-0">
          <h2 className="text-lg sm:text-xl font-bold mb-1">NatureQuery Desktop</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Computers where you are signed in to the desktop app. Sign out any you do not recognize.
          </p>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not signed in to NatureQuery Desktop on any computer.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {session.deviceName || 'Unnamed computer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        session.platform ? (PLATFORMS[session.platform] ?? session.platform) : null,
                        session.appVersion ? `Version ${session.appVersion}` : null,
                        lastActive(session.lastUsedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut(session.id)}
                    disabled={busy !== null}
                    className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {busy === session.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Sign out
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )
}
