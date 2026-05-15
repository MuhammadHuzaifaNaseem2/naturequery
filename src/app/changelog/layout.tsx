import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Changelog | NatureQuery — What\'s New',
  description:
    'See the latest updates, new features, and improvements to NatureQuery. We ship fast and keep you informed.',
  openGraph: {
    title: 'NatureQuery Changelog — Latest Updates and Features',
    description: 'Track every update, bug fix, and new feature shipped to NatureQuery.',
    url: 'https://naturequery.app/changelog',
  },
}

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children
}
