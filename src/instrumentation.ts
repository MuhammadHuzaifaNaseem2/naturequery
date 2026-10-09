const enableSentry =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  (process.env.NODE_ENV === 'production' || process.env.NQ_ENABLE_SENTRY_IN_DEV === '1')

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env')
    validateEnv()
    // Only load Sentry when DSN is configured — importing @sentry/nextjs always
    // pulls in @opentelemetry/instrumentation which uses dynamic require() that
    // webpack cannot bundle, causing a corrupt chunk and Internal Server Errors.
    if (enableSentry) {
      await import('../sentry.server.config')
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (enableSentry) {
      await import('../sentry.edge.config')
    }
  }
}

export async function onRequestError(
  ...args: Parameters<(typeof import('@sentry/nextjs'))['captureRequestError']>
) {
  if (enableSentry) {
    const Sentry = await import('@sentry/nextjs')
    return Sentry.captureRequestError(...args)
  }
}
