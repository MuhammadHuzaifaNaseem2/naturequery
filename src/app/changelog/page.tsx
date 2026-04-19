import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  Sparkles,
  Shield,
  Zap,
  Database,
  Users,
  BarChart3,
  ArrowRight,
  Tag,
  Rocket,
  Bug,
  Wrench,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Changelog - What\'s New',
  description: 'See the latest updates, improvements, and new features added to NatureQuery.',
}

type ChangeType = 'feature' | 'improvement' | 'fix' | 'security'

interface Change {
  type: ChangeType
  text: string
}

interface Release {
  version: string
  date: string
  title: string
  description: string
  icon: typeof Sparkles
  changes: Change[]
}

const TYPE_CONFIG: Record<ChangeType, { label: string; color: string; icon: typeof Sparkles }> = {
  feature: { label: 'New', color: 'bg-primary/10 text-primary', icon: Sparkles },
  improvement: { label: 'Improved', color: 'bg-accent/10 text-accent', icon: Zap },
  fix: { label: 'Fixed', color: 'bg-warning/10 text-warning', icon: Bug },
  security: { label: 'Security', color: 'bg-success/10 text-success', icon: Shield },
}

const RELEASES: Release[] = [
  {
    version: '1.3.0',
    date: 'Apr 2, 2026',
    title: 'Public Pages & Polish',
    description: 'New marketing pages, codebase cleanup, and UX refinements.',
    icon: Rocket,
    changes: [
      { type: 'feature', text: 'Added Features, Pricing, About, Contact, Changelog, and FAQ pages' },
      { type: 'feature', text: 'Delete confirmation modal for database connections' },
      { type: 'improvement', text: 'Schema auto-fetches on page refresh (no more "0 tables")' },
      { type: 'improvement', text: 'Cleaned up 15+ unused files and debug artifacts' },
      { type: 'improvement', text: 'Updated navigation links across all public pages' },
    ],
  },
  {
    version: '1.2.0',
    date: 'Mar 25, 2026',
    title: 'Conversational Follow-ups',
    description: 'Ask follow-up questions — NatureQuery remembers context from previous queries.',
    icon: Sparkles,
    changes: [
      { type: 'feature', text: 'Multi-turn conversation context (up to 5 previous queries)' },
      { type: 'feature', text: 'Conversation indicator with "New thread" reset button' },
      { type: 'feature', text: 'Context-aware streaming mode with Chain-of-Thought' },
      { type: 'improvement', text: 'Smarter schema filtering using conversation history terms' },
      { type: 'improvement', text: 'Per-connection conversation tracking' },
    ],
  },
  {
    version: '1.1.0',
    date: 'Mar 15, 2026',
    title: 'Enterprise Hardening',
    description: 'Security headers, RBAC, rate limiting, Redis caching, and GDPR compliance.',
    icon: Shield,
    changes: [
      { type: 'security', text: 'CSP, HSTS, X-Frame-Options, and other security headers' },
      { type: 'feature', text: 'Role-based access control (Owner, Admin, Member, Viewer)' },
      { type: 'feature', text: 'GDPR data export endpoint for user data' },
      { type: 'feature', text: 'Redis caching layer with in-memory fallback' },
      { type: 'improvement', text: 'Query-per-minute rate limiting per user' },
      { type: 'improvement', text: 'PgBouncer connection pooling support' },
    ],
  },
  {
    version: '1.0.0',
    date: 'Coming Soon',
    title: 'Public Launch',
    description: 'NatureQuery launches with 30+ features, 6 database types, and a 7-day free trial. Stay tuned!',
    icon: Rocket,
    changes: [
      { type: 'feature', text: 'Natural language to SQL generation powered by Groq Llama 3.3' },
      { type: 'feature', text: 'Support for PostgreSQL, MySQL, SQLite, SQL Server, Oracle, and MariaDB' },
      { type: 'feature', text: 'Two-factor authentication with TOTP and backup codes' },
      { type: 'feature', text: 'Team collaboration with shared connections and queries' },
      { type: 'feature', text: 'Stripe billing with Free, Pro, and Enterprise plans' },
      { type: 'feature', text: 'CSV/JSON/PDF export and Magic CSV Upload' },
      { type: 'feature', text: 'Audit logging, query history, and saved queries' },
      { type: 'security', text: 'AES-256 encryption for stored credentials' },
      { type: 'security', text: 'Row-level security and plan-based access limits' },
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size="md" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="btn-primary text-sm py-2">Get Started Free</Link>
          </div>
          <div className="md:hidden flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm py-2">Sign In</Link>
            <Link href="/register" className="btn-primary text-sm py-2">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-10 relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Tag className="w-3.5 h-3.5" />
            Changelog
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            What&apos;s new in
            <span className="gradient-text"> NatureQuery</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We ship fast and often. Here&apos;s everything we&apos;ve been working on.
          </p>
        </div>
      </section>

      {/* Releases */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border hidden sm:block" />

            <div className="space-y-12">
              {RELEASES.map((release, i) => {
                const ReleaseIcon = release.icon
                return (
                  <div key={release.version} className="relative">
                    {/* Timeline dot */}
                    <div className="hidden sm:flex absolute left-0 top-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                        i === 0
                          ? 'bg-primary text-white shadow-lg shadow-primary/30'
                          : 'bg-card border-2 border-border'
                      }`}>
                        <ReleaseIcon className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="sm:pl-16">
                      <div className="bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide">
                            v{release.version}
                          </span>
                          <span className="text-xs text-muted-foreground">{release.date}</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1">{release.title}</h3>
                        <p className="text-sm text-muted-foreground mb-5">{release.description}</p>

                        {/* Changes */}
                        <div className="space-y-2.5">
                          {release.changes.map((change, j) => {
                            const config = TYPE_CONFIG[change.type]
                            const ChangeIcon = config.icon
                            return (
                              <div key={j} className="flex items-start gap-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 mt-0.5 ${config.color}`}>
                                  <ChangeIcon className="w-3 h-3" />
                                  {config.label}
                                </span>
                                <span className="text-sm text-foreground/90">{change.text}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-card border border-border rounded-2xl p-10">
            <Wrench className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">Want to see what&apos;s next?</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              We&apos;re always building. Start your free trial and be the first to experience new features.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className="btn-primary text-sm py-2.5 px-6">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/contact" className="btn-secondary text-sm py-2.5 px-6">
                Request a Feature
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size="xs" showText={false} />
            <span className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} NatureQuery. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
