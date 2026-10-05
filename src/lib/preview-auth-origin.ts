/** Auth.js v5 infers the request host when these fixed URLs are absent. */
export function preferRequestAuthOriginInPreview(env: Record<string, string | undefined>): void {
  if (env.VERCEL_ENV !== 'preview') return

  // Vercel's shared environment variables may point a Preview at the live
  // site's session and callback URLs. Never reuse that origin in Preview.
  delete env.AUTH_URL
  delete env.NEXTAUTH_URL
}
