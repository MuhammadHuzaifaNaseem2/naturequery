import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your NatureQuery account settings, billing, and team.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
