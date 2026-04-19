'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppLogo } from '@/components/AppLogo'
import {
  Mail,
  MessageSquare,
  Building2,
  Clock,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  MapPin,
  HelpCircle,
} from 'lucide-react'

const CONTACT_REASONS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'sales', label: 'Sales & Enterprise' },
  { value: 'support', label: 'Technical Support' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'feedback', label: 'Product Feedback' },
]

const CARDS = [
  {
    icon: Mail,
    title: 'Email Us',
    description: 'For general inquiries and support',
    action: 'support@naturequery.com',
    href: 'mailto:support@naturequery.com',
  },
  {
    icon: Building2,
    title: 'Enterprise Sales',
    description: 'Custom plans, SLA, and integrations',
    action: 'sales@naturequery.com',
    href: 'mailto:sales@naturequery.com',
  },
  {
    icon: Clock,
    title: 'Response Time',
    description: 'We typically respond within',
    action: '< 24 hours',
    href: null,
  },
]

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    reason: 'general',
    company: '',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    // Simulate send — replace with actual API call when ready
    await new Promise(r => setTimeout(r, 1500))
    setSending(false)
    setSent(true)
  }

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
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-8 relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <MessageSquare className="w-3.5 h-3.5" />
            Get in Touch
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            We&apos;d love to
            <span className="gradient-text"> hear from you</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have a question, feedback, or want to discuss enterprise plans? Drop us a message and we&apos;ll get back to you quickly.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {CARDS.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="bg-card border border-border/60 rounded-2xl p-6 text-center hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{card.description}</p>
                  {card.href ? (
                    <a href={card.href} className="text-sm font-medium text-primary hover:underline">{card.action}</a>
                  ) : (
                    <p className="text-sm font-semibold gradient-text">{card.action}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          {sent ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-lg animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Message Sent!</h2>
              <p className="text-muted-foreground mb-8">
                Thanks for reaching out. We&apos;ll get back to you within 24 hours.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', reason: 'general', company: '', message: '' }) }}
                  className="btn-secondary text-sm"
                >
                  Send Another
                </button>
                <Link href="/" className="btn-primary text-sm">
                  Back to Home
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
              <h2 className="text-xl font-bold mb-1">Send us a message</h2>
              <p className="text-sm text-muted-foreground mb-8">Fill out the form below and we&apos;ll respond as soon as possible.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="john@company.com"
                      className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">Reason</label>
                    <select
                      value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    >
                      {CONTACT_REASONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Company <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                      placeholder="Acme Inc."
                      className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us how we can help..."
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="btn-primary w-full py-3 text-sm"
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Message</>
                  )}
                </button>
              </form>
            </div>
          )}
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
