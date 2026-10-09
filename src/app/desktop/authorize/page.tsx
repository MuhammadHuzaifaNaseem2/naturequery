import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { cleanDeviceName, isValidCodeChallenge } from '@/lib/desktop/tokens'
import { AuthorizeDesktop } from './AuthorizeDesktop'

export const metadata: Metadata = {
  title: 'Sign in to NatureQuery Desktop',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function single(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Opened by NatureQuery Desktop in the user's browser. The signed-in user
 * approves the app, which then receives a one-time code.
 */
export default async function DesktopAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const challenge = single(params.challenge)
  const state = single(params.state)
  const device = cleanDeviceName(single(params.device))

  const session = await auth()
  if (!session?.user?.id) {
    const query = new URLSearchParams({ challenge, state, ...(device ? { device } : {}) })
    const back = `/desktop/authorize?${query.toString()}`
    redirect(`/login?callbackUrl=${encodeURIComponent(back)}`)
  }

  const valid = isValidCodeChallenge(challenge) && /^[A-Za-z0-9_-]{16,128}$/.test(state)
  return (
    <AuthorizeDesktop
      valid={valid}
      challenge={challenge}
      state={state}
      deviceName={device}
      account={{ email: session.user.email ?? '', name: session.user.name ?? null }}
    />
  )
}
