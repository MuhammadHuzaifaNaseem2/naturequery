import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/api/v1', '/_next', '/favicon', '/public', '/shared']

const PUBLIC_EXACT = new Set([
  '/', '/login', '/register', '/verify-email', '/forgot-password',
  '/reset-password', '/pricing', '/features', '/terms', '/privacy',
  '/docs', '/about', '/contact', '/faq', '/changelog',
])

const AUTH_PAGES = new Set(['/login', '/register'])

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()')
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.gravatar.com https://i.pravatar.cc",
    "font-src 'self' data:",
    "connect-src 'self' https://api.groq.com https://api.stripe.com https://js.stripe.com wss:",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '))
  return res
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (isPublic) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Check session cookie existence — actual auth verification happens server-side
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'
  const hasSession = !!req.cookies.get(cookieName)?.value

  if (AUTH_PAGES.has(pathname) && hasSession) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)))
  }

  if (pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.next())
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  const res = NextResponse.next()
  res.headers.set('X-Request-Id', crypto.randomUUID())
  return applySecurityHeaders(res)
}

export const config = {
  matcher: [
    '/((?!api/auth|api/webhooks|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
