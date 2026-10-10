import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Lock, MonitorDown, Network, ShieldCheck, Users } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { StoreBadge } from '@/components/StoreBadge'

export const metadata: Metadata = {
  title: 'Download for Windows',
  description:
    'NatureQuery Desktop asks the databases on your computer and office network questions in plain English. Free from the Microsoft Store.',
}

const REASONS = [
  {
    icon: Network,
    title: 'Reaches your office databases',
    text: 'Connects from your PC to databases on your computer, your office network or a VPN. Nothing has to be opened to the internet.',
  },
  {
    icon: Lock,
    title: 'Passwords stay on your PC',
    text: 'Connection passwords are encrypted with your Windows account and never sent to NatureQuery.',
  },
  {
    icon: ShieldCheck,
    title: 'Read-only by design',
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
      'Only what each AI feature needs, such as your question and the names and types of your tables and columns. Your connections, results and history stay on your PC.',
  },
]

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size="md" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link href="/download" className="text-sm text-foreground font-medium">
              Download
            </Link>
            <Link
              href="/about"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link href="/register" className="btn-primary text-sm py-2">
              Get Started Free
            </Link>
          </div>
          <div className="md:hidden flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm py-2">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary text-sm py-2">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <MonitorDown className="w-3.5 h-3.5" />
            NatureQuery Desktop for Windows
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
            Ask the databases on your network
            <span className="gradient-text block">in plain English</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            The desktop app reaches the databases a website can&apos;t: on your computer, on your
            office network or behind a VPN. Free from the Microsoft Store.
          </p>
          <StoreBadge />
          <p className="mt-5 text-sm text-muted-foreground">
            Windows 10 version 1809 or later, 64-bit &middot; Free download &middot; Updates install
            automatically
          </p>
        </div>
      </section>

      {/* Why the desktop app */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold mb-2">{title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Get started */}
      <section className="border-y border-border/50 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Get started in three steps
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold mb-1.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Databases */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-3">Works with the databases you use</h2>
        <p className="text-muted-foreground mb-8">
          Connect as many as you need. Each query runs directly from your computer.
        </p>
        <ul className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
          {DATABASES.map((name) => (
            <li
              key={name}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium"
            >
              {name}
            </li>
          ))}
        </ul>
      </section>

      {/* For companies */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="card p-8 md:p-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-2 text-primary font-medium text-sm mb-3">
              <Users className="w-4 h-4" />
              For companies
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-3">One plan for your whole team</h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              Buy Pro or Enterprise, create a team under Settings, Team, and invite your colleagues.
              Everyone who accepts uses your plan in the desktop app and on the website: up to 5
              colleagues on Pro, and unlimited on Enterprise.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mt-4">
              Microsoft Store blocked on your work PCs? Your IT team can install NatureQuery with
              Microsoft Intune, or with this command:
            </p>
            <code className="mt-3 block w-fit max-w-full overflow-x-auto whitespace-nowrap rounded-md border border-border bg-secondary/60 px-3 py-2 font-mono text-sm">
              winget install 9N6PJDWJRLFM -s msstore
            </code>
          </div>
          <Link href="/pricing" className="btn-primary text-sm px-6 py-2.5 justify-self-start">
            See plans
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Questions */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold tracking-tight mb-6 text-center">Questions</h2>
        <dl className="space-y-6">
          {QUESTIONS.map(({ question, answer }) => (
            <div key={question}>
              <dt className="font-semibold mb-1.5">{question}</dt>
              <dd className="text-muted-foreground leading-relaxed">{answer}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-muted-foreground text-center">
          Read more in the{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
        <div className="mt-10 flex justify-center">
          <StoreBadge />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size="xs" showText={false} />
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} NatureQuery. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
