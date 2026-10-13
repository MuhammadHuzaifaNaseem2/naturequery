import * as Sentry from '@sentry/nextjs'
import { redactRequest } from '@/lib/redact-url'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    debug: false,
    ignoreErrors: ['NEXT_NOT_FOUND'],
    beforeSend(event, hint) {
      const error = hint.originalException as Error | undefined
      if (error?.message === 'Not Found' || error?.name === 'NotFoundError') {
        return null
      }
      redactRequest(event.request)
      return event
    },
    beforeSendTransaction(event) {
      redactRequest(event.request)
      return event
    },
  })
}
