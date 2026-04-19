export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env')
    validateEnv()
    // Only load Sentry when DSN is configured — importing @sentry/nextjs always
    // pulls in @opentelemetry/instrumentation which uses dynamic require() that
    // webpack cannot bundle, causing a corrupt chunk and Internal Server Errors.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import('../sentry.server.config')
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import('../sentry.edge.config')
    }
  }
}

export async function onRequestError(...args: Parameters<(typeof import('@sentry/nextjs'))['captureRequestError']>) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs')
    return Sentry.captureRequestError(...args)
  }
}
