import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { Shot } from '@/components/marketing/Shot'
import { StoreBadge } from '@/components/StoreBadge'

export const metadata: Metadata = {
  title: 'Download for Windows',
  description:
    'NatureQuery Desktop asks the databases on your computer and office network questions in plain English. Free from the Microsoft Store.',
}

const REASONS = [
  {
    term: 'Reaches your office databases',
    text: 'Connects from your PC to databases on your computer, your office network or a VPN. Nothing has to be opened to the internet.',
  },
  {
    term: 'Passwords stay on your PC',
    text: 'Connection passwords are encrypted with your Windows account and never sent to NatureQuery.',
  },
  {
    term: 'Read-only by design',
    text: 'NatureQuery only reads data. Requests that would change or delete data are declined.',
  },
]

const STEPS = [
  {
    title: 'Install it from the Microsoft Store',
    text: 'Choose Download from the Microsoft Store. The Store installs NatureQuery and keeps it up to date.',
  },
  {
    title: 'Sign in with your browser',
    text: 'Open NatureQuery and choose Sign in with your browser. Use your NatureQuery account, or create a free one.',
  },
  {
    title: 'Connect a database',
    text: 'Add your database, or try the built-in sample store first. Then ask a question in plain English.',
  },
]

const DATABASES = [
  'PostgreSQL',
  'MySQL',
  'MariaDB',
  'SQL Server',
  'Oracle',
  'SQLite',
  'MongoDB',
  'Snowflake',
  'BigQuery',
  'ClickHouse',
  'Amazon Redshift',
  'CockroachDB',
  'Neon',
  'Supabase',
  'PlanetScale',
  'Turso',
  'Amazon DynamoDB',
  'Cloud Firestore',
  'Apache Cassandra',
]

const QUESTIONS = [
  {
    question: 'Is the desktop app free?',
    answer:
      'Yes. Downloading is free, and the Free plan includes 50 AI questions a month. Writing queries yourself is always unlimited. Paid plans remove the AI limit.',
  },
  {
    question: 'Is there a Mac or Linux version?',
    answer:
      'Not yet. NatureQuery Desktop runs on Windows 10 and 11. On other computers, you can use NatureQuery in your browser with databases that are reachable from the internet.',
  },
  {
    question: 'What leaves my computer?',
    answer:
      'Only what each AI feature needs, such as your question and the names and types of your tables and columns. Your connections and history stay on your PC, and result rows are sent only if you let AI summaries use them.',
  },
  {
    question: 'Our work PCs block the Microsoft Store. What now?',
    answer:
      'Your IT team can still install NatureQuery with Microsoft Intune, or with this command: winget install 9N6PJDWJRLFM -s msstore',
  },
]

export default function DownloadPage() {
  return (
    <MarketingShell current="/download">
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">NatureQuery Desktop for Windows</p>
        <h1 className="mt-5 max-w-5xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.9rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          The databases a website can&apos;t reach.{' '}
          <em className="text-mk-ink-2">Asked from your own PC.</em>
        </h1>
        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="max-w-[36rem] text-lg leading-relaxed text-mk-ink-2">
            On your computer, on your office network or behind a VPN. The Windows app connects to
            them directly and asks them questions in plain English. Same account, same plan.
          </p>
          <div className="lg:text-right">
            <StoreBadge className="h-14" />
            <p className="mt-3 text-sm text-mk-ink-3">
              Windows 10 version 1809 or later, 64-bit. Free. Updates install automatically.
            </p>
          </div>
        </div>
        <figure className="mt-14 sm:mt-20">
          <div className="overflow-hidden rounded-lg border border-mk-rule shadow-[0_30px_60px_-38px_hsl(var(--mk-ink)/0.45)]">
            <Shot
              src="/marketing/home.png"
              alt="NatureQuery Desktop showing its connections, recent questions and the sample store"
              region={{ x: 0, y: 0, w: 1920 }}
              aspect={1920 / 1080}
            />
          </div>
          <figcaption className="mt-3 font-nq-mono text-[0.72rem] text-mk-ink-3">
            NatureQuery Desktop, with three office databases and the built-in sample store
          </figcaption>
        </figure>
      </section>

      {/* Why the desktop app */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
        <dl className="grid gap-10 border-t border-mk-rule pt-10 md:grid-cols-3 md:gap-10">
          {REASONS.map((reason) => (
            <div key={reason.term}>
              <dt className="text-lg font-semibold tracking-[-0.01em] text-mk-ink">
                {reason.term}
              </dt>
              <dd className="mt-2 leading-relaxed text-mk-ink-2">{reason.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Get started */}
      <section className="border-y border-mk-rule bg-mk-surface">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
          <p className="mk-label">Get started</p>
          <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
            Three steps to your first answer.
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t border-mk-rule pt-6">
                <p className="font-nq-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-mk-violet">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.01em] text-mk-ink">
                  {step.title}
                </h3>
                <p className="mt-2 leading-relaxed text-mk-ink-2">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Databases */}
      <section className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid gap-5 border-b border-mk-rule py-10 md:grid-cols-[11rem_1fr] md:gap-8">
          <p className="mk-label md:pt-1">Connects to</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2.5 text-[0.9375rem] text-mk-ink-2">
            {DATABASES.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* For companies */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mk-label">For companies</p>
            <h2 className="mt-4 max-w-3xl text-balance font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
              One plan for your whole team.
            </h2>
            <p className="mt-5 max-w-[40rem] leading-relaxed text-mk-ink-2">
              Buy Pro or Enterprise, create a team under Settings, Team, and invite your colleagues.
              Everyone who accepts uses your plan in the desktop app and on the website: up to 5
              colleagues on Pro, and unlimited on Enterprise.
            </p>
          </div>
          <Link href="/pricing" className="mk-btn mk-btn-quiet self-start lg:self-end">
            See plans
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Questions */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="mk-label">Questions</p>
            <h2 className="mt-4 font-nq-serif text-[clamp(2.1rem,3.8vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.02em] text-mk-ink">
              Before you install.
            </h2>
            <p className="mt-5 text-mk-ink-2">
              More in the{' '}
              <Link href="/privacy" className="mk-link">
                privacy policy
              </Link>
              .
            </p>
          </div>
          <dl className="divide-y divide-mk-rule border-y border-mk-rule">
            {QUESTIONS.map((item) => (
              <div key={item.question} className="py-6">
                <dt className="font-nq-serif text-[1.35rem] leading-snug text-mk-ink">
                  {item.question}
                </dt>
                <dd className="mt-2.5 leading-relaxed text-mk-ink-2">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-mk-rule">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
          <h2 className="font-nq-serif text-[clamp(2rem,4vw,3.2rem)] font-normal italic leading-[1.05] tracking-[-0.02em] text-mk-ink">
            Ready when your database is.
          </h2>
          <StoreBadge className="h-14" />
        </div>
      </section>
    </MarketingShell>
  )
}
