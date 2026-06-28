import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { getLocale, getTranslations } from '@/lib/i18n'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'NatureQuery - Natural Language to SQL',
    template: '%s | NatureQuery',
  },
  description:
    'Ask questions in plain English and get instant SQL queries with AI-powered insights. Connect to PostgreSQL, MySQL, or SQLite.',
  keywords: [
    'natural language to SQL',
    'AI SQL generator',
    'database query',
    'text to SQL',
    'NatureQuery',
  ],
  authors: [{ name: 'NatureQuery' }],
  creator: 'NatureQuery',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://naturequery.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'NatureQuery',
    title: 'NatureQuery - Ask Your Database in Plain English',
    description:
      'Convert natural language questions into SQL queries instantly. AI-powered database querying for everyone.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NatureQuery - Natural Language to SQL',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NatureQuery - Natural Language to SQL',
    description: 'Ask your database in plain English. Get instant SQL queries and insights.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getTranslations(locale)

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='warm'||t==='dim'||t==='forest'){d.classList.add(t)}else if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'NatureQuery',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              url: 'https://naturequery.app',
              description:
                'AI-powered platform that converts natural language questions into SQL queries instantly. Connect PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, and Amazon Redshift.',
              offers: [
                {
                  '@type': 'Offer',
                  name: 'Free Plan',
                  price: '0',
                  priceCurrency: 'USD',
                  description: '50 queries/month, 1 database connection',
                },
                {
                  '@type': 'Offer',
                  name: 'Pro Plan',
                  price: '19',
                  priceCurrency: 'USD',
                  description: 'Unlimited queries, 10 connections, CSV/Excel export',
                },
              ],
              featureList: [
                'Natural language to SQL conversion',
                'PostgreSQL, MySQL, SQLite, SQL Server support',
                'CSV and Excel export',
                'Conversational follow-up queries',
                'Magic CSV Upload',
                'Chain-of-Thought SQL reasoning',
                'Two-factor authentication',
                'Team collaboration',
              ],
              screenshot: 'https://naturequery.app/og-image.png',
              creator: {
                '@type': 'Organization',
                name: 'NatureQuery',
                url: 'https://naturequery.app',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'NatureQuery',
              url: 'https://naturequery.app',
              description: 'Query your database in plain English with AI-powered SQL generation.',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://naturequery.app/faq?search={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body
        className="font-sans antialiased bg-background text-foreground"
        suppressHydrationWarning
      >
        <LocaleProvider initialLocale={locale} messages={messages}>
          <AuthProvider>
            <ThemeProvider>
              {children}
              <Toaster
                position="bottom-right"
                richColors
                closeButton
                toastOptions={{
                  style: {
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  },
                }}
              />
            </ThemeProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
