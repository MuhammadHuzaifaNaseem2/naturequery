import Link from 'next/link'
import { Sparkles, ArrowLeft, Shield, Calendar, Mail } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy — NatureQuery',
}

const sections = [
  {
    number: '01',
    title: 'Information We Collect',
    subsections: [
      {
        title: 'Account Information',
        content: 'When you create an account, we collect your name, email address, and password (hashed with bcrypt). If you sign in via OAuth (Google, GitHub), we receive your profile information from the provider.',
      },
      {
        title: 'Database Credentials',
        content: 'When you add a database connection, we store the host, port, database name, username, and password. Passwords are encrypted using AES-256-GCM before storage and are never logged or exposed in plaintext.',
      },
      {
        title: 'Usage Data',
        content: 'We collect information about how you use the Service, including queries submitted, features used, error reports, and performance metrics. This data helps us improve the Service.',
      },
      {
        title: 'Technical Data',
        content: 'We automatically collect IP addresses, browser type, device information, and access timestamps for security (audit logs) and analytics purposes.',
      },
    ],
  },
  {
    number: '02',
    title: 'How We Use Your Information',
    list: [
      { label: 'Service delivery', detail: 'Execute queries, generate SQL, export results' },
      { label: 'Account management', detail: 'Authentication, billing, support' },
      { label: 'Security', detail: 'Audit logging, rate limiting, abuse prevention' },
      { label: 'Improvement', detail: 'Anonymized analytics to improve AI accuracy and UX' },
      { label: 'Communication', detail: 'Service updates, password resets, team invitations' },
    ],
  },
  {
    number: '03',
    title: 'Data Storage & Security',
    content: 'Your data is stored in PostgreSQL databases with encryption at rest. Database credentials are encrypted with AES-256-GCM. We use HTTPS for all data transmission. API keys are stored as SHA-256 hashes.',
  },
  {
    number: '04',
    title: 'AI Processing',
    content: 'Your natural language questions and database schema information are sent to our AI provider (Groq) to generate SQL queries. We do not send your actual data or query results to any AI provider. Schema information is cached locally and transmitted only as needed for query generation.',
  },
  {
    number: '05',
    title: 'Data Sharing',
    content: 'We do not sell your personal information. We share data only with trusted parties for specific purposes:',
    list: [
      { label: 'Stripe', detail: 'Payment processing (name, email, billing info)' },
      { label: 'AI providers', detail: 'Query generation (schema metadata only, no row data)' },
      { label: 'Law enforcement', detail: 'When required by valid legal process' },
    ],
  },
  {
    number: '06',
    title: 'Data Retention',
    list: [
      { label: 'Account data', detail: 'Retained while your account is active' },
      { label: 'Query history', detail: 'Retained per your plan (30 days for Free, unlimited for paid)' },
      { label: 'Audit logs', detail: 'Retained for 90 days' },
      { label: 'Deleted accounts', detail: 'Data purged within 30 days of deletion' },
    ],
  },
  {
    number: '07',
    title: 'Your Rights',
    content: 'You have the following rights regarding your personal data:',
    bullets: [
      'Access your personal data',
      'Correct inaccurate data',
      'Delete your account and associated data',
      'Export your data (queries, connections, settings)',
      'Withdraw consent for optional data processing',
    ],
  },
  {
    number: '08',
    title: 'Cookies',
    content: 'We use essential cookies for authentication (session tokens) and preference storage (theme). We do not use third-party tracking cookies or advertising pixels.',
  },
  {
    number: '09',
    title: "Children's Privacy",
    content: 'NatureQuery is not intended for users under 16 years of age. We do not knowingly collect data from children.',
  },
  {
    number: '10',
    title: 'Changes to This Policy',
    content: 'We may update this Privacy Policy periodically. We will notify you of material changes via email or in-app notification at least 30 days before they take effect.',
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-border" />
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold">NatureQuery</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Your privacy matters to us. This policy explains what data we collect, how we use it, and the controls you have over your information.
          </p>
          <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Last updated: February 8, 2026</span>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 mt-8">
            {['AES-256 Encryption', 'No data selling', 'HTTPS only', 'GDPR ready'].map((badge) => (
              <span key={badge} className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/8 border border-primary/15 rounded-full px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">
          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Contents</p>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.number}
                    href={`#section-${s.number}`}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors group"
                  >
                    <span className="text-xs font-mono text-primary/60 group-hover:text-primary transition-colors">{s.number}</span>
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Sections */}
          <div className="space-y-2">
            {sections.map((s) => (
              <div
                key={s.number}
                id={`section-${s.number}`}
                className="group relative rounded-2xl border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border transition-all duration-200 overflow-hidden scroll-mt-24"
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 to-accent/60 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-7">
                  <div className="flex items-start gap-5">
                    <span className="text-xs font-mono font-bold text-primary/50 bg-primary/8 border border-primary/15 rounded-lg px-2.5 py-1.5 shrink-0 mt-0.5">
                      {s.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-foreground mb-3">{s.title}</h2>

                      {/* Subsections (for section 01) */}
                      {s.subsections && (
                        <div className="space-y-4">
                          {s.subsections.map((sub, j) => (
                            <div key={j}>
                              <h3 className="text-sm font-semibold text-foreground/80 mb-1">{sub.title}</h3>
                              <p className="text-sm text-muted-foreground leading-relaxed">{sub.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Plain content */}
                      {s.content && !s.subsections && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                      )}

                      {/* Labeled list */}
                      {s.list && (
                        <div className="mt-3 space-y-2">
                          {s.content && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.content}</p>}
                          {s.list.map((item, j) => (
                            <div key={j} className="flex items-start gap-3 text-sm">
                              <span className="font-medium text-foreground/80 shrink-0">{item.label}:</span>
                              <span className="text-muted-foreground">{item.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bullet list */}
                      {s.bullets && (
                        <div className="mt-3">
                          {s.content && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.content}</p>}
                          <ul className="space-y-2">
                            {s.bullets.map((item, j) => (
                              <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Contact card */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-7">
              <div className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">Privacy questions or data requests?</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    To exercise your data rights or ask about this policy, reach out directly.
                  </p>
                  <a
                    href="mailto:support@naturequery.com"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    support@naturequery.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/60 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2026 NatureQuery. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
