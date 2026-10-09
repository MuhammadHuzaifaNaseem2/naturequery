const BASE = 'https://naturequery.invalid'

/**
 * Where to go after signing in. Only paths on this site are allowed, so a
 * crafted link cannot send people to another site or run a javascript: URL.
 */
export function safeCallbackUrl(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
