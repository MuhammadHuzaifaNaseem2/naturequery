/** Never send a sign-in flow to a different deployment's session. */
export function sameOriginAuthUrl(candidate: string, currentOrigin: string): string | null {
  try {
    const url = new URL(candidate, currentOrigin)
    return url.origin === currentOrigin ? url.href : null
  } catch {
    return null
  }
}
