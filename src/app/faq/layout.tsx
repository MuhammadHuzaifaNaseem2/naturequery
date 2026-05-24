import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ | NatureQuery',
  description:
    'Frequently asked questions about NatureQuery: databases supported, billing, security, AI accuracy, and enterprise features.',
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is NatureQuery?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'NatureQuery is an AI-powered platform that lets you query your databases using plain English. Instead of writing SQL, you type a question and NatureQuery generates and executes the SQL for you.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which databases does NatureQuery support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'NatureQuery supports PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, and Amazon Redshift.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need to know SQL to use NatureQuery?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. NatureQuery translates your natural language questions into SQL automatically. You can also view the generated SQL if you want to learn or verify the query.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is there a free plan?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The free plan includes 50 queries per month and 1 database connection. No credit card required.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my database data safe?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. NatureQuery never stores your query results. Database credentials are encrypted with AES-256 at rest. All connections use TLS/SSL.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I export query results?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. You can export results as Excel or CSV. Pro and Enterprise plans also support scheduled exports and automated reporting via email.',
      },
    },
  ],
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  )
}
