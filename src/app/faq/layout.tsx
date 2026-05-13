import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ | NatureQuery',
  description:
    'Frequently asked questions about NatureQuery — databases, billing, security, and more.',
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children
}
