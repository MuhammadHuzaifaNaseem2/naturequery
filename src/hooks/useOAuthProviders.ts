'use client'

// Reads NEXT_PUBLIC_ env vars synchronously — no network fetch, no delay.
// Values are baked in at build time (or at dev-server start after restart).

export function useOAuthProviders() {
  return {
    google: process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true',
    github: process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true',
  }
}
