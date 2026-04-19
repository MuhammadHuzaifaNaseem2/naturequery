import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Query your databases using natural language with NatureQuery.',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
