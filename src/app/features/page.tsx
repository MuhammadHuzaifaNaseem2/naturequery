import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { Shot } from '@/components/marketing/Shot'

export const metadata: Metadata = {
  title: 'Features - Everything NatureQuery Offers',
  description:
    'Plain-English questions to SQL with follow-ups and step-by-step reasoning, 14 databases, charts, dashboards, scheduled queries, team plans and read-only security.',
}

interface Feature {
  title: string
  description: string
}

interface Chapter {
  id: string
  label: string
  title: string
  subtitle: string
  features: Feature[]
  figure?: {
    src: string
    alt: string
    caption: string
    region: { x: number; y: number; w: number }
    aspect: number
  }
}

const CHAPTERS: Chapter[] = [
  {
    id: 'ask',
    label: 'Asking',
    title: 'AI that understands your tables.',
    subtitle: 'Ask in plain English and get SQL written for your database, in seconds.',
    features: [
      {
        title: 'Plain English to SQL',
        description:
          'Type “show me top customers by revenue” and get join-aware SQL for your schema. No SQL knowledge needed.',
      },
      {
        title: 'Follow-up questions',
        description:
          'Say “filter to New York” or “break it down by month” and NatureQuery changes the query it just wrote.',
      },
      {
        title: 'Step-by-step reasoning',
        description:
          'Watch it work: which tables it picks, how it joins them, and why, before the SQL appears.',
      },
      {
        title: 'Schema insights',
        description:
          'Connect a database and get suggested questions based on the tables and columns it finds.',
      },
      {
        title: 'Fix with AI',
        description:
          'When the database rejects a query, NatureQuery reads the error, corrects the SQL and runs it again.',
      },
      {
        title: 'Explain any query',
        description:
          'A plain-English breakdown of what a query does, so you can check it before you trust the answer.',
      },
    ],
    figure: {
      src: '/marketing/ask.png',
      alt: 'A follow-up box, the SQL NatureQuery wrote, and the result table',
      caption: 'A question, its SQL and the result, with a follow-up box ready',
      region: { x: 540, y: 118, w: 1380 },
      aspect: 1.85,
    },
  },
  {
    id: 'analyze',
    label: 'Working with results',
    title: 'Tools for the answer, not just the query.',
    subtitle: 'Explore, format, chart and export what comes back.',
    features: [
      {
        title: 'Column filters and search',
        description:
          'Search across every result, and filter each column by type: text matches for strings, ranges for numbers.',
      },
      {
        title: 'Charts in one click',
        description:
          'Draw any result as a bar, line, area, pie or scatter chart, with a recommended type for the shape of your data.',
      },
      {
        title: 'Excel and CSV export',
        description:
          'Download results as formatted Excel workbooks or CSV files, with headers and types kept.',
      },
      {
        title: 'CSV and Excel uploads',
        description:
          'Drop in a spreadsheet and NatureQuery turns it into a table you can ask questions about straight away.',
      },
      {
        title: 'Query templates',
        description:
          'Save your best queries as reusable templates and group them by topic, such as sales or inventory.',
      },
      {
        title: 'SQL formatter',
        description: 'One click turns a long query into neatly indented, readable SQL.',
      },
    ],
    figure: {
      src: '/marketing/chart.png',
      alt: 'Twelve months of revenue drawn as an area chart, with bar, line, pie and scatter options',
      caption: 'Monthly revenue as an area chart, one click from the table',
      region: { x: 545, y: 548, w: 1375 },
      aspect: 3.2,
    },
  },
  {
    id: 'share',
    label: 'Dashboards and sharing',
    title: 'From one answer to a dashboard.',
    subtitle: 'Keep the numbers you check every week in one place, and send them to people.',
    features: [
      {
        title: 'Pin to a dashboard',
        description:
          'Turn any result into a dashboard widget, then arrange and resize widgets into your own view.',
      },
      {
        title: 'Scheduled queries',
        description: 'Run a query every day, week or month and get the results by email.',
      },
      {
        title: 'Shared query links',
        description:
          'Send a secure link to a result. The people you share it with see the data without an account.',
      },
      {
        title: 'Refresh on demand',
        description: 'Widgets show the latest data whenever you refresh them.',
      },
    ],
  },
  {
    id: 'teams',
    label: 'Teams',
    title: 'One plan for the whole team.',
    subtitle: 'From one analyst to a whole department, on the same account.',
    features: [
      {
        title: 'Team plans',
        description:
          'Invite colleagues to your team and they use your plan on the website and in NatureQuery Desktop: 5 people on Pro, unlimited on Enterprise.',
      },
      {
        title: 'Roles',
        description:
          'Owner, admin, member and viewer roles decide who can invite people, manage connections or run queries.',
      },
      {
        title: '14 databases',
        description:
          'PostgreSQL, MySQL, SQL Server, Oracle, Snowflake, BigQuery, MongoDB and 7 more, side by side in one workspace. NatureQuery Desktop adds Turso, DynamoDB, Firestore and Cassandra.',
      },
      {
        title: 'API access',
        description: 'A REST API with key-based authentication for your own scripts and tools.',
      },
      {
        title: 'Your language',
        description: 'The interface is available in English, Spanish, French, German and Japanese.',
      },
      {
        title: 'NatureQuery Desktop',
        description:
          'A Windows app for databases on your own computer or office network, with the same account and plan.',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    title: 'Careful with production data.',
    subtitle: 'Several layers between a question and anything that could go wrong.',
    features: [
      {
        title: 'Read-only queries',
        description:
          'PostgreSQL and Redshift queries are parsed and checked statement by statement; every dialect is checked against a list of commands that change data. Only reads reach your database.',
      },
      {
        title: 'AES-256-GCM encryption',
        description:
          'Database credentials are encrypted at rest, and the key can be rotated without downtime.',
      },
      {
        title: 'Two-factor sign-in',
        description:
          'Authenticator-app codes with backup codes for recovery, plus a list of every computer signed in to your account.',
      },
      {
        title: 'Audit log',
        description:
          'Sign-ins and sensitive actions are recorded, with entries chained by hashes so changes can be detected.',
      },
      {
        title: 'Rate limiting',
        description:
          'Per-user, per-endpoint limits protect your databases and your account from abuse.',
      },
      {
        title: 'Security headers',
        description:
          'Content Security Policy, HSTS, frame protection and a strict permissions policy on every response.',
      },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <MarketingShell current="/features">
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">Product</p>
        <h1 className="mt-5 max-w-5xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.9rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          Everything between a question{' '}
          <em className="text-mk-ink-2">and the decision it leads to.</em>
        </h1>
        <p className="mt-7 max-w-[38rem] text-lg leading-relaxed text-mk-ink-2">
          NatureQuery writes the SQL, runs it read-only, and gives your team answers they can chart,
          share and act on. Here is everything it does.
        </p>
      </section>

      <div className="mx-auto mt-16 grid max-w-[1200px] gap-12 px-5 sm:mt-24 sm:px-8 lg:grid-cols-[13rem_1fr] lg:gap-16">
        {/* Index */}
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-28 space-y-3 border-l border-mk-rule pl-5">
            {CHAPTERS.map((chapter, index) => (
              <li key={chapter.id}>
                <a
                  href={`#${chapter.id}`}
                  className="group flex gap-3 text-[0.9375rem] text-mk-ink-2 hover:text-mk-ink"
                >
                  <span className="font-nq-mono text-[0.72rem] leading-6 text-mk-ink-3 group-hover:text-mk-violet">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {chapter.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          {CHAPTERS.map((chapter, index) => (
            <section
              key={chapter.id}
              id={chapter.id}
              className="scroll-mt-24 border-t border-mk-rule pb-20 pt-10 first:border-t-0 first:pt-0 sm:pb-24"
            >
              <p className="mk-label">
                <span className="text-mk-violet">{String(index + 1).padStart(2, '0')}</span>{' '}
                {chapter.label}
              </p>
              <h2 className="mt-4 text-balance font-nq-serif text-[clamp(2rem,3.4vw,2.9rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
                {chapter.title}
              </h2>
              <p className="mt-4 max-w-[36rem] text-[1.0625rem] leading-relaxed text-mk-ink-2">
                {chapter.subtitle}
              </p>

              {chapter.figure && (
                <figure className="mt-10">
                  <div className="overflow-hidden rounded-lg border border-mk-rule shadow-[0_30px_60px_-38px_hsl(var(--mk-ink)/0.45)]">
                    <Shot
                      src={chapter.figure.src}
                      alt={chapter.figure.alt}
                      region={chapter.figure.region}
                      aspect={chapter.figure.aspect}
                    />
                  </div>
                  <figcaption className="mt-3 font-nq-mono text-[0.72rem] text-mk-ink-3">
                    {chapter.figure.caption}
                  </figcaption>
                </figure>
              )}

              <dl className="mt-10 grid gap-x-12 sm:grid-cols-2">
                {chapter.features.map((feature) => (
                  <div key={feature.title} className="border-t border-mk-rule py-6">
                    <dt className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-mk-ink">
                      {feature.title}
                    </dt>
                    <dd className="mt-2 leading-relaxed text-mk-ink-2">{feature.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>

      {/* Closing */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
          <h2 className="max-w-4xl text-balance font-nq-serif text-[clamp(2.2rem,4.6vw,3.9rem)] font-normal italic leading-[1.04] tracking-[-0.025em] text-mk-ink">
            See it with your own data.
          </h2>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register" className="mk-btn mk-btn-primary">
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/pricing" className="mk-btn mk-btn-quiet">
              Compare plans
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
