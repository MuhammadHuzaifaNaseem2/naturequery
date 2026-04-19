import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  Sparkles,
  Database,
  FileSpreadsheet,
  Shield,
  Users,
  Zap,
  ArrowRight,
  Check,
  BarChart3,
  Globe,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Natural Language to SQL',
    description: 'Ask questions in plain English. Our AI converts them to optimized SQL queries instantly.',
  },
  {
    icon: Database,
    title: 'Multi-Database Support',
    description: 'Connect to PostgreSQL, MySQL, or SQLite. Switch between databases seamlessly.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Export to Excel & CSV',
    description: 'Download query results as formatted Excel spreadsheets or CSV files with one click.',
  },
  {
    icon: BarChart3,
    title: 'Data Visualization',
    description: 'Auto-generate bar, line, and pie charts from your query results. No configuration needed.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Create teams, invite members, share connections and saved queries with role-based access.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'AES-256 encryption, audit logging, API key management, and rate limiting built in.',
  },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For individuals exploring their data',
    features: [
      '50 queries per month',
      '1 database connection',
      'Excel & CSV export',
      'Query history (30 days)',
    ],
    cta: 'Get Started',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For professionals and small teams',
    features: [
      'Unlimited queries',
      '10 database connections',
      'Team collaboration (5 members)',
      'Data visualization',
      'Saved queries & bookmarks',
      'API access',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    href: '/register?plan=pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: 'per month',
    description: 'For organizations with advanced needs',
    features: [
      'Everything in Pro',
      'Unlimited connections & members',
      'SSO / SAML',
      'Audit log & compliance',
      'Custom AI models',
      'Dedicated support & SLA',
    ],
    cta: 'Contact Sales',
    href: '/register?plan=enterprise',
    highlighted: false,
  },
]

const STATS = [
  { value: 'AI', label: 'Powered by Groq Llama 3.3' },
  { value: '3+', label: 'Database Types' },
  { value: 'Free', label: 'to Get Started' },
  { value: '<2s', label: 'Avg Response Time' },
]

export const metadata: Metadata = {
  title: 'NatureQuery - Natural Language to SQL',
  description: 'Ask questions in plain English and get instant SQL queries with AI-powered insights. Connect to PostgreSQL, MySQL, or SQLite.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/"><AppLogo size="md" /></Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              No SQL knowledge required
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Ask your database
              <span className="gradient-text block">in plain English</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              NatureQuery converts natural language questions into SQL queries, executes them on your database, and exports the results — no SQL knowledge required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="btn-primary text-base px-8 py-3 shadow-lg glow-primary">
                Start Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#features" className="btn-secondary text-base px-8 py-3">
                See How It Works
              </a>
            </div>
          </div>

          {/* Demo Preview */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="card p-1 shadow-2xl">
              <div className="bg-secondary rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">NatureQuery Dashboard</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Your question:</p>
                    <p className="font-medium">&quot;Show me the top 10 customers by total order value this year&quot;</p>
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border font-mono text-sm">
                    <p className="text-muted-foreground mb-1">Generated SQL:</p>
                    <p><span className="text-primary font-semibold">SELECT</span> c.name, <span className="text-primary font-semibold">SUM</span>(o.amount) <span className="text-primary font-semibold">AS</span> total</p>
                    <p><span className="text-primary font-semibold">FROM</span> customers c <span className="text-primary font-semibold">JOIN</span> orders o <span className="text-primary font-semibold">ON</span> c.id = o.customer_id</p>
                    <p><span className="text-primary font-semibold">WHERE</span> o.order_date &gt;= <span className="text-green-500">&apos;2026-01-01&apos;</span></p>
                    <p><span className="text-primary font-semibold">GROUP BY</span> c.name <span className="text-primary font-semibold">ORDER BY</span> total <span className="text-primary font-semibold">DESC LIMIT</span> <span className="text-orange-500">10</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to query your data</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From natural language processing to enterprise security, NatureQuery has you covered.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card p-6 hover-lift">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-card/50 border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-lg text-muted-foreground">Three steps to go from question to insight</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: Globe, title: 'Connect Your Database', description: 'Securely connect to PostgreSQL, MySQL, or SQLite. Your credentials are encrypted with AES-256.' },
              { step: '2', icon: Sparkles, title: 'Ask in Plain English', description: 'Type your question naturally. Our AI understands your schema and generates optimized SQL.' },
              { step: '3', icon: FileSpreadsheet, title: 'Get Results & Export', description: 'View results in tables or charts. Export to Excel or CSV with one click.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Start free, upgrade when you need more</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`card p-6 flex flex-col ${plan.highlighted ? 'ring-2 ring-primary shadow-lg relative' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={plan.highlighted ? 'btn-primary w-full' : 'btn-secondary w-full'}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to talk to your database?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of teams using NatureQuery to get insights from their data in seconds.
          </p>
          <Link href="/register" className="btn-primary text-base px-8 py-3 shadow-lg glow-primary">
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="mb-3 inline-flex"><AppLogo size="sm" /></Link>
              <p className="text-sm text-muted-foreground">Natural language to SQL, made simple.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/changelog" className="hover:text-foreground transition-colors">Changelog</Link></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><a href="mailto:support@naturequery.com" className="hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-xs text-muted-foreground">
            &copy; 2026 NatureQuery. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
