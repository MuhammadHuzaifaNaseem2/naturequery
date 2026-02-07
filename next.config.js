/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  instrumentationHook: true,
  output: 'standalone',
}

module.exports = nextConfig
