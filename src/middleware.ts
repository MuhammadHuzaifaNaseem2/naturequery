import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PREFIXES = ['/api/v1', '/_next', '/favicon', '/public', '/shared']

const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/pricing',
  '/download',
  '/features',
  '/terms',
  '/privacy',
  '/security',
  '/docs',
  '/docs/api',
  '/about',
  '/contact',
  '/faq',
  '/changelog',
  // The page behind 'Stop weekly summaries' in the email; the link is signed
  '/email/unsubscribe',
  // The link-preview image that WhatsApp, LinkedIn and X fetch while signed out
  '/opengraph-image',
])

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  )
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.gravatar.com https://i.pravatar.cc",
      "font-src 'self' data:",
      "connect-src 'self' wss: https://*.sentry.io https://*.ingest.sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com https://api.lemonsqueezy.com",
      'frame-src https://checkout.lemonsqueezy.com https://www.youtube.com https://www.youtube-nocookie.com',
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ')
  )
  return res
}

/**
 * True when the request carries a session that decodes and has not expired. Used
 * where a redirect depends on it, so an old cookie cannot cause a redirect loop.
 */
async function hasValidSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return false
  try {
    const token = await getToken({
      req,
      secret,
      secureCookie: process.env.NODE_ENV === 'production',
    })
    return !!token
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // People who are signed in and open the home page, for example from a search, go
  // straight to their dashboard. The login page does not redirect: it offers to
  // continue instead, which cannot loop if the dashboard ever sends someone back.
  if (pathname === '/' && (await hasValidSession(req))) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)))
  }

  const isPublic = PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (isPublic) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Check session cookie existence — actual auth verification happens server-side
  const cookieName =
    process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token'
  const hasSession = !!req.cookies.get(cookieName)?.value

  if (pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.next())
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', req.url)
    // Keep the query string, e.g. the desktop app's sign-in request.
    loginUrl.searchParams.set('callbackUrl', `${pathname}${req.nextUrl.search}`)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  const res = NextResponse.next()
  res.headers.set('X-Request-Id', crypto.randomUUID())
  return applySecurityHeaders(res)
}

export const config = {
  matcher: [
    '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
