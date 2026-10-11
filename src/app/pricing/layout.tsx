import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NatureQuery Pricing: Free Plan Available',
  description:
    'NatureQuery pricing plans: Free (50 queries/month), Pro ($20/month), and Enterprise. Start free, no credit card required. Upgrade anytime.',
  keywords: [
    'NatureQuery pricing',
    'AI SQL tool pricing',
    'natural language to SQL pricing',
    'database query tool cost',
    'free SQL generator',
  ],
  openGraph: {
    title: 'NatureQuery Pricing: Start Free, Upgrade When Ready',
    description:
      'Free plan with 50 AI questions a month. Pro at $20 a month covers a team of five. Enterprise for larger teams. No credit card required to start.',
    url: 'https://naturequery.app/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
