import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'

export const metadata: Metadata = {
  title: 'About - Our Mission',
  description:
    'NatureQuery makes database querying accessible to everyone. Learn about our mission, values, and the story behind the product.',
}

const VALUES = [
  {
    title: 'Simplicity first',
    description:
      "Powerful tools should be easy to use. If it takes a manual to understand, we've failed.",
  },
  {
    title: 'Security by default',
    description:
      "AES-256 encryption, two-factor sign-in and audit logs aren't add-ons. They're built into every layer.",
  },
  {
    title: 'Close to the people who use it',
    description:
      'Every feature starts with a real person and a real question. We ship, listen and improve.',
  },
  {
    title: 'Open and transparent',
    description:
      'Clear pricing, no hidden fees and no lock-in. You can export everything, any time. Your data stays yours.',
  },
]

const MILESTONES = [
  {
    date: 'Jan 2026',
    title: 'The idea',
    description:
      'Tired of writing SQL for non-technical teammates, we started building a way for them to ask on their own.',
  },
  {
    date: 'Feb 2026',
    title: 'First prototype',
    description:
      'The first plain-English question turned into working SQL and came back with the right answer.',
  },
  {
    date: 'Mar 2026',
    title: 'Ready for teams',
    description: 'Two-factor sign-in, audit logs, teams with roles, and billing.',
  },
  {
    date: 'May 2026',
    title: 'Public launch',
    description: 'NatureQuery opened to everyone, with support for 14 database types.',
  },
  {
    date: 'Oct 2026',
    title: 'NatureQuery Desktop',
    description:
      'A Windows app in the Microsoft Store for databases on office networks, and team plans that cover a whole company.',
  },
]

export default function AboutPage() {
  return (
    <MarketingShell current="/about">
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">About</p>
        <h1 className="mt-5 max-w-5xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.9rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          Data should answer anyone <em className="text-mk-ink-2">who knows the question.</em>
        </h1>
        <p className="mt-7 max-w-[38rem] text-lg leading-relaxed text-mk-ink-2">
          Every person on a team, not just the SQL experts, should be able to ask their
          company&apos;s data a question and get an answer. NatureQuery bridges plain language and
          databases.
        </p>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="mk-label">The problem</p>
            <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
              A simple question shouldn&apos;t take three days.
            </h2>
            <div className="mt-6 space-y-4 text-[1.0625rem] leading-relaxed text-mk-ink-2">
              <p>
                In most organizations, data lives in databases that only engineers can reach.
                Product managers, analysts and executives file tickets to get simple answers, and
                &ldquo;How many people signed up last week?&rdquo; turns into a three-day wait.
              </p>
              <p>
                BI tools like Metabase or Retool need setup, SQL knowledge and upkeep. They are
                built for technical people who already know where to look.
              </p>
              <p className="text-mk-ink">
                With NatureQuery you type the question in plain English and get the answer. No SQL,
                no dashboards to configure, no waiting on engineering.
              </p>
            </div>
          </div>

          <div className="self-center">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Getting an answer, before and with NatureQuery</caption>
              <thead>
                <tr className="border-b border-mk-ink/80">
                  <th scope="col" className="mk-label pb-3 font-medium">
                    Before
                  </th>
                  <th scope="col" className="mk-label pb-3 pl-6 font-medium">
                    How long
                  </th>
                </tr>
              </thead>
              <tbody className="text-[0.9375rem]">
                {[
                  ['Write a ticket for the data team', 'Days'],
                  ['Wait for someone to write the SQL', 'Days'],
                  ['Ask a follow-up, start again', 'Days more'],
                ].map(([step, time]) => (
                  <tr key={step} className="border-b border-mk-rule">
                    <td className="py-4 text-mk-ink-3 line-through decoration-mk-ink-3/50">
                      {step}
                    </td>
                    <td className="py-4 pl-6 font-nq-mono text-[0.8rem] text-mk-ink-3">{time}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-6 font-nq-serif text-[1.6rem] italic leading-tight text-mk-ink">
                    Ask NatureQuery.
                  </td>
                  <td className="pl-6 pt-6 font-nq-mono text-[0.8rem] text-mk-violet">
                    <span className="mk-highlight">One question</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
          <p className="mk-label">What we stand for</p>
          <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
            The principles behind each decision.
          </h2>
          <dl className="mt-12 grid gap-x-12 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div key={value.title} className="border-t border-mk-rule py-6">
                <dt className="text-lg font-semibold tracking-[-0.01em] text-mk-ink">
                  {value.title}
                </dt>
                <dd className="mt-2 leading-relaxed text-mk-ink-2">{value.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="mk-label">Our story</p>
            <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
              From an idea to two apps.
            </h2>
          </div>
          <ol className="relative space-y-10 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-mk-rule">
            {MILESTONES.map((milestone, index) => {
              const latest = index === MILESTONES.length - 1
              return (
                <li
                  key={milestone.date}
                  className="relative grid gap-1 pl-10 sm:grid-cols-[7rem_1fr] sm:gap-6"
                >
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      latest ? 'border-mk-signal bg-mk-signal' : 'border-mk-violet bg-mk-paper'
                    }`}
                  >
                    {!latest && <span className="h-1.5 w-1.5 rounded-full bg-mk-violet" />}
                  </span>
                  <p className="font-nq-mono text-[0.78rem] leading-6 text-mk-violet">
                    {milestone.date}
                  </p>
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.01em] text-mk-ink">
                      {milestone.title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-mk-ink-2">{milestone.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
          <h2 className="max-w-4xl text-balance font-nq-serif text-[clamp(2.2rem,4.6vw,3.9rem)] font-normal italic leading-[1.04] tracking-[-0.025em] text-mk-ink">
            Ask your data something today.
          </h2>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register" className="mk-btn mk-btn-primary">
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/contact" className="mk-btn mk-btn-quiet">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
