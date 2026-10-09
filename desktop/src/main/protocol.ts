import { net, protocol } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const APP_SCHEME = 'app'
export const APP_HOST = 'naturequery'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

// The interface never loads remote code. Styles allow inline rules because
// the SQL editor and charts set them at runtime.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
    },
  ])
}

export function serveRenderer(rendererDir: string): void {
  const root = path.resolve(rendererDir)
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 })
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const file = path.resolve(root, `.${relative}`)
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    ) {
      return new Response('Not found', { status: 404 })
    }
    const response = await net.fetch(pathToFileURL(file).toString())
    const headers = new Headers(response.headers)
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    return new Response(response.body, { status: response.status, headers })
  })
}

/** True for the bundled interface, or the Vite dev server during development. */
export function isTrustedAppUrl(raw: string, devServerUrl?: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST) return true
    return !!devServerUrl && url.origin === new URL(devServerUrl).origin
  } catch {
    return false
  }
}
