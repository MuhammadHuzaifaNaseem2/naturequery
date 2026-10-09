'use client'

import { useSyncExternalStore } from 'react'
import { isNatureQueryDesktop } from '@/lib/desktop-bridge'

// The preload bridge is fixed for the document lifetime. Match server HTML during hydration.
const subscribe = () => () => {}
const getServerSnapshot = () => false

export function useOAuthProviders() {
  const isDesktop = useSyncExternalStore(subscribe, isNatureQueryDesktop, getServerSnapshot)
  return {
    isDesktop,
    // Browser OAuth cannot hand its session back to the desktop app yet.
    google: !isDesktop && process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true',
    github: !isDesktop && process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true',
  }
}
