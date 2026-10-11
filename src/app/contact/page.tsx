'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { MarketingShell } from '@/components/marketing/MarketingShell'

const CONTACT_REASONS = [
  { value: 'general', label: 'General question' },
  { value: 'sales', label: 'Sales and Enterprise' },
  { value: 'support', label: 'Technical support' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'feedback', label: 'Product feedback' },
]

const EMPTY_FORM = {
  name: '',
  email: '',
  reason: 'general',
  company: '',
  message: '',
  website: '',
}

const field =
  'h-11 w-full rounded-md border border-mk-rule bg-mk-surface px-3.5 text-[0.9375rem] text-mk-ink placeholder:text-mk-ink-3 transition-colors focus:border-mk-violet focus:outline-none'

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'We could not accept your message.')
      setSent(true)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'We could not accept your message. Please try again.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <MarketingShell current="/contact">
      <section className="mx-auto grid max-w-[1200px] gap-14 px-5 py-14 sm:px-8 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="mk-label">Contact</p>
          <h1 className="mt-5 text-balance font-nq-serif text-[clamp(2.6rem,5.4vw,4.4rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
            Write to us. <em className="text-mk-ink-2">A person reads every message.</em>
          </h1>
          <p className="mt-6 max-w-[30rem] text-lg leading-relaxed text-mk-ink-2">
            A question, feedback, or a plan for your whole company: send a message and we will get
            back to you.
          </p>
          <dl className="mt-12 divide-y divide-mk-rule border-y border-mk-rule">
            <div className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <dt className="mk-label sm:pt-1">Email</dt>
              <dd>
                <a href="mailto:hello@naturequery.app" className="mk-link text-[1.0625rem]">
                  hello@naturequery.app
                </a>
              </dd>
            </div>
            <div className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <dt className="mk-label sm:pt-1">Companies</dt>
              <dd className="leading-relaxed text-mk-ink-2">
                Team plans, SLAs and setting up NatureQuery Desktop for your office.
              </dd>
            </div>
            <div className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <dt className="mk-label sm:pt-1">Replies</dt>
              <dd className="leading-relaxed text-mk-ink-2">Usually within a day.</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-mk-rule bg-mk-surface p-6 shadow-[0_30px_60px_-40px_hsl(var(--mk-ink)/0.35)] sm:p-8">
          {sent ? (
            <div className="py-10" role="status">
              <p className="font-nq-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-mk-violet">
                Message sent
              </p>
              <h2 className="mt-4 font-nq-serif text-[2.2rem] leading-tight tracking-[-0.02em] text-mk-ink">
                Thank you. It&apos;s on its way.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-mk-ink-2">
                We&apos;ll reply to <span className="text-mk-ink">{form.email}</span> as soon as we
                can.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSent(false)
                    setForm(EMPTY_FORM)
                  }}
                  className="mk-btn mk-btn-quiet"
                >
                  Send another
                </button>
                <Link href="/" className="mk-btn mk-btn-primary">
                  Back to home
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-mk-ink">
                Send a message
              </h2>
              <div className="hidden" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="mb-2 block text-sm font-medium text-mk-ink"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={field}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="mb-2 block text-sm font-medium text-mk-ink"
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@company.com"
                    className={field}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-reason"
                    className="mb-2 block text-sm font-medium text-mk-ink"
                  >
                    Topic
                  </label>
                  <select
                    id="contact-reason"
                    name="reason"
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    className={field}
                  >
                    {CONTACT_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="contact-company"
                    className="mb-2 block text-sm font-medium text-mk-ink"
                  >
                    Company <span className="font-normal text-mk-ink-3">(optional)</span>
                  </label>
                  <input
                    id="contact-company"
                    name="company"
                    type="text"
                    maxLength={120}
                    autoComplete="organization"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className={field}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="contact-message"
                  className="mb-2 block text-sm font-medium text-mk-ink"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="How can we help?"
                  className={`${field} h-auto resize-y py-3`}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                >
                  {error}{' '}
                  <a href="mailto:hello@naturequery.app" className="font-medium underline">
                    Email us directly
                  </a>
                  .
                </div>
              )}

              <button type="submit" disabled={sending} className="mk-btn mk-btn-primary w-full">
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending
                  </>
                ) : (
                  'Send message'
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </MarketingShell>
  )
}
