import type { Metadata } from 'next'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  ArrowRight,
  Target,
  Heart,
  Lightbulb,
  Shield,
  Users,
  Zap,
  Globe,
  TrendingUp,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'About - Our Mission',
  description: 'NatureQuery makes database querying accessible to everyone. Learn about our mission, values, and the team behind the product.',
}

const VALUES = [
  {
    icon: Lightbulb,
    title: 'Simplicity First',
    description: 'We believe powerful tools should be easy to use. If it takes a manual to understand, we\'ve failed.',
  },
  {
    icon: Shield,
    title: 'Security by Default',
    description: 'Your data is sacred. AES-256 encryption, 2FA, and audit logs aren\'t add-ons — they\'re built into every layer.',
  },
  {
    icon: Heart,
    title: 'User Obsessed',
    description: 'Every feature starts with a real user problem. We ship fast, listen closely, and iterate relentlessly.',
  },
  {
    icon: Globe,
    title: 'Open & Transparent',
    description: 'Transparent pricing, no hidden fees, no vendor lock-in. Your data stays yours, always.',
  },
]

const MILESTONES = [
  { date: 'Jan 2026', title: 'Idea Born', description: 'Frustrated by writing SQL for non-technical teammates, the idea for NatureQuery was born.' },
  { date: 'Feb 2026', title: 'First Prototype', description: 'Built the core NL-to-SQL engine with Groq\'s Llama 3.3 model. First successful query generated.' },
  { date: 'Mar 2026', title: 'Enterprise Features', description: 'Added 2FA, audit logging, team collaboration, RBAC, and Stripe billing integration.' },
  { date: 'Coming Soon', title: 'Public Launch', description: 'Launching with 30+ features, 6 database types, and a 7-day free trial. Stay tuned!' },
]

const STATS = [
  { value: '30+', label: 'Features' },
  { value: '6', label: 'Database Types' },
  { value: '<2s', label: 'Avg Response' },
  { value: '24/7', label: 'Monitoring' },
]

export default function AboutPage() {
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
            <Link href="/about" className="text-sm text-foreground font-medium">About</Link>
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
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Target className="w-3.5 h-3.5" />
              Our Mission
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Making data accessible
              <span className="gradient-text block">to everyone</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
              We believe every team member — not just the SQL experts — should be able to ask questions and get answers from their company&apos;s data. NatureQuery bridges the gap between natural language and databases.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
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

      {/* The Problem */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-6">The problem we&apos;re solving</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  In most organizations, data lives in databases that only engineers can access. Product managers, analysts, and executives depend on engineering tickets to get simple answers — &quot;How many users signed up last week?&quot; becomes a 3-day turnaround.
                </p>
                <p>
                  Existing BI tools like Metabase or Retool require setup time, SQL knowledge, and ongoing maintenance. They&apos;re built for technical users who already know what they&apos;re looking for.
                </p>
                <p className="text-foreground font-medium">
                  NatureQuery is different. You type a question in plain English, and get the answer in seconds. No SQL. No dashboards to configure. No waiting on engineering.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-destructive font-bold text-sm">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1 line-through text-muted-foreground">Write a Jira ticket for data team</p>
                      <p className="text-xs text-muted-foreground">Wait 3-5 business days</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-destructive font-bold text-sm">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1 line-through text-muted-foreground">Learn SQL syntax and table structure</p>
                      <p className="text-xs text-muted-foreground">Ask someone what a JOIN is</p>
                    </div>
                  </div>
                  <div className="border-t border-border pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm mb-1 text-primary">Just ask NatureQuery</p>
                        <p className="text-xs text-muted-foreground">Get your answer in 2 seconds</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">What we stand for</h2>
            <p className="text-muted-foreground text-lg">The principles that guide every decision we make.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((value) => {
              const Icon = value.icon
              return (
                <div key={value.title} className="bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
              <TrendingUp className="w-3.5 h-3.5" />
              Our Journey
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">From idea to launch</h2>
          </div>

          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
            <div className="space-y-10">
              {MILESTONES.map((milestone, i) => (
                <div key={milestone.date} className="relative flex gap-6">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    i === MILESTONES.length - 1
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-card border-2 border-border'
                  }`}>
                    <span className="text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">{milestone.date}</p>
                    <h3 className="font-semibold mb-1">{milestone.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
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
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Join us on this journey</h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                Try NatureQuery free and see why teams are switching from traditional BI tools.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-colors shadow-lg">
                  Start Free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3 text-white/90 font-medium rounded-xl border border-white/20 hover:bg-white/10 transition-colors">
                  Get in Touch
                </Link>
              </div>
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
