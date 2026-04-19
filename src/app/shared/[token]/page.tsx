import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { AppLogo } from '@/components/AppLogo'
import { Code2, Tag, Database, User, Calendar, Sparkles } from 'lucide-react'
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

  if (!query) return { title: 'Query Not Found — NatureQuery' }

  return {
    title: `${query.name} — Shared Query | NatureQuery`,
    description: query.question,
    openGraph: {
      title: `${query.name} — Shared via NatureQuery`,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo size="md" />
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try NatureQuery Free
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{query.name}</h1>
          {query.description && (
            <p className="text-muted-foreground">{query.description}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
            {query.user && (
              <div className="flex items-center gap-1.5">
                {query.user.image ? (
                  <img src={query.user.image} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span>{query.user.name || 'Anonymous'}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{new Date(query.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            {query.connectionName && (
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4" />
                <span>{query.connectionName}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {query.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {query.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Natural Language Question */}
        <div className="mb-6 p-5 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold">Natural Language Question</h2>
          </div>
          <p className="text-foreground/80 text-lg leading-relaxed">{query.question}</p>
        </div>

        {/* SQL Query */}
        <div className="p-5 bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Code2 className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold">Generated SQL</h2>
            </div>
            <CopyButton text={query.sql} label="Copy SQL" />
          </div>
          <pre className="p-4 bg-secondary/50 border border-border rounded-lg overflow-x-auto text-sm font-mono text-foreground whitespace-pre-wrap">
            {query.sql}
          </pre>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center p-8 bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">Convert plain English to SQL instantly</h3>
          <p className="text-muted-foreground mb-6">
            NatureQuery lets you query any database using natural language. No SQL knowledge required.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Get Started Free
          </Link>
        </div>
      </main>
    </div>
  )
}
