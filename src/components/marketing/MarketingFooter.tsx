import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/download', label: 'Download for Windows' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/docs/api', label: 'API' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/security', label: 'Security' },
    ],
  },
]

/** The public site's footer. */
export function MarketingFooter() {
  return (
    <footer className="border-t border-mk-rule">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Link href="/" aria-label="NatureQuery home" className="inline-flex">
            <AppLogo size="sm" textClassName="font-semibold tracking-tight" />
          </Link>
          <p className="mt-4 font-nq-serif text-lg italic leading-snug text-mk-ink-2">
            Plain-English questions, real SQL answers.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="mk-label">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[0.9375rem] text-mk-ink-2 transition-colors hover:text-mk-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-mk-rule">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-mk-ink-3 sm:px-8">
          <span>&copy; {new Date().getFullYear()} NatureQuery</span>
          <a href="mailto:hello@naturequery.app" className="hover:text-mk-ink">
            hello@naturequery.app
          </a>
        </div>
      </div>
    </footer>
  )
}
