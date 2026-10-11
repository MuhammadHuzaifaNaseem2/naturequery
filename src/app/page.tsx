import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { QuestionPath } from '@/components/marketing/QuestionPath'
import { QuestionToAnswer } from '@/components/marketing/QuestionToAnswer'
import { Shot } from '@/components/marketing/Shot'
import { StoreBadge } from '@/components/StoreBadge'
import { DESKTOP_ONLY_DATABASES, WEB_DATABASES } from '@/lib/supported-databases'

export const metadata: Metadata = {
  title: 'NatureQuery - Natural Language to SQL',
  description:
    'Ask questions in plain English. NatureQuery writes read-only SQL for PostgreSQL, SQL Server, Snowflake, BigQuery and 10 more databases, runs it, and returns tables, charts and summaries.',
}

const DEMO_VIDEO = 'https://www.youtube.com/watch?v=0h5kmva3wq0'

const SHOWCASE = [
  {
    label: 'Follow-up questions',
    title: 'Ask the next question the way you would ask a colleague.',
    text: 'Say “only last month” or “split it by region”. NatureQuery refines the query it just wrote instead of starting over.',
    image: '/marketing/ask.png',
    alt: 'NatureQuery with a follow-up box, the SQL it wrote, and the top five customers by spending',
    caption: 'A follow-up box under the last question, the SQL, and the result',
    region: { x: 540, y: 118, w: 1380 },
    aspect: 1.85,
  },
  {
    label: 'Charts',
    title: 'A chart without building one.',
    text: 'Switch any result to a bar, line, area, pie or scatter chart in one click, then open it full screen for the meeting.',
    image: '/marketing/chart.png',
    alt: 'Monthly revenue from the sample store drawn as an area chart in NatureQuery',
    caption: 'Twelve months of revenue from the sample store, as an area chart',
    region: { x: 545, y: 548, w: 1375 },
    aspect: 3.2,
  },
  {
    label: 'Explain and summarize',
    title: 'Answers the whole team can read.',
    text: 'Explain turns any query into plain English, so you know exactly what was counted. Summarize turns a result into a few sentences you can paste into a report.',
    image: '/marketing/summarize.png',
    alt: 'A plain-English summary of the top five customers next to the query result in NatureQuery',
    caption: 'A summary beside the result, ready to paste into a report',
    region: { x: 540, y: 490, w: 1380 },
    aspect: 2.85,
  },
]

const SAFEGUARDS = [
  {
    term: 'Read-only',
    text: 'Queries that would change your data are refused before they reach your database, on the web and in the desktop app.',
  },
  {
    term: 'Schema, not rows',
    text: 'Writing a query needs only table and column names. The few features that use result rows are spelled out in the privacy policy.',
  },
  {
    term: 'Encrypted credentials',
    text: 'Connection passwords are encrypted with AES-256-GCM on the web, and with your Windows account in the desktop app.',
  },
  {
    term: 'Your sign-in',
    text: 'Two-factor sign-in with backup codes, and a list of every computer signed in to your account.',
  },
  {
    term: 'Audit log',
    text: 'Sign-ins and sensitive actions are recorded, so you can see who did what and when.',
  },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    points: ['50 AI questions a month', '1 database connection', 'Excel and CSV export'],
    cta: 'Start free',
    href: '/register',
  },
  {
    name: 'Pro',
    price: '$20',
    period: 'a month',
    points: [
      'Unlimited AI questions',
      '10 database connections',
      'Shared with up to 5 team members',
    ],
    cta: 'Choose Pro',
    href: '/register?plan=pro',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '$79',
    period: 'a month',
    points: ['Unlimited connections and team members', 'Audit logs', 'Dedicated support'],
    cta: 'Choose Enterprise',
    href: '/register?plan=enterprise',
  },
]

function SectionHeading({ label, title }: { label: string; title: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="mk-label">{label}</p>
      <h2 className="mt-4 text-balance font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
        {title}
      </h2>
    </div>
  )
}

export default function LandingPage() {
  return (
    <MarketingShell current="/">
      {/* Hero: the claim, then the proof. */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <h1 className="font-nq-serif text-[clamp(2.75rem,6.6vw,5.6rem)] font-normal leading-[1] tracking-[-0.03em] text-mk-ink">
          <span className="block">
            Your database speaks{' '}
            <span className="font-nq-mono text-[0.8em] font-medium tracking-[-0.05em] text-mk-violet">
              SQL
            </span>
            .
          </span>
          <em className="block text-mk-ink-2">You don&apos;t have to.</em>
        </h1>
        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[36rem] text-lg leading-relaxed text-mk-ink-2">
            Ask a question in plain English. NatureQuery writes read-only SQL for your database,
            runs it, and hands back the answer as a table, a chart or a summary.
          </p>
          <div className="lg:text-right">
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Link href="/register" className="mk-btn mk-btn-primary">
                Start free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/download" className="mk-btn mk-btn-quiet">
                Download for Windows
              </Link>
            </div>
            <p className="mt-4 text-sm text-mk-ink-3">
              Free plan: 50 AI questions a month. No card needed.
            </p>
            <a
              href={DEMO_VIDEO}
              target="_blank"
              rel="noopener noreferrer"
              className="mk-link mt-1.5 inline-flex items-center gap-1 text-sm"
            >
              Watch the 90-second demo
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>

        <div className="mt-14 sm:mt-20">
          <QuestionToAnswer />
        </div>
      </section>

      {/* Databases */}
      <section aria-label="Supported databases" className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="mt-20 grid gap-5 border-y border-mk-rule py-8 md:grid-cols-[11rem_1fr] md:gap-8">
          <p className="mk-label md:pt-1">Works with</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2.5 text-[0.9375rem] text-mk-ink-2">
            {WEB_DATABASES.map((name) => (
              <li key={name}>{name}</li>
            ))}
            <li className="text-mk-ink-3">and CSV or Excel files</li>
          </ul>
          <p className="text-sm text-mk-ink-3 md:col-start-2">
            NatureQuery Desktop also connects to {DESKTOP_ONLY_DATABASES.slice(0, -1).join(', ')}{' '}
            and {DESKTOP_ONLY_DATABASES.at(-1)}.
          </p>
        </div>
      </section>

      {/* How a question becomes an answer */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <SectionHeading
          label="How it works"
          title="Four steps between a question and its answer."
        />
        <div className="mt-14 sm:mt-16">
          <QuestionPath />
        </div>
      </section>

      {/* What you can do with an answer */}
      <section className="border-t border-mk-rule" aria-label="What you can do">
        <div className="mx-auto max-w-[1200px] divide-y divide-mk-rule px-5 sm:px-8">
          {SHOWCASE.map((item, index) => (
            <div key={item.label} className="py-20 sm:py-24">
              <div className="grid gap-5 lg:grid-cols-2 lg:items-end lg:gap-16">
                <div>
                  <p className="mk-label">{item.label}</p>
                  <h3 className="mt-4 text-balance font-nq-serif text-[clamp(1.75rem,2.8vw,2.4rem)] font-normal leading-[1.1] tracking-[-0.015em] text-mk-ink">
                    {item.title}
                  </h3>
                </div>
                <p className="max-w-[32rem] text-[1.0625rem] leading-relaxed text-mk-ink-2 lg:pb-1">
                  {item.text}
                </p>
              </div>
              <figure className="mt-10 sm:mt-12">
                <div className="overflow-hidden rounded-lg border border-mk-rule bg-mk-band shadow-[0_30px_60px_-38px_hsl(var(--mk-ink)/0.45)]">
                  <Shot src={item.image} alt={item.alt} region={item.region} aspect={item.aspect} />
                </div>
                <figcaption className="mt-3 font-nq-mono text-[0.72rem] text-mk-ink-3">
                  Fig. {index + 1} &middot; {item.caption}
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </section>

      {/* Safeguards */}
      <section className="bg-mk-band text-mk-band-ink">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="font-nq-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-mk-band-ink-2">
              Safeguards
            </p>
            <h2 className="mt-4 text-balance font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em]">
              Careful with your data, by design.
            </h2>
            <p className="mt-5 max-w-sm leading-relaxed text-mk-band-ink-2">
              Built for the person who answers for the production database.
            </p>
            <Link
              href="/privacy"
              className="mt-8 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium underline decoration-mk-band-ink/30 underline-offset-4 hover:decoration-mk-band-ink"
            >
              Read the privacy policy
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <dl className="divide-y divide-mk-band-rule border-y border-mk-band-rule">
            {SAFEGUARDS.map((item) => (
              <div key={item.term} className="grid gap-2 py-5 sm:grid-cols-[12rem_1fr] sm:gap-8">
                <dt className="font-nq-mono text-[0.78rem] font-medium uppercase tracking-[0.08em] text-mk-signal">
                  {item.term}
                </dt>
                <dd className="leading-relaxed text-mk-band-ink-2">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Desktop app */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <SectionHeading
              label="NatureQuery Desktop"
              title="For the databases a website can't reach."
            />
            <p className="mt-6 max-w-[30rem] text-[1.0625rem] leading-relaxed text-mk-ink-2">
              Databases on your own computer, on your office network or behind a VPN. The Windows
              app connects to them directly, and connection passwords never leave your PC. Same
              account, same plan.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <StoreBadge className="h-12" />
              <Link href="/download" className="mk-link text-[0.9375rem]">
                More about the desktop app
              </Link>
            </div>
          </div>
          <figure>
            <div className="overflow-hidden rounded-lg border border-mk-rule bg-mk-band shadow-[0_30px_60px_-38px_hsl(var(--mk-ink)/0.45)]">
              <Shot
                src="/marketing/connect.png"
                alt="The Add a connection window in NatureQuery Desktop, listing PostgreSQL, MySQL, SQL Server, Oracle, Snowflake and other database types"
                region={{ x: 560, y: 150, w: 800 }}
                aspect={1.32}
              />
            </div>
            <figcaption className="mt-3 font-nq-mono text-[0.72rem] text-mk-ink-3">
              Fig. 4 &middot; Choosing a database in NatureQuery Desktop
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
          <SectionHeading
            label="Pricing"
            title={
              <>
                Free to start.
                <br />
                One plan covers the team.
              </>
            }
          />
          <div className="mt-14 grid border-y border-mk-rule md:grid-cols-3 md:divide-x md:divide-mk-rule">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col border-b border-mk-rule py-8 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0 ${
                  plan.featured ? 'md:bg-mk-surface md:!px-8' : ''
                }`}
              >
                <p className="text-lg font-semibold text-mk-ink">{plan.name}</p>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="font-nq-serif text-5xl tracking-[-0.02em] text-mk-ink">
                    {plan.price}
                  </span>
                  <span className="text-sm text-mk-ink-3">{plan.period}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-[0.9375rem] text-mk-ink-2">
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
                <Link
                  href={plan.href}
                  className={`mk-btn mt-8 self-start ${plan.featured ? 'mk-btn-primary' : 'mk-btn-quiet'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mk-link mt-6 inline-flex text-[0.9375rem]">
            Compare every feature
          </Link>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
          <h2 className="max-w-4xl text-balance font-nq-serif text-[clamp(2.4rem,5.4vw,4.5rem)] font-normal italic leading-[1.02] tracking-[-0.025em] text-mk-ink">
            What would you ask your data first?
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-3">
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
