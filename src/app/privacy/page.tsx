import { LegalDocument, type LegalSection } from '@/components/marketing/LegalDocument'

export const metadata = {
  title: 'Privacy Policy',
}

const sections: LegalSection[] = [
  {
    number: '01',
    title: 'Information We Collect',
    subsections: [
      {
        title: 'Account Information',
        content:
          'When you create an account, we collect your name, email address, and password (hashed with bcrypt). If you sign in via OAuth (Google, GitHub), we receive your profile information from the provider.',
      },
      {
        title: 'Database Credentials',
        content:
          'When you add a database connection, we store the host, port, database name, username, and password. Passwords are encrypted using AES-256-GCM before storage and are never logged or exposed in plaintext.',
      },
      {
        title: 'Usage Data',
        content:
          'We collect information about how you use the Service, including queries submitted, features used, error reports, and performance metrics. This data helps us improve the Service.',
      },
      {
        title: 'Technical Data',
        content:
          'We record IP addresses, browser type, device information and access times in our audit log, for security. Our error-tracking and analytics services do not store IP addresses.',
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
    content:
      'Your data is stored in PostgreSQL databases with encryption at rest. Database credentials are encrypted with AES-256-GCM. We use HTTPS for all data transmission. API keys are stored as SHA-256 hashes.',
  },
  {
    number: '04',
    title: 'AI Processing',
    content:
      'To write queries, your questions and details of your database structure (table and column names and types (including the allowed values of columns limited to a fixed list), keys, relationships and approximate row counts) are sent to our third-party AI inference providers. Explaining or fixing a query also sends the query text, and fixing it sends the database\'s error message. The data stored in your tables is not sent, except by two features that you choose to use: AI Insights on the website sends column statistics and up to 5 rows of the result, and Summarize in NatureQuery Desktop sends up to 50 rows of the result, but only after you turn on "Let AI summaries use result rows" (off by default). We may change AI providers over time to keep quality and performance high.',
  },
  {
    number: '05',
    title: 'NatureQuery Desktop',
    subsections: [
      {
        title: 'On your computer',
        content:
          'Your database connections, query results, query history, saved queries, settings and log files stay on your computer. Passwords, keys and tokens are encrypted with your Windows account and are never sent to NatureQuery. Log files have passwords and tokens removed.',
      },
      {
        title: 'Signing in',
        content:
          'You sign in through your web browser, so the app never sees your NatureQuery password. For each computer that signs in, we keep its device name, operating system, app version and when it was last used. You can see and sign out each computer under Settings, Security on naturequery.app.',
      },
      {
        title: 'AI features',
        content:
          'Ask, Fix with AI, Explain and Summarize send only what each feature needs, as described in AI Processing. We count your AI questions for your plan, but we do not store the questions, the queries or the details of your databases.',
      },
      {
        title: 'Reporting AI answers',
        content:
          'If you report an AI answer as wrong or inappropriate, we keep what the AI was asked, its answer, your comment and your account email, so our team can review the report and reply to you.',
      },
    ],
  },
  {
    number: '06',
    title: 'Data Sharing',
    content:
      'We do not sell your personal information. We share data only with trusted parties for specific purposes:',
    list: [
      {
        label: 'Lemon Squeezy',
        detail:
          'Payment processing and merchant of record (name, email, billing info, transaction data)',
      },
      {
        label: 'AI providers',
        detail:
          'Writing, explaining and fixing queries, AI Insights and summaries (see AI Processing)',
      },
      {
        label: 'Email delivery provider',
        detail:
          'Sending account emails, and delivering contact messages and AI answer reports to our team',
      },
      {
        label: 'Hosting providers',
        detail: 'Running the website and storing account data and uploaded files',
      },
      {
        label: 'Error tracking and analytics',
        detail: 'Error reports and usage statistics, without IP addresses or screen recordings',
      },
      { label: 'Law enforcement', detail: 'When required by valid legal process' },
    ],
  },
  {
    number: '07',
    title: 'Data Retention',
    list: [
      { label: 'Account data', detail: 'Retained while your account is active' },
      {
        label: 'Query history',
        detail:
          'On the website, retained per your plan (30 days for Free, unlimited for paid). In NatureQuery Desktop, kept on your computer until you clear it',
      },
      {
        label: 'Audit logs and AI answer reports',
        detail: 'Retained while your account is active',
      },
      { label: 'Deleted accounts', detail: 'Data purged within 30 days of deletion' },
    ],
  },
  {
    number: '08',
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
    number: '09',
    title: 'Cookies',
    content:
      'We use essential cookies for authentication (session tokens) and preference storage (theme). We do not use third-party tracking cookies or advertising pixels.',
  },
  {
    number: '10',
    title: "Children's Privacy",
    content:
      'NatureQuery is not intended for users under 16 years of age. We do not knowingly collect data from children.',
  },
  {
    number: '11',
    title: 'Changes to This Policy',
    content:
      'We may update this Privacy Policy periodically. We will notify you of material changes via email or in-app notification at least 30 days before they take effect.',
  },
]

export default function PrivacyPage() {
  return (
    <LegalDocument
      current="/privacy"
      label="Legal"
      title="Privacy Policy"
      intro="Your privacy matters to us. This policy explains what data we collect, how we use it, and the controls you have over your information."
      updated="October 14, 2026"
      sections={sections}
    />
  )
}
