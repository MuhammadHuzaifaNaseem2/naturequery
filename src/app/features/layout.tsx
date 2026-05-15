import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Features | NatureQuery — AI-Powered Natural Language to SQL',
  description:
    'Explore NatureQuery features: natural language to SQL, 6+ database types, CSV/Excel export, conversational queries, Magic CSV Upload, Chain-of-Thought reasoning, and team collaboration.',
  keywords: [
    'natural language to SQL features',
    'AI database query tool',
    'text to SQL platform',
    'NatureQuery features',
    'SQL generator features',
  ],
  openGraph: {
    title: 'NatureQuery Features — Everything You Need to Query Your Database',
    description:
      'AI-powered SQL generation, 6 database types, CSV export, conversational queries, and more. No SQL knowledge required.',
    url: 'https://naturequery.app/features',
  },
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children
}
