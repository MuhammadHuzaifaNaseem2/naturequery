'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

/** Sign-in links for visitors, and one link to the dashboard for people already signed in. */
export function HeaderAccountLinks() {
  const { status } = useSession()
  if (status === 'authenticated') {
    return (
      <Link href="/dashboard" className="mk-btn mk-btn-sm mk-btn-primary">
        Open dashboard
      </Link>
    )
  }
  return (
    <>
      <Link
        href="/login"
        className="mk-btn mk-btn-sm hidden text-mk-ink-2 hover:text-mk-ink sm:inline-flex"
      >
        Sign in
      </Link>
      <Link href="/register" className="mk-btn mk-btn-sm mk-btn-primary">
        Start free
      </Link>
    </>
  )
}

/** The last link in the phone menu: Sign in, or Open dashboard when signed in. */
export function MenuAccountLink({ className }: { className: string }) {
  const { status } = useSession()
  return status === 'authenticated' ? (
    <Link href="/dashboard" className={className}>
      Open dashboard
    </Link>
  ) : (
    <Link href="/login" className={className}>
      Sign in
    </Link>
  )
}
