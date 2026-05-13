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
  maximumScale: 1,
  userScalable: false,
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
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}}catch(e){}})()`,
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
