import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingShell } from '@/components/marketing/MarketingShell'

export const metadata: Metadata = {
  title: "Changelog - What's New",
  description: 'See the latest updates, improvements, and new features added to NatureQuery.',
}

type ChangeType = 'feature' | 'improvement' | 'fix' | 'security'

interface Release {
  version: string
  date: string
  title: string
  description: string
  changes: { type: ChangeType; text: string }[]
}

const TYPE_LABEL: Record<ChangeType, { label: string; className: string }> = {
  feature: { label: 'New', className: 'text-mk-violet' },
  improvement: { label: 'Improved', className: 'text-mk-ink-2' },
  fix: { label: 'Fixed', className: 'text-mk-signal-ink' },
  security: { label: 'Security', className: 'text-mk-ink' },
}

const RELEASES: Release[] = [
  {
    version: '1.4.0',
    date: 'Oct 11, 2026',
    title: 'NatureQuery Desktop and team plans',
    description:
      'A Windows app for databases on your own network, and one plan that covers a whole team.',
    changes: [
      {
        type: 'feature',
        text: 'NatureQuery Desktop for Windows, free in the Microsoft Store, with browser sign-in and 18 database types',
      },
      {
        type: 'feature',
        text: "Team plans: members who accept an invite use the team owner's plan, within the plan's seats",
      },
      { type: 'feature', text: 'Report an AI answer that is wrong or inappropriate' },
      { type: 'feature', text: 'A download page with the Microsoft Store badge' },
      { type: 'improvement', text: 'A new look for the website' },
      {
        type: 'improvement',
        text: 'The privacy policy now covers the desktop app and spells out what the AI sees',
      },
      {
        type: 'fix',
        text: "Team invites check seats against the owner's plan, whoever sends them",
      },
    ],
  },
  {
    version: '1.3.0',
    date: 'Apr 2, 2026',
    title: 'Public pages and polish',
    description: 'New public pages, codebase cleanup, and UX refinements.',
    changes: [
      {
        type: 'feature',
        text: 'Added Features, Pricing, About, Contact, Changelog, and FAQ pages',
      },
      { type: 'feature', text: 'Delete confirmation for database connections' },
      { type: 'improvement', text: 'Schema loads again after a page refresh (no more "0 tables")' },
      { type: 'improvement', text: 'Cleaned up 15+ unused files and debug artifacts' },
      { type: 'improvement', text: 'Updated navigation links across all public pages' },
    ],
  },
  {
    version: '1.2.0',
    date: 'Mar 25, 2026',
    title: 'Conversational follow-ups',
    description: 'Ask follow-up questions. NatureQuery remembers context from previous queries.',
    changes: [
      { type: 'feature', text: 'Multi-turn conversation context (up to 5 previous queries)' },
      { type: 'feature', text: 'Conversation indicator with a "New thread" reset button' },
      { type: 'feature', text: 'Streaming mode that shows its reasoning step by step' },
      { type: 'improvement', text: 'Smarter schema filtering using conversation history terms' },
      { type: 'improvement', text: 'Per-connection conversation tracking' },
    ],
  },
  {
    version: '1.1.0',
    date: 'Mar 15, 2026',
    title: 'Enterprise hardening',
    description: 'Security headers, roles, rate limiting, caching, and GDPR compliance.',
    changes: [
      { type: 'security', text: 'CSP, HSTS, X-Frame-Options, and other security headers' },
      { type: 'feature', text: 'Role-based access control (Owner, Admin, Member, Viewer)' },
      { type: 'feature', text: 'GDPR data export for your account' },
      { type: 'feature', text: 'Redis caching layer with in-memory fallback' },
      { type: 'improvement', text: 'Query-per-minute rate limiting per user' },
      { type: 'improvement', text: 'PgBouncer connection pooling support' },
    ],
  },
  {
    version: '1.0.0',
    date: 'May 2026',
    title: 'Public launch',
    description: 'NatureQuery launches with 30+ features and 6 database types supported.',
    changes: [
      { type: 'feature', text: 'Natural language to SQL generation with fast AI inference' },
      {
        type: 'feature',
        text: 'Support for PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, and Amazon Redshift',
      },
      { type: 'feature', text: 'Two-factor authentication with TOTP and backup codes' },
      { type: 'feature', text: 'Team collaboration with shared connections and queries' },
      { type: 'feature', text: 'Free, Pro, and Enterprise plans' },
      { type: 'feature', text: 'CSV/JSON/PDF export and Magic CSV Upload' },
      { type: 'feature', text: 'Audit logging, query history, and saved queries' },
      { type: 'security', text: 'AES-256 encryption for stored credentials' },
      { type: 'security', text: 'Row-level security and plan-based access limits' },
    ],
  },
]

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">Changelog</p>
        <h1 className="mt-5 max-w-4xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.9rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          What&apos;s new in NatureQuery.
        </h1>
        <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-mk-ink-2">
          Every release, newest first. Questions about a change?{' '}
          <Link href="/contact" className="mk-link">
            Ask us
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-24 pt-14 sm:px-8 sm:pb-32 sm:pt-20">
        <ol className="border-t border-mk-ink/80">
          {RELEASES.map((release, index) => (
            <li
              key={release.version}
              className="grid gap-4 border-b border-mk-rule py-12 lg:grid-cols-[13rem_1fr] lg:gap-16"
            >
              <div className="lg:pt-2">
                <p className="font-nq-mono text-[0.8rem] text-mk-ink">
                  {index === 0 ? (
                    <span className="mk-highlight">v{release.version}</span>
                  ) : (
                    `v${release.version}`
                  )}
                </p>
                <p className="mt-1 font-nq-mono text-[0.72rem] uppercase tracking-[0.06em] text-mk-ink-3">
                  {release.date}
                </p>
              </div>
              <div>
                <h2 className="font-nq-serif text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.1] tracking-[-0.015em] text-mk-ink">
                  {release.title}
                </h2>
                <p className="mt-3 max-w-[40rem] text-[1.0625rem] leading-relaxed text-mk-ink-2">
                  {release.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {release.changes.map((change) => (
                    <li
                      key={change.text}
                      className="grid grid-cols-[5.5rem_1fr] gap-4 text-[0.9375rem] leading-relaxed"
                    >
                      <span
                        className={`pt-[0.2rem] font-nq-mono text-[0.7rem] font-medium uppercase tracking-[0.08em] ${TYPE_LABEL[change.type].className}`}
                      >
                        {TYPE_LABEL[change.type].label}
                      </span>
                      <span className="text-mk-ink-2">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </MarketingShell>
  )
}
