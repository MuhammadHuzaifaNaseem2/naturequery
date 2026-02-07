import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Paths that require authentication
const protectedPaths = [
    '/',
    '/dashboard',
    '/connections',
    '/queries',
    '/settings',
    '/api/connections',
    '/api/queries',
]

// Paths that should redirect to dashboard if already authenticated
const authPaths = ['/login', '/register']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Get the token from the request
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    })

    const isAuthenticated = !!token

    // Check if it's an auth page (check this FIRST to avoid redirect loop)
    const isAuthPath = authPaths.some((path) => pathname.startsWith(path))

    // Redirect to dashboard if accessing auth pages while authenticated
    if (isAuthPath && isAuthenticated) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    // Check if the path requires authentication
    // Use exact match for '/' to avoid matching every path
    const isProtectedPath = protectedPaths.some((path) =>
        path === '/' ? pathname === '/' : pathname.startsWith(path)
    )

    // Redirect to login if accessing protected path without authentication
    if (isProtectedPath && !isAuthenticated && !isAuthPath) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (auth API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)',
    ],
}
