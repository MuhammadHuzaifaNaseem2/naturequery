import Link from 'next/link'
import { Menu } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'

const LINKS = [
  { href: '/features', label: 'Product' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/download', label: 'Download' },
  { href: '/about', label: 'About' },
]

/** The public site's header. `current` is the path of the page showing it. */
export function MarketingHeader({ current }: { current?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-mk-rule bg-mk-paper">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-10 px-5 sm:px-8">
        <Link href="/" className="shrink-0" aria-label="NatureQuery home">
          <AppLogo size="sm" textClassName="font-semibold tracking-tight text-[1.05rem]" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current === link.href ? 'page' : undefined}
              className="text-[0.9375rem] text-mk-ink-2 transition-colors hover:text-mk-ink aria-[current=page]:font-medium aria-[current=page]:text-mk-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="mk-btn mk-btn-sm hidden text-mk-ink-2 hover:text-mk-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/register" className="mk-btn mk-btn-sm mk-btn-primary">
            Start free
          </Link>

          <details className="group relative md:hidden">
            <summary
              aria-label="Menu"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-mk-rule text-mk-ink [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-4 w-4" />
            </summary>
            <nav
              aria-label="Main"
              className="absolute right-0 top-11 w-56 rounded-lg border border-mk-rule bg-mk-surface p-2 shadow-[0_18px_40px_-20px_hsl(var(--mk-ink)/0.35)]"
            >
              {[...LINKS, { href: '/login', label: 'Sign in' }].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current === link.href ? 'page' : undefined}
                  className="block rounded-md px-3 py-2.5 text-[0.9375rem] text-mk-ink hover:bg-mk-sunken aria-[current=page]:font-semibold"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
