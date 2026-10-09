/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // The parent directory also has a lockfile, but this app's dependencies
    // and source live alongside this config.
    root: __dirname,
  },
  // Exclude packages that use dynamic require() from webpack bundling.
  // @opentelemetry/instrumentation (pulled in by @sentry/node) produces a
  // corrupt chunk when bundled, causing Internal Server Errors on every route.
  serverExternalPackages: [
    '@opentelemetry/instrumentation',
    '@prisma/instrumentation',
    'tedious',
    'oracledb',
    'mysql2',
    'better-sqlite3',
    'pg',
    'pg-pool',
    'pg-native',
    'papaparse',
    'pgsql-ast-parser',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
}

// Keep local route compilation lean; production reporting remains enabled.
const enableSentry =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  (process.env.NODE_ENV === 'production' || process.env.NQ_ENABLE_SENTRY_IN_DEV === '1')

module.exports = enableSentry
  ? require('@sentry/nextjs').withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig
