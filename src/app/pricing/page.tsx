import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, Minus } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PricingCTAButton } from './PricingCTAButton'

export const metadata: Metadata = {
  title: 'Pricing - Plans for Every Team',
  description:
    'Start free with 50 AI questions a month. Pro is $20 a month and covers a team of five. Enterprise is $79 a month with no limits on connections or team members.',
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For one person exploring their data.',
    points: [
      '50 AI questions a month',
      '1 database connection',
      'Excel and CSV export',
      '30 days of query history',
    ],
    cta: 'Start free',
    href: '/register',
    planKey: null,
  },
  {
    name: 'Pro',
    price: '$20',
    period: 'a month',
    description: 'For professionals and small teams.',
    note: 'Covers you and up to 5 team members',
    points: [
      'Unlimited AI questions',
      '10 database connections',
      'Unlimited saved queries',
      'Dashboards and scheduled queries',
      'Shared query links and API access',
      'Priority support',
    ],
    cta: 'Choose Pro',
    href: '/register?plan=pro',
    planKey: 'PRO',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '$79',
    period: 'a month',
    description: 'For organizations with many databases.',
    note: 'Covers your whole team',
    points: [
      'Everything in Pro',
      'Unlimited database connections',
      'Unlimited team members',
      'Audit logs',
      'Dedicated support and SLA',
    ],
    cta: 'Choose Enterprise',
    href: '/register?plan=enterprise',
    planKey: 'ENTERPRISE',
  },
] as const

type Cell = boolean | string

const COMPARISON: { category: string; features: { name: string; cells: [Cell, Cell, Cell] }[] }[] =
  [
    {
      category: 'Asking questions',
      features: [
        { name: 'Plain English to SQL', cells: [true, true, true] },
        { name: 'Follow-up questions', cells: [true, true, true] },
        { name: 'Step-by-step reasoning before it writes SQL', cells: [true, true, true] },
        { name: 'Fix with AI', cells: [true, true, true] },
        { name: 'Schema insights', cells: [true, true, true] },
        { name: 'Explain any query', cells: [true, true, true] },
        { name: 'AI questions a month', cells: ['50', 'Unlimited', 'Unlimited'] },
      ],
    },
    {
      category: 'Data and export',
      features: [
        { name: 'Database connections', cells: ['1', '10', 'Unlimited'] },
        { name: 'CSV and Excel uploads', cells: [true, true, true] },
        { name: 'Excel and CSV export', cells: [true, true, true] },
        { name: 'Column filters and search', cells: [true, true, true] },
        { name: 'Query history', cells: ['30 days', 'Unlimited', 'Unlimited'] },
      ],
    },
    {
      category: 'Dashboards and sharing',
      features: [
        { name: 'Automatic charts', cells: [true, true, true] },
        { name: 'Pin results to a dashboard', cells: [false, true, true] },
        { name: 'Scheduled queries', cells: [false, true, true] },
        { name: 'Shared query links', cells: [false, true, true] },
      ],
    },
    {
      category: 'Team and admin',
      features: [
        { name: 'Team members who share your plan', cells: [false, '5', 'Unlimited'] },
        { name: 'Role-based access', cells: [false, true, true] },
        { name: 'API access', cells: [false, true, true] },
        { name: 'Audit logs', cells: [false, false, true] },
        { name: 'Dedicated support and SLA', cells: [false, false, true] },
      ],
    },
    {
      category: 'Security and apps',
      features: [
        { name: 'Read-only query checks', cells: [true, true, true] },
        { name: 'AES-256-GCM encrypted credentials', cells: [true, true, true] },
        { name: 'Two-factor sign-in', cells: [true, true, true] },
        { name: 'Export all your data', cells: [true, true, true] },
        { name: 'NatureQuery Desktop for Windows', cells: [true, true, true] },
      ],
    },
  ]

const FAQS = [
  {
    q: 'Does one plan cover my team?',
    a: 'Yes. Create a team under Settings, Team and invite colleagues. Everyone who accepts uses your plan on the website and in NatureQuery Desktop: up to 5 people on Pro, and as many as you like on Enterprise.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription anytime from your billing settings. Access continues until the end of your billing period.',
  },
  {
    q: 'What databases do you support?',
    a: 'PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite, Amazon Redshift, BigQuery, Snowflake, CockroachDB, ClickHouse, Neon, Supabase, PlanetScale and MongoDB, plus CSV and Excel uploads. NatureQuery Desktop also connects to Turso, DynamoDB, Firestore and Cassandra.',
  },
  {
    q: 'Can I change plans anytime?',
    a: 'Absolutely. Upgrade, downgrade, or cancel at any time. Changes take effect immediately with prorated billing.',
  },
  {
    q: 'Is my data secure?',
    a: 'Connection passwords are encrypted with AES-256-GCM, account passwords are hashed with bcrypt, and every query is checked to be read-only. Results are cached for a few minutes to speed up repeated queries, then expire. Query history keeps your questions and SQL, not the rows.',
  },
  {
    q: 'Do you offer annual billing?',
    a: "Annual billing is coming soon with a 20% discount. Sign up for monthly now and we'll automatically apply the discount when it launches.",
  },
  {
    q: 'What happens if I downgrade?',
    a: "You'll be moved to the Free plan at the end of your billing period. No data loss: your saved queries and connections stay.",
  },
]

function CellValue({ value }: { value: Cell }) {
  if (typeof value === 'string')
    return <span className="font-nq-mono text-[0.8rem] text-mk-ink">{value}</span>
  return value ? (
    <Check className="mx-auto h-4 w-4 text-mk-violet" aria-label="Included" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-mk-ink-3/60" aria-label="Not included" />
  )
}

export default function PricingPage() {
  return (
    <MarketingShell current="/pricing">
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">Pricing</p>
        <h1 className="mt-5 max-w-4xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.9rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          Start free. <em className="text-mk-ink-2">Upgrade when the questions add up.</em>
        </h1>
        <p className="mt-7 max-w-[38rem] text-lg leading-relaxed text-mk-ink-2">
          Every plan includes the whole workflow: ask, follow up, explain, fix and summarize. Plans
          differ in how many questions, connections and teammates you need.
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-20">
        <div className="grid border-y border-mk-rule md:grid-cols-3 md:divide-x md:divide-mk-rule">
          {PLANS.map((plan) => {
            const featured = 'featured' in plan && plan.featured
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col border-b border-mk-rule py-10 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0 ${
                  featured
                    ? 'md:!px-8 md:bg-mk-surface before:absolute before:inset-x-0 before:top-[-1px] before:h-[2px] before:bg-mk-violet md:before:block before:hidden'
                    : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-semibold text-mk-ink">{plan.name}</h2>
                  {'note' in plan && (
                    <span className="text-right font-nq-mono text-[0.68rem] uppercase tracking-[0.06em] text-mk-violet">
                      {plan.note}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[0.9375rem] text-mk-ink-3">{plan.description}</p>
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="font-nq-serif text-6xl tracking-[-0.03em] text-mk-ink">
                    {plan.price}
                  </span>
                  <span className="text-sm text-mk-ink-3">{plan.period}</span>
                </p>
                <ul className="mt-8 flex-1 space-y-3 text-[0.9375rem] text-mk-ink-2">
                  {plan.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-mk-violet"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-10">
                  <PricingCTAButton
                    planKey={plan.planKey}
                    fallbackHref={plan.href}
                    label={plan.cta}
                    highlighted={Boolean(featured)}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-5 text-sm text-mk-ink-3">
          Prices in US dollars. NatureQuery Desktop for Windows is included with every plan.
        </p>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <p className="mk-label">Compare plans</p>
        <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
          Every feature, side by side.
        </h2>
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">Features included in each plan</caption>
            <thead>
              <tr className="border-b border-mk-ink/80">
                <th scope="col" className="w-[46%] pb-4 text-sm font-medium text-mk-ink-3">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.name}
                    scope="col"
                    className="pb-4 text-center text-base font-semibold text-mk-ink"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON.map((group) => (
              <tbody key={group.category}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="mk-label border-b border-mk-rule pb-3 pt-10 text-left"
                  >
                    {group.category}
                  </th>
                </tr>
                {group.features.map((feature) => (
                  <tr key={feature.name} className="border-b border-mk-rule">
                    <th
                      scope="row"
                      className="py-3.5 pr-4 text-[0.9375rem] font-normal text-mk-ink-2"
                    >
                      {feature.name}
                    </th>
                    {feature.cells.map((cell, index) => (
                      <td
                        key={index}
                        className={`py-3.5 text-center ${index === 1 ? 'bg-mk-surface' : ''}`}
                      >
                        <CellValue value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      {/* Questions */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="mk-label">Questions</p>
            <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
              About plans and billing.
            </h2>
            <p className="mt-5 text-mk-ink-2">
              Something else?{' '}
              <Link href="/contact" className="mk-link">
                Write to us
              </Link>
              .
            </p>
          </div>
          <dl className="divide-y divide-mk-rule border-y border-mk-rule">
            {FAQS.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-nq-serif text-[1.35rem] leading-snug text-mk-ink">{item.q}</dt>
                <dd className="mt-2.5 leading-relaxed text-mk-ink-2">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
          <h2 className="max-w-4xl text-balance font-nq-serif text-[clamp(2.2rem,4.6vw,3.9rem)] font-normal italic leading-[1.04] tracking-[-0.025em] text-mk-ink">
            Fifty questions a month, free, for as long as you like.
          </h2>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register" className="mk-btn mk-btn-primary">
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/download" className="mk-btn mk-btn-quiet">
              Download for Windows
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
