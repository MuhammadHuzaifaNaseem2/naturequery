import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your email address for your NatureQuery account.',
}

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children
}
