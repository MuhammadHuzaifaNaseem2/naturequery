import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  Sparkles,
  Database,
  MessageSquare,
  Brain,
  Wand2,
  Search,
  FileSpreadsheet,
  AlignLeft,
  LayoutTemplate,
  UploadCloud,
  Filter,
  Pin,
  Clock,
  Share2,
  Users,
  ShieldCheck,
  KeyRound,
  ScrollText,
  Lock,
  Zap,
  ArrowRight,
  Check,
  BarChart3,
  Globe,
  Eye,
  Lightbulb,
  Table2,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Features - Everything NatureQuery Offers',
  description: 'Explore all NatureQuery features: AI-powered SQL generation, conversational follow-ups, chain-of-thought reasoning, multi-database support, team collaboration, and enterprise security.',
}

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

interface FeatureSection {
  id: string
  badge: string
  badgeIcon: LucideIcon
  title: string
  subtitle: string
  features: Feature[]
}

const SECTIONS: FeatureSection[] = [
  {
    id: 'ai',
    badge: 'Core AI Engine',
    badgeIcon: Sparkles,
    title: 'AI that actually understands your data',
    subtitle: 'Ask questions in plain English. Get production-ready SQL in seconds, not hours.',
    features: [
      {
        icon: Sparkles,
        title: 'Natural Language to SQL',
        description: 'Type "show me top customers by revenue" and get optimized, join-aware SQL instantly. No SQL knowledge needed.',
      },
      {
        icon: MessageSquare,
        title: 'Conversational Follow-ups',
        description: 'Refine results naturally. Say "filter to New York" or "break down by month" — the AI modifies your previous query contextually.',
      },
      {
        icon: Brain,
        title: 'Chain-of-Thought Reasoning',
        description: 'Watch the AI think step-by-step in real time. See which tables it picks, how it plans JOINs, and why it chose that approach.',
      },
      {
        icon: Lightbulb,
        title: 'AI Schema Discovery',
        description: 'Connect a database and instantly get suggested questions. The AI analyzes your schema and proposes the most useful queries.',
      },
      {
        icon: Wand2,
        title: 'AI Fix It',
        description: 'Query failed? One click and the AI analyzes the error, fixes the SQL, and retries. Turns frustration into a solved problem.',
      },
      {
        icon: Eye,
        title: 'SQL Explanation',
        description: 'Click "Explain" on any generated SQL and get a plain-English breakdown. Understand exactly what the query does before running it.',
      },
    ],
  },
  {
    id: 'data-tools',
    badge: 'Data Tools',
    badgeIcon: Table2,
    title: 'Professional tools for serious analysis',
    subtitle: 'Everything you need to explore, format, filter, and export your query results.',
    features: [
      {
        icon: Filter,
        title: 'Column Filters & Search',
        description: 'Global search across all results. Per-column filters with smart type detection — text search for strings, min/max ranges for numbers.',
      },
      {
        icon: AlignLeft,
        title: 'SQL Auto-Formatter',
        description: 'One-click SQL beautification. Messy AI output becomes perfectly indented, readable SQL with proper keyword casing.',
      },
      {
        icon: FileSpreadsheet,
        title: 'Export to Excel & CSV',
        description: 'Download results as formatted Excel spreadsheets or CSV files. Headers, data types, and formatting preserved automatically.',
      },
      {
        icon: UploadCloud,
        title: 'Magic CSV Upload',
        description: 'Drag and drop any CSV file. We auto-create a database table, infer column types, and you can query it immediately with AI.',
      },
      {
        icon: LayoutTemplate,
        title: 'Custom Query Templates',
        description: 'Save your best queries as reusable templates. Organize by category — analytics, sales, inventory, or create your own.',
      },
      {
        icon: BarChart3,
        title: 'Auto Visualizations',
        description: 'Results automatically generate bar, line, and pie charts. The AI recommends the best chart type based on your data shape.',
      },
    ],
  },
  {
    id: 'dashboards',
    badge: 'Dashboards & Automation',
    badgeIcon: Pin,
    title: 'From query to dashboard in one click',
    subtitle: 'Pin results, schedule refreshes, and share insights with your team — no BI tool needed.',
    features: [
      {
        icon: Pin,
        title: 'Pin to Dashboard',
        description: 'Turn any query result into a live dashboard widget. Drag to reorder, resize, and build your custom analytics view.',
      },
      {
        icon: Clock,
        title: 'Scheduled Queries',
        description: 'Run queries on autopilot — hourly, daily, weekly, or monthly. Get results delivered to your inbox automatically.',
      },
      {
        icon: Share2,
        title: 'Shared Query Links',
        description: 'Generate a secure link to share any query result with colleagues. They see the data without needing an account.',
      },
      {
        icon: RefreshCw,
        title: 'Live Refresh',
        description: 'Dashboard widgets refresh on demand or on schedule. Always see the latest data without re-running queries manually.',
      },
    ],
  },
  {
    id: 'enterprise',
    badge: 'Enterprise Ready',
    badgeIcon: Database,
    title: 'Built for teams that move fast',
    subtitle: 'Multi-database, multi-team, multi-language — scale from solo analyst to entire organization.',
    features: [
      {
        icon: Database,
        title: 'Multi-Database Support',
        description: 'PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, Redshift — connect any database. Switch between them seamlessly.',
      },
      {
        icon: Users,
        title: 'Team Collaboration',
        description: 'Create teams, invite members with role-based access (owner, admin, member). Share connections and saved queries.',
      },
      {
        icon: KeyRound,
        title: 'API Access',
        description: 'Full REST API with key-based authentication. Integrate NatureQuery into your existing tools, scripts, and workflows.',
      },
      {
        icon: Globe,
        title: 'Multi-Language UI',
        description: 'Interface available in English, Spanish, French, German, and more. Each user picks their preferred language.',
      },
    ],
  },
  {
    id: 'security',
    badge: 'Security & Compliance',
    badgeIcon: ShieldCheck,
    title: 'Enterprise-grade security, built in',
    subtitle: 'Your database credentials and data are protected by multiple layers of security.',
    features: [
      {
        icon: Lock,
        title: 'AES-256-GCM Encryption',
        description: 'All database credentials encrypted at rest with AES-256-GCM. Key rotation supported with zero downtime.',
      },
      {
        icon: ShieldCheck,
        title: 'Two-Factor Authentication',
        description: 'TOTP-based 2FA with any authenticator app. Backup codes provided for account recovery. 60-second tolerance window.',
      },
      {
        icon: ScrollText,
        title: 'Immutable Audit Logs',
        description: 'Every login, query, and admin action recorded in a tamper-proof hash chain. Full compliance trail for SOC 2 and GDPR.',
      },
      {
        icon: Zap,
        title: 'SQL Injection Prevention',
        description: 'AST-based SQL validation for PostgreSQL. Keyword blocklist defense for all dialects. Only SELECT queries ever reach your database.',
      },
      {
        icon: Search,
        title: 'Rate Limiting',
        description: 'Distributed rate limiting via Redis. Per-user, per-endpoint throttling prevents abuse and protects your databases.',
      },
      {
        icon: KeyRound,
        title: 'Security Headers',
        description: 'CSP, X-Frame-Options, HSTS, and Permissions-Policy headers on every response. A+ security rating out of the box.',
      },
    ],
  },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '50 queries / month',
      '1 database connection',
      'Excel & CSV export',
      '30-day query history',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/ month',
    features: [
      'Unlimited queries',
      '10 database connections',
      'Team collaboration (5 members)',
      'Dashboard widgets',
      'Scheduled queries',
      'API access',
      'Priority support',
    ],
    cta: 'Start 7-Day Free Trial',
    href: '/register?plan=pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/ month',
    features: [
      'Everything in Pro',
      'Unlimited connections',
      'Unlimited team members',
      'Audit logs & compliance',
      'GDPR data export',
      'Custom integrations',
      'Dedicated support & SLA',
    ],
    cta: 'Contact Sales',
    href: '/register?plan=enterprise',
    highlighted: false,
  },
]

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Nav() {
  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <AppLogo size="md" />
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/features" className="text-sm text-foreground font-medium">Features</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
          <Link href="/register" className="btn-primary text-sm py-2">
            Get Started Free
          </Link>
        </div>
        <div className="md:hidden flex items-center gap-3">
          <Link href="/login" className="btn-ghost text-sm py-2">Sign In</Link>
          <Link href="/register" className="btn-primary text-sm py-2">Sign Up</Link>
        </div>
      </div>
    </nav>
  )
}

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <div className="group relative p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold text-base mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

function SectionBlock({ section, index }: { section: FeatureSection; index: number }) {
  const BadgeIcon = section.badgeIcon
  const isWide = section.features.length <= 4

  return (
    <section id={section.id} className={`py-20 ${index % 2 === 1 ? 'bg-secondary/30' : ''}`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <BadgeIcon className="w-3.5 h-3.5" />
            {section.badge}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{section.title}</h2>
          <p className="text-muted-foreground text-lg">{section.subtitle}</p>
        </div>
        <div className={`grid gap-5 ${isWide ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {section.features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
          <p className="text-muted-foreground text-lg">Start free. Upgrade when you need more power.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                plan.highlighted
                  ? 'border-primary bg-card shadow-xl shadow-primary/10 scale-[1.02]'
                  : 'border-border/60 bg-card hover:border-border'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
          <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to talk to your database?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Start asking questions in plain English. No credit card required. Set up in under 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-colors shadow-lg"
              >
                Start Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-3 text-white/90 font-medium rounded-xl border border-white/20 hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AppLogo size="xs" showText={false} />
          <span className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} NatureQuery. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Stat bar
// ---------------------------------------------------------------------------

const STATS = [
  { value: '6+', label: 'Database Types' },
  { value: '30+', label: 'Features' },
  { value: '<2s', label: 'Avg Response' },
  { value: '256-bit', label: 'Encryption' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Platform Overview
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Everything you need to
              <span className="gradient-text block">talk to your database</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              From AI-powered SQL generation to enterprise security — NatureQuery gives your team the tools to explore data without writing a single line of SQL.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="btn-primary text-base px-8 py-3 shadow-lg">
                Start Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#ai" className="btn-secondary text-base px-8 py-3">
                Explore Features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature quick nav */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
            {SECTIONS.map((section) => {
              const Icon = section.badgeIcon
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {section.badge}
                </a>
              )
            })}
            <a
              href="#pricing"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />
              Pricing
            </a>
          </div>
        </div>
      </div>

      {/* Feature sections */}
      {SECTIONS.map((section, index) => (
        <SectionBlock key={section.id} section={section} index={index} />
      ))}

      {/* Pricing */}
      <PricingSection />

      {/* Final CTA */}
      <CtaSection />

      {/* Footer */}
      <Footer />
    </div>
  )
}
