import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  Check,
  X,
  Zap,
  ArrowRight,
  HelpCircle,
  Sparkles,
  Shield,
  Users,
  Database,
  BarChart3,
  Clock,
  KeyRound,
  ScrollText,
  Globe,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing - Plans for Every Team',
  description: 'Simple, transparent pricing. Start free, upgrade when you need more power. No credit card required.',
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For individuals exploring their data',
    features: [
      { text: '50 queries per month', included: true },
      { text: '1 database connection', included: true },
      { text: 'Excel & CSV export', included: true },
      { text: 'Query history (30 days)', included: true },
      { text: 'Team collaboration (5 members)', included: false },
      { text: 'Data visualization', included: false },
      { text: 'Saved queries & bookmarks', included: false },
      { text: 'API access', included: false },
      { text: 'Priority support', included: false },
      { text: 'Custom AI models', included: false },
    ],
    cta: 'Get Started Free',
    href: '/register',
    highlighted: false,
    badge: null,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For professionals and growing teams',
    features: [
      { text: 'Unlimited queries', included: true },
      { text: '10 database connections', included: true },
      { text: 'Excel & CSV export', included: true },
      { text: 'Team collaboration (5 members)', included: true },
      { text: 'Data visualization', included: true },
      { text: 'Saved queries & bookmarks', included: true },
      { text: 'API access', included: true },
      { text: 'Priority support', included: true },
      { text: 'SSO / SAML', included: false },
      { text: 'Custom AI models', included: false },
    ],
    cta: 'Start 7-Day Free Trial',
    href: '/register?plan=pro',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    description: 'For organizations with advanced needs',
    features: [
      { text: 'Unlimited queries', included: true },
      { text: 'Unlimited connections & members', included: true },
      { text: 'Everything in Pro', included: true },
      { text: 'SSO / SAML', included: true },
      { text: 'Audit log & compliance', included: true },
      { text: 'Custom AI models', included: true },
      { text: 'Dedicated support & SLA', included: true },
    ],
    cta: 'Contact Sales',
    href: '/register?plan=enterprise',
    highlighted: false,
    badge: null,
  },
]

const COMPARISON = [
  { category: 'AI Features', features: [
    { name: 'Natural Language to SQL', free: true, pro: true, enterprise: true },
    { name: 'Conversational Follow-ups', free: true, pro: true, enterprise: true },
    { name: 'Chain-of-Thought Reasoning', free: true, pro: true, enterprise: true },
    { name: 'AI Fix It', free: true, pro: true, enterprise: true },
    { name: 'AI Schema Discovery', free: true, pro: true, enterprise: true },
    { name: 'SQL Explanation', free: true, pro: true, enterprise: true },
  ]},
  { category: 'Data & Export', features: [
    { name: 'Queries per month', free: '50', pro: 'Unlimited', enterprise: 'Unlimited' },
    { name: 'Database connections', free: '1', pro: '10', enterprise: 'Unlimited' },
    { name: 'Excel & CSV export', free: true, pro: true, enterprise: true },
    { name: 'Column filters & search', free: true, pro: true, enterprise: true },
    { name: 'Query history', free: '30 days', pro: 'Unlimited', enterprise: 'Unlimited' },
    { name: 'Magic CSV Upload', free: true, pro: true, enterprise: true },
  ]},
  { category: 'Dashboards', features: [
    { name: 'Pin to dashboard', free: false, pro: true, enterprise: true },
    { name: 'Scheduled queries', free: false, pro: true, enterprise: true },
    { name: 'Shared query links', free: false, pro: true, enterprise: true },
    { name: 'Auto visualizations', free: true, pro: true, enterprise: true },
  ]},
  { category: 'Team & Admin', features: [
    { name: 'Team members', free: false, pro: '5', enterprise: 'Unlimited' },
    { name: 'Role-based access', free: false, pro: true, enterprise: true },
    { name: 'API access', free: false, pro: true, enterprise: true },
    { name: 'Audit logs', free: false, pro: false, enterprise: true },
    { name: 'GDPR data export', free: false, pro: false, enterprise: true },
    { name: 'Dedicated support & SLA', free: false, pro: false, enterprise: true },
  ]},
  { category: 'Security', features: [
    { name: 'AES-256 encryption', free: true, pro: true, enterprise: true },
    { name: 'Two-factor auth (2FA)', free: true, pro: true, enterprise: true },
    { name: 'SQL injection prevention', free: true, pro: true, enterprise: true },
    { name: 'Rate limiting', free: true, pro: true, enterprise: true },
  ]},
]

const FAQS = [
  {
    q: 'Can I try Pro before paying?',
    a: 'Yes! Every new account gets a 7-day free trial of Pro with no credit card required. You can downgrade to Free anytime.',
  },
  {
    q: 'What databases do you support?',
    a: 'PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, and Amazon Redshift. We\'re constantly adding more.',
  },
  {
    q: 'Can I change plans anytime?',
    a: 'Absolutely. Upgrade, downgrade, or cancel at any time. Changes take effect immediately with prorated billing.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. We use AES-256-GCM encryption for credentials, bcrypt for passwords, and never store your query results. All connections are encrypted in transit.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Annual billing is coming soon with a 20% discount. Sign up for monthly now and we\'ll automatically apply the discount when it launches.',
  },
  {
    q: 'What happens when my trial ends?',
    a: 'You\'ll be automatically moved to the Free plan. No charges, no data loss. You can upgrade to Pro whenever you\'re ready.',
  },
]

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium">{value}</span>
  }
  return value ? (
    <Check className="w-4.5 h-4.5 text-primary mx-auto" />
  ) : (
    <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
  )
}

export default function PricingPage() {
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
            <Link href="/pricing" className="text-sm text-foreground font-medium">Pricing</Link>
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
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-8 relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Simple Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            One tool, three plans,
            <span className="gradient-text block">zero surprises</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free with 50 queries/month. Upgrade to Pro for unlimited power. No credit card required.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 border flex flex-col transition-all duration-300 ${
                  plan.highlighted
                    ? 'border-primary bg-card shadow-xl shadow-primary/10 scale-[1.03]'
                    : 'border-border/60 bg-card hover:border-border hover:shadow-lg'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground/50'}>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? 'btn-primary shadow-lg'
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

      {/* Feature Comparison Table */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Compare plans in detail</h2>
            <p className="text-muted-foreground text-lg">Every feature, every plan, side by side.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-border bg-secondary/50">
              <div className="p-4" />
              <div className="p-4 text-center">
                <p className="font-semibold text-sm">Free</p>
                <p className="text-xs text-muted-foreground">$0/forever</p>
              </div>
              <div className="p-4 text-center bg-primary/5 border-x border-primary/10">
                <p className="font-semibold text-sm text-primary">Pro</p>
                <p className="text-xs text-muted-foreground">$29/month</p>
              </div>
              <div className="p-4 text-center">
                <p className="font-semibold text-sm">Enterprise</p>
                <p className="text-xs text-muted-foreground">$99/month</p>
              </div>
            </div>

            {/* Categories */}
            {COMPARISON.map((category) => (
              <div key={category.category}>
                <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category.category}</p>
                </div>
                {category.features.map((feature, i) => (
                  <div
                    key={feature.name}
                    className={`grid grid-cols-4 ${i < category.features.length - 1 ? 'border-b border-border/50' : 'border-b border-border'}`}
                  >
                    <div className="p-3.5 text-sm">{feature.name}</div>
                    <div className="p-3.5 text-center"><CellValue value={feature.free} /></div>
                    <div className="p-3.5 text-center bg-primary/[0.02] border-x border-primary/5"><CellValue value={feature.pro} /></div>
                    <div className="p-3.5 text-center"><CellValue value={feature.enterprise} /></div>
                  </div>
                ))}
              </div>
            ))}

            {/* Bottom CTA row */}
            <div className="grid grid-cols-4 bg-secondary/30">
              <div className="p-4" />
              <div className="p-4 text-center">
                <Link href="/register" className="btn-secondary text-xs py-2 px-4">Get Started</Link>
              </div>
              <div className="p-4 text-center bg-primary/5 border-x border-primary/10">
                <Link href="/register?plan=pro" className="btn-primary text-xs py-2 px-4">Start Trial</Link>
              </div>
              <div className="p-4 text-center">
                <Link href="/register?plan=enterprise" className="btn-secondary text-xs py-2 px-4">Contact Sales</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
              <HelpCircle className="w-3.5 h-3.5" />
              FAQ
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">Common questions</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="border border-border/60 rounded-xl p-5 bg-card hover:border-border transition-colors">
                <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
            <div className="relative px-8 py-16 sm:px-16 sm:py-20 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Start querying in under 2 minutes</h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                No credit card. No setup headaches. Just connect your database and start asking questions.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-colors shadow-lg"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
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
