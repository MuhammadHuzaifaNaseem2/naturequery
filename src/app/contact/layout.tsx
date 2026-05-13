import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us | NatureQuery',
  description:
    'Get in touch with the NatureQuery team for support, sales, or partnership inquiries.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
