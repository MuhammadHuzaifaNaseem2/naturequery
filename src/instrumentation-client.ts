// Error reports (Sentry) and product analytics (PostHog) in the browser.
// NatureQuery shows people their company's data, so neither tool may carry that
// data or personal details: no IP addresses or cookies in error reports, no
// console output, secret links blanked out, and PostHog never records screens or
// the text and attributes of what people click.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { redactRequest, redactUrl, redactUrlFields } from '@/lib/redact-url'

Sentry.init({
  dsn: 'https://963fe3d98af8965e00eb898005f40e2d@o4510812186673152.ingest.us.sentry.io/4511370131079168',
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  // No IP addresses, cookies or user details in reports.
  sendDefaultPii: false,
  ignoreErrors: [
    // Outlook SafeLink scanner injects a buggy script when previewing URLs
    'Object Not Found Matching Id',
    // Harmless browser quirk, not actionable
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],
  beforeBreadcrumb(breadcrumb) {
    // Console output can include query text or results.
    if (breadcrumb.category === 'console') return null
    redactUrlFields(breadcrumb.data)
    return breadcrumb
  },
  beforeSend(event) {
    redactRequest(event.request)
    return event
  },
  beforeSendTransaction(event) {
    redactRequest(event.request)
    if (event.transaction) event.transaction = redactUrl(event.transaction)
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2026-01-30',
    // Screens show customers' data: never record them, whatever the project settings say.
    disable_session_recording: true,
    // Clicks are counted without the clicked element's text or attribute values.
    mask_all_text: true,
    mask_all_element_attributes: true,
    // Errors go to Sentry, which scrubs them; PostHog does not collect them too.
    capture_exceptions: false,
    before_send: (event) => {
      if (event) {
        redactUrlFields(event.properties)
        redactUrlFields(event.$set)
        redactUrlFields(event.$set_once)
      }
      return event
    },
  })
}
