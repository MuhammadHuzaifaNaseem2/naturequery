'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const CATEGORIES = ['All', 'Getting started', 'Features', 'Security', 'Billing', 'Teams']

const FAQ_ITEMS: FAQItem[] = [
  {
    category: 'Getting started',
    question: 'What is NatureQuery?',
    answer:
      'NatureQuery lets you query your databases in plain English. Instead of writing SQL, you type a question like "How many users signed up last week?" and NatureQuery writes read-only SQL, runs it and shows you the answer.',
  },
  {
    category: 'Getting started',
    question: 'Which databases are supported?',
    answer:
      'PostgreSQL, MySQL, MariaDB, SQL Server, Oracle, SQLite, Amazon Redshift, BigQuery, Snowflake, CockroachDB, ClickHouse, Neon, Supabase, PlanetScale and MongoDB. You can also upload CSV and Excel files, with no data migration or ETL. NatureQuery Desktop also connects to Turso, DynamoDB, Firestore and Cassandra.',
  },
  {
    category: 'Getting started',
    question: 'How do I get started?',
    answer:
      'Sign up for a free account, connect your database or try the demo database, and start asking questions in plain English. Setup takes a few minutes, and no credit card is needed.',
  },
  {
    category: 'Getting started',
    question: 'Do I need to know SQL?',
    answer:
      "No, that's the point. NatureQuery turns your questions into SQL for you. You can always see the SQL it wrote, to learn from it or to check it.",
  },
  {
    category: 'Getting started',
    question: 'Is there a desktop app?',
    answer:
      'Yes. NatureQuery Desktop for Windows is free in the Microsoft Store. It connects to databases on your own computer or office network that a website cannot reach, and uses the same account and plan.',
  },
  {
    category: 'Features',
    question: 'How accurate is the SQL?',
    answer:
      'NatureQuery reads your actual schema (tables, columns, types and keys) and writes SQL for your specific database, which makes it accurate for most everyday questions. For complex joins or edge cases, review and edit the SQL before you rely on it. Explain describes any query in plain English to help.',
  },
  {
    category: 'Features',
    question: 'What are follow-up questions?',
    answer:
      'NatureQuery remembers your recent questions, so after "Show me top customers" you can ask "Now only last month" without repeating yourself. It changes the query it just wrote.',
  },
  {
    category: 'Features',
    question: 'Can I export results?',
    answer:
      'Yes, as Excel or CSV files. Pro and Enterprise plans can also schedule queries and email the results.',
  },
  {
    category: 'Features',
    question: 'Can I ask questions about a spreadsheet?',
    answer:
      'Yes. Upload a CSV or Excel file and NatureQuery creates a table from it, works out the column types and lets you ask questions straight away. No database setup needed.',
  },
  {
    category: 'Features',
    question: 'Can I see how it reasons?',
    answer:
      'Yes. NatureQuery can show its reasoning step by step while it writes the SQL: which tables it considers, how it reads your question, and why it chose its approach.',
  },
  {
    category: 'Security',
    question: 'Is my database data safe?',
    answer:
      'Every query is checked to be read-only before it runs, so NatureQuery cannot change your data. Database credentials are encrypted with AES-256-GCM, and you can also connect with a read-only database user. Results are cached for a few minutes to speed up repeated queries, then expire.',
  },
  {
    category: 'Security',
    question: 'Do you support two-factor sign-in?',
    answer:
      'Yes. Use any authenticator app, such as Google Authenticator or Authy, plus backup codes for recovery.',
  },
  {
    category: 'Security',
    question: 'What does the AI see?',
    answer:
      'To write a query, the AI sees your question and the structure of your tables (names, columns and types), not the rows in them. AI Insights sends a few sample rows and column statistics, and desktop summaries can include result rows only if you turn that on. The privacy policy lists each case.',
  },
  {
    category: 'Billing',
    question: 'Is there a free plan?',
    answer:
      'Yes. The Free plan includes 50 AI questions a month, 1 database connection and the core features, with no credit card. Upgrade any time.',
  },
  {
    category: 'Billing',
    question: 'Can I cancel any time?',
    answer:
      'Yes. Cancel your Pro or Enterprise subscription from your billing settings whenever you like. You keep access until the end of the period you paid for.',
  },
  {
    category: 'Billing',
    question: 'Can I change plans?',
    answer:
      'Yes. Upgrade, downgrade or cancel from your billing settings. Downgrades take effect at the end of your current billing period, and there are no cancellation fees.',
  },
  {
    category: 'Teams',
    question: 'Does one plan cover my whole team?',
    answer:
      'Yes. Create a team under Settings, Team and invite colleagues. Everyone who accepts uses your plan on the website and in NatureQuery Desktop: up to 5 people on Pro, and unlimited on Enterprise.',
  },
  {
    category: 'Teams',
    question: 'What does the Enterprise plan include?',
    answer:
      'Unlimited AI questions, unlimited connections and team members, roles, audit logs, and dedicated support with an SLA.',
  },
  {
    category: 'Teams',
    question: 'Can we run NatureQuery inside our own network?',
    answer:
      'NatureQuery Desktop runs on your own PCs and connects directly to databases on your network, so they never need to be exposed to the internet. Connection passwords stay on each computer.',
  },
  {
    category: 'Teams',
    question: "Can I manage my team's access?",
    answer:
      'Yes. Pro and Enterprise teams have Owner, Admin, Member and Viewer roles that decide who can invite people, manage connections and run queries.',
  },
]

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const items = FAQ_ITEMS.filter(
    (item) =>
      (activeCategory === 'All' || item.category === activeCategory) &&
      (!query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query))
  )

  return (
    <MarketingShell>
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">Questions</p>
        <h1 className="mt-5 max-w-4xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.9rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          Answers about NatureQuery.
        </h1>
        <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-mk-ink-2">
          Can&apos;t find yours?{' '}
          <Link href="/contact" className="mk-link">
            Write to us
          </Link>{' '}
          and we will answer.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-24 pt-12 sm:px-8 sm:pb-32 sm:pt-16">
        <div className="flex flex-col gap-6 border-b border-mk-ink/80 pb-5 md:flex-row md:items-end md:justify-between">
          <div role="tablist" aria-label="Topics" className="flex flex-wrap gap-x-6 gap-y-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                className="text-[0.9375rem] text-mk-ink-3 transition-colors hover:text-mk-ink aria-selected:font-medium aria-selected:text-mk-ink aria-selected:underline aria-selected:decoration-mk-violet aria-selected:decoration-2 aria-selected:underline-offset-8"
              >
                {category}
              </button>
            ))}
          </div>
          <label className="relative block md:w-72">
            <span className="sr-only">Search questions</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mk-ink-3"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions"
              className="h-10 w-full rounded-md border border-mk-rule bg-mk-surface pl-9 pr-3 text-[0.9375rem] text-mk-ink placeholder:text-mk-ink-3 focus:border-mk-violet focus:outline-none"
            />
          </label>
        </div>

        {items.length === 0 ? (
          <p className="py-16 text-mk-ink-2">
            No questions match &ldquo;{search}&rdquo;. Try another word, or{' '}
            <Link href="/contact" className="mk-link">
              ask us directly
            </Link>
            .
          </p>
        ) : (
          <div className="divide-y divide-mk-rule">
            {items.map((item, index) => (
              <details key={item.question} open={index === 0 && !query} className="group py-6">
                <summary className="grid cursor-pointer list-none gap-2 md:grid-cols-[12rem_1fr_auto] md:gap-10 [&::-webkit-details-marker]:hidden">
                  <span className="mk-label md:pt-2">{item.category}</span>
                  <span className="font-nq-serif text-[1.35rem] leading-snug text-mk-ink">
                    {item.question}
                  </span>
                  <span
                    aria-hidden
                    className="hidden font-nq-mono text-lg leading-none text-mk-violet transition-transform group-open:rotate-45 md:block md:pt-1.5"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[44rem] leading-relaxed text-mk-ink-2 md:ml-[calc(12rem+2.5rem)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        )}
      </section>
    </MarketingShell>
  )
}
