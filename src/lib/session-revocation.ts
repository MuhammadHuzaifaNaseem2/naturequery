/**
 * Every account has a sign-out line: User.passwordChangedAt. A password change and
 * "Sign out of all devices" move it to now, and every session that started before
 * it ends: browser sessions at their next check (the jwt callback in lib/auth.ts),
 * NatureQuery Desktop sessions on their next request (lib/desktop/sessions.ts).
 */

interface SessionStart {
  /** When this browser session started (milliseconds), set at sign-in. */
  signedInAt?: unknown
  /**
   * Sessions from before signedInAt existed carry the line as it was at sign-in:
   * a number for password sign-ins, or text for Google and GitHub sign-ins (the
   * database adapter hands over a Date, which the session cookie stores as text).
   */
  passwordChangedAt?: unknown
}

/** True when the session started before the account's sign-out line. */
export function startedBeforeSignOutLine(token: SessionStart, line: Date): boolean {
  const lineMs = line.getTime()
  if (typeof token.signedInAt === 'number') return lineMs > token.signedInAt
  const lineAtSignIn =
    typeof token.passwordChangedAt === 'number'
      ? token.passwordChangedAt
      : typeof token.passwordChangedAt === 'string'
        ? Date.parse(token.passwordChangedAt)
        : NaN
  // No usable start: the line was set after this session began.
  return Number.isNaN(lineAtSignIn) || lineMs > lineAtSignIn
}
