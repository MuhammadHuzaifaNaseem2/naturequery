const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    'pg-native',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

// Only wrap with Sentry if DSN is configured
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: true,
    widenClientFileUpload: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  })
  : nextConfig
