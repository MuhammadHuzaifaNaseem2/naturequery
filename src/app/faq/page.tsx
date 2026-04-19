'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  HelpCircle,
  ChevronDown,
  ArrowRight,
  MessageSquare,
  Search,
} from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  category: string
}

const CATEGORIES = ['All', 'Getting Started', 'Features', 'Security', 'Billing', 'Enterprise']

const FAQ_ITEMS: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'What is NatureQuery?',
    answer: 'NatureQuery is an AI-powered platform that lets you query your databases using plain English. Instead of writing SQL, you simply type a question like "How many users signed up last week?" and NatureQuery generates and executes the SQL for you.',
  },
  {
    category: 'Getting Started',
    question: 'Which databases are supported?',
    answer: 'NatureQuery supports PostgreSQL, MySQL, SQLite, SQL Server, Oracle, and MariaDB. We connect directly to your database using encrypted credentials — no data migration or ETL needed.',
  },
  {
    category: 'Getting Started',
    question: 'How do I get started?',
    answer: 'Sign up for a free account, connect your database (or try our demo database), and start asking questions in plain English. The whole setup takes under 2 minutes. No credit card required.',
  },
  {
    category: 'Getting Started',
    question: 'Do I need to know SQL?',
    answer: 'Not at all! That\'s the whole point. NatureQuery translates your natural language questions into SQL automatically. You can also view the generated SQL if you want to learn or verify the query.',
  },
  // Features
  {
    category: 'Features',
    question: 'How accurate is the SQL generation?',
    answer: 'NatureQuery uses Groq\'s Llama 3.3 70B model, which is highly accurate for most common queries. It reads your actual database schema to generate precise queries. For complex joins or edge cases, you can always review and edit the generated SQL before executing.',
  },
  {
    category: 'Features',
    question: 'What is conversational follow-up?',
    answer: 'NatureQuery remembers context from your previous queries (up to 5 turns). So you can ask "Show me top customers" and then follow up with "Now filter those by last month" without repeating the full context.',
  },
  {
    category: 'Features',
    question: 'Can I export query results?',
    answer: 'Yes! You can export results as CSV, JSON, or PDF. Pro and Enterprise plans also support scheduled exports and automated reporting via email.',
  },
  {
    category: 'Features',
    question: 'What is Magic CSV Upload?',
    answer: 'Magic CSV Upload lets you upload a CSV file and instantly query it using natural language — no database setup required. NatureQuery creates a temporary in-memory database from your CSV and lets you explore it with AI.',
  },
  {
    category: 'Features',
    question: 'Does NatureQuery support Chain-of-Thought mode?',
    answer: 'Yes. Chain-of-Thought (CoT) mode shows you the AI\'s reasoning process as it generates SQL — what tables it\'s considering, how it interprets your question, and why it chose a particular approach. Great for learning and debugging.',
  },
  // Security
  {
    category: 'Security',
    question: 'Is my database data safe?',
    answer: 'Absolutely. NatureQuery never stores your query results. Database credentials are encrypted with AES-256 at rest. All connections use TLS/SSL. We also support read-only database users so NatureQuery can never modify your data.',
  },
  {
    category: 'Security',
    question: 'Do you support two-factor authentication?',
    answer: 'Yes. We support TOTP-based 2FA (compatible with Google Authenticator, Authy, etc.) plus backup codes. Enterprise plans can enforce 2FA for all team members.',
  },
  {
    category: 'Security',
    question: 'Where is my data processed?',
    answer: 'Your natural language queries are processed through Groq\'s AI API to generate SQL. The generated SQL is then executed directly against your database. We don\'t store your data or query results — only metadata like query count for billing.',
  },
  // Billing
  {
    category: 'Billing',
    question: 'Is there a free plan?',
    answer: 'Yes! The free plan includes 50 queries per month, 2 database connections, and core features. No credit card required. Upgrade anytime when you need more.',
  },
  {
    category: 'Billing',
    question: 'How does the 7-day free trial work?',
    answer: 'When you sign up for a Pro plan, you get full access to all Pro features for 7 days at no cost. If you don\'t cancel before the trial ends, you\'ll be charged the monthly or annual rate. You can cancel anytime from your billing settings.',
  },
  {
    category: 'Billing',
    question: 'Can I change or cancel my plan anytime?',
    answer: 'Yes. You can upgrade, downgrade, or cancel your plan at any time from your billing settings. Downgrades take effect at the end of your current billing cycle. No cancellation fees.',
  },
  // Enterprise
  {
    category: 'Enterprise',
    question: 'What does the Enterprise plan include?',
    answer: 'Enterprise includes unlimited queries, unlimited connections, unlimited team members, RBAC, audit logs, SSO (coming soon), priority support, custom SLA, and dedicated onboarding. Contact our sales team for pricing.',
  },
  {
    category: 'Enterprise',
    question: 'Do you offer on-premise deployment?',
    answer: 'Not yet, but it\'s on our roadmap for Q3 2026. In the meantime, our cloud offering uses enterprise-grade security with encrypted connections, and your data never leaves your database — only the generated SQL is transmitted.',
  },
  {
    category: 'Enterprise',
    question: 'Can I manage my team\'s access?',
    answer: 'Yes. Enterprise plans include role-based access control (RBAC) with Owner, Admin, Member, and Viewer roles. You can control who can create connections, execute queries, manage billing, and invite team members.',
  },
]

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden hover:border-primary/20 transition-colors">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="font-medium text-sm pr-4">{item.question}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
          {item.answer}
        </div>
      </div>
    </div>
  )
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [search, setSearch] = useState('')

  const filtered = FAQ_ITEMS.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory
    const matchesSearch = !search || item.question.toLowerCase().includes(search.toLowerCase()) || item.answer.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

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
            <HelpCircle className="w-3.5 h-3.5" />
            FAQ
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Frequently asked
            <span className="gradient-text"> questions</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Everything you need to know about NatureQuery. Can&apos;t find what you&apos;re looking for? Reach out to our team.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto">
            <label className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-sm cursor-text hover:border-primary/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search questions..."
                className="bg-transparent outline-none w-full placeholder:text-muted-foreground"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="pb-4">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-wrap items-center gap-2 justify-center">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenIndex(null) }}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ List */}
      <section className="py-10">
        <div className="max-w-3xl mx-auto px-6">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No matching questions found. Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item, i) => (
                <FAQAccordion
                  key={`${item.category}-${i}`}
                  item={item}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Still have questions CTA */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-card border border-border rounded-2xl p-10">
            <MessageSquare className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">Still have questions?</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Can&apos;t find the answer you&apos;re looking for? Our team is happy to help.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/contact" className="btn-primary text-sm py-2.5 px-6">
                Contact Us <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="mailto:support@naturequery.com" className="btn-secondary text-sm py-2.5 px-6">
                Email Support
              </a>
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
