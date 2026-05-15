import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | NatureQuery — Our Mission',
  description:
    'NatureQuery is on a mission to make database querying accessible to everyone. Learn about our story, values, and the team building the future of AI-powered data access.',
  openGraph: {
    title: 'About NatureQuery — Making Data Accessible to Everyone',
    description:
      'We believe everyone should be able to ask questions of their data without knowing SQL. Learn about NatureQuery and our mission.',
    url: 'https://naturequery.app/about',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
