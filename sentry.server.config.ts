import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    debug: false,
    ignoreErrors: [
      // Expected user errors from verifyEmail action when clicking stale links
      'Invalid or expired verification link',
      'This verification link has expired',
      // Next.js notFound() responses, not bugs
      'NEXT_NOT_FOUND',
    ],
    beforeSend(event, hint) {
      // Drop 404s from bot scanners hitting random endpoints with wrong methods
      const error = hint.originalException as Error | undefined
      if (error?.message === 'Not Found' || error?.name === 'NotFoundError') {
        return null
      }
      return event
    },
  })
}
