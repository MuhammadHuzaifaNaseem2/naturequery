import { brandFonts } from '@/app/fonts'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { AppLogo } from '@/components/AppLogo'
import { CopyButton } from './CopyButton'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const query = await prisma.savedQuery.findUnique({
    where: { shareToken: token },
    select: { name: true, question: true },
  })

  if (!query) return { title: 'Query Not Found' }

  return {
    title: `${query.name} | Shared Query`,
    description: query.question,
    openGraph: {
      title: `${query.name} | Shared via NatureQuery`,
      description: query.question,
      type: 'article',
    },
  }
}

export default async function SharedQueryPage({ params }: Props) {
  const { token } = await params

  const query = await prisma.savedQuery.findUnique({
    where: { shareToken: token },
    include: {
      user: { select: { name: true, image: true } },
    },
  })

  if (!query || !query.isPublic) notFound()

  const created = new Date(query.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className={`mk ${brandFonts} min-h-screen`}>
      {/* Header */}
      <header className="border-b border-mk-rule">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="NatureQuery home">
            <AppLogo size="sm" textClassName="text-[15px] font-semibold tracking-[-0.01em]" />
          </Link>
          <Link href="/register" className="mk-btn mk-btn-sm mk-btn-primary">
            Try NatureQuery free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        {/* Title */}
        <p className="mk-label">Shared query</p>
        <h1 className="mt-4 text-balance font-nq-serif text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
          {query.name}
        </h1>
        {query.description && (
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-mk-ink-2">
            {query.description}
          </p>
        )}

        <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-nq-mono text-[0.75rem] text-mk-ink-3">
          {query.user && <span>Shared by {query.user.name || 'a NatureQuery user'}</span>}
          <span>{created}</span>
          {query.connectionName && <span>{query.connectionName}</span>}
          {query.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>

        {/* The question */}
        <section className="mt-12 border-t border-mk-rule pt-8" aria-labelledby="shared-question">
          <p id="shared-question" className="mk-label">
            <span className="text-mk-violet">01</span> The question
          </p>
          <p className="mt-4 font-nq-serif text-[clamp(1.4rem,2.6vw,1.85rem)] italic leading-snug text-mk-ink">
            &ldquo;{query.question}&rdquo;
          </p>
        </section>

        {/* The SQL */}
        <section className="mt-12" aria-labelledby="shared-sql">
          <div className="flex items-end justify-between gap-4">
            <p id="shared-sql" className="mk-label">
              <span className="text-mk-violet">02</span> The SQL NatureQuery wrote
            </p>
            <CopyButton text={query.sql} label="Copy SQL" />
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-mk-rule bg-mk-surface p-5 font-nq-mono text-[0.85rem] leading-relaxed text-mk-ink [font-variant-ligatures:none]">
            {query.sql}
          </pre>
          <p className="mt-3 text-sm text-mk-ink-3">
            NatureQuery only runs read-only SQL like this, and checks it before it runs.
          </p>
        </section>

        {/* Invitation */}
        <section className="mt-16 border-t border-mk-rule pt-10">
          <h2 className="max-w-2xl text-balance font-nq-serif text-[clamp(1.8rem,3.6vw,2.6rem)] font-normal italic leading-[1.08] tracking-[-0.02em] text-mk-ink">
            Ask your own database a question.
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-mk-ink-2">
            Type it in plain English. NatureQuery writes the SQL, runs it read-only and shows the
            answer. Free for 50 questions a month.
          </p>
          <Link href="/register" className="mk-btn mk-btn-primary mt-7">
            Start free
          </Link>
        </section>
      </main>
    </div>
  )
}
