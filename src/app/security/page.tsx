import { LegalDocument, type LegalSection } from '@/components/marketing/LegalDocument'

export const metadata = {
  title: 'Security',
  description:
    'How NatureQuery protects your databases, your data and your account: read-only queries, encrypted connections, what we store and what we do not.',
}

const sections: LegalSection[] = [
  {
    number: '01',
    title: 'Read-only, always',
    content:
      'NatureQuery is built to read data, never to change it. Every query is protected in layers, before and while it runs.',
    list: [
      {
        label: 'Checked before it runs',
        detail:
          'Each query is checked against the rules for its database: one statement at a time, only reading commands, and no functions that can change data, run code or reach other servers. For MongoDB, pipeline stages that write data or run JavaScript are refused.',
      },
      {
        label: 'Refused by the database',
        detail:
          'On PostgreSQL, Neon, Supabase, CockroachDB, Redshift and Oracle, and on MySQL and MariaDB servers that support it, queries run inside a read-only transaction, so the database itself refuses any change. On Turso, each query runs in a transaction that is never saved.',
      },
      {
        label: 'Your own safeguard',
        detail:
          'Connect NatureQuery with a database user that can only read. Then your data cannot change, whatever happens in NatureQuery.',
      },
    ],
  },
  {
    number: '02',
    title: 'Your database connections',
    list: [
      {
        label: 'Passwords encrypted',
        detail:
          'Connection passwords are encrypted with AES-256-GCM before they are stored, and are never sent back to your browser.',
      },
      {
        label: 'Encrypted connections',
        detail:
          "Connections to your database are encrypted. New connections also check the database's certificate, so NatureQuery knows it is talking to your server. For providers that sign their own certificates, such as Amazon RDS, you can choose to trust the certificate as it is. The connection stays encrypted.",
      },
      {
        label: 'Public addresses only',
        detail:
          'Our servers connect only to public internet addresses. Private networks, local addresses and cloud metadata services are refused, so nobody can use NatureQuery to reach machines inside our hosting network. For databases on your own network, use NatureQuery Desktop.',
      },
    ],
  },
  {
    number: '03',
    title: 'What we store',
    content:
      'NatureQuery reads table and column names to write queries. It does not copy your database.',
    list: [
      {
        label: 'What we keep',
        detail:
          'Your questions, the queries that ran, row counts and timings (your history), saved queries and dashboards.',
      },
      {
        label: 'What we do not keep',
        detail:
          'Query results. They pass through our servers to your browser and are not saved or cached.',
      },
      {
        label: 'Only when you choose',
        detail:
          "If you share a dashboard with its charts, each chart's numbers are saved so the shared page can show them, and turning chart sharing off removes them. A saved investigation keeps its summary totals. Scheduled reports email their results to the people you choose.",
      },
      {
        label: 'Uploaded files',
        detail:
          "CSV and Excel files you upload are stored in a database separate from NatureQuery's own data, with a private area for each person. A query on uploaded data can read only that person's own tables.",
      },
      {
        label: 'Your control',
        detail:
          'You can delete your account and its data under Settings, Security. To get a copy of your data, write to us.',
      },
    ],
  },
  {
    number: '04',
    title: 'AI and your data',
    content:
      'To write a query, the AI receives your question and the structure of your database: table and column names and types, keys, relationships and approximate row counts. It does not receive the rows in your tables, except through two features you choose to use. AI Insights on the website sends column statistics and up to 5 rows of a result. Summarize in NatureQuery Desktop sends up to 50 rows, and only after you turn on "Let AI summaries use result rows", which is off by default. Explaining or fixing a query sends the query text, and fixing it also sends the database\'s error message.',
  },
  {
    number: '05',
    title: 'Accounts and access',
    list: [
      {
        label: 'Passwords',
        detail:
          'Stored as bcrypt hashes, never in plain text. After 5 wrong attempts, signing in is locked for 15 minutes.',
      },
      {
        label: 'Two-factor sign-in',
        detail: 'Use an authenticator app, with backup codes in case you lose your phone.',
      },
      {
        label: 'Teams and roles',
        detail:
          'Owners, Admins, Members and Viewers. Only Owners and Admins add or change database connections and invite people. Viewers can open dashboards but cannot run queries.',
      },
      {
        label: 'Checked every time',
        detail:
          'Every request checks who is signed in and whether they may use that connection, query or dashboard.',
      },
      {
        label: 'API keys',
        detail:
          'Created by you, shown once, stored only as a SHA-256 hash, and can be revoked at any time.',
      },
      {
        label: 'Audit log',
        detail:
          'Queries, sign-ins and important changes are recorded with the time, the address they came from and the browser used. Each entry carries a fingerprint of the one before it, so a change to past entries would show.',
      },
    ],
  },
  {
    number: '06',
    title: 'The website and its services',
    list: [
      {
        label: 'HTTPS only',
        detail: 'All traffic is encrypted, and browsers are told to always use HTTPS (HSTS).',
      },
      {
        label: 'Browser protections',
        detail:
          'A content security policy limits what the site may load, and other websites cannot embed NatureQuery in a frame.',
      },
      {
        label: 'Up-to-date software',
        detail:
          'We keep the software NatureQuery is built on up to date and check it for known vulnerabilities.',
      },
      {
        label: 'Error reports and analytics',
        detail:
          'They do not store IP addresses, never record your screen, and blank out secret links such as password resets and shared dashboards. Error reports also remove passwords and card numbers.',
      },
    ],
  },
  {
    number: '07',
    title: 'NatureQuery Desktop',
    content:
      'NatureQuery Desktop connects to your databases directly from your computer, so a database on your own network never needs to be reachable from the internet. Connections, results and history stay on your computer, and passwords are encrypted with your Windows account. The same read-only checks and read-only transactions apply.',
  },
  {
    number: '08',
    title: 'What we do not have yet',
    content: 'We would rather tell you than let you find out. NatureQuery does not yet offer:',
    bullets: [
      'A formal certification such as SOC 2 or ISO 27001.',
      'Single sign-on with SAML.',
      'Fixed outgoing IP addresses to add to your database firewall. If your database accepts only known addresses, use NatureQuery Desktop.',
      'A way to end website sign-ins on other devices. A sign-in lasts up to 7 days. NatureQuery Desktop sign-ins can already be ended under Settings, Security.',
    ],
  },
  {
    number: '09',
    title: 'Reporting a security issue',
    content:
      "If you find a vulnerability, email hello@naturequery.app with the steps to reproduce it, and a person will reply. Please do not access other people's data or disrupt the service while testing.",
  },
]

export default function SecurityPage() {
  return (
    <LegalDocument
      current="/security"
      label="Trust"
      title="Security"
      intro="How NatureQuery protects your databases, your data and your account, in plain words, including what we do not offer yet."
      updated="October 13, 2026"
      sections={sections}
    />
  )
}
