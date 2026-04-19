import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create a free NatureQuery account and start querying your databases with natural language.',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
