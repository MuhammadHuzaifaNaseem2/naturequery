import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Started',
  description: 'Set up your NatureQuery account and connect your first database.',
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
