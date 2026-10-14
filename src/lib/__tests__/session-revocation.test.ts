import { describe, expect, it } from 'vitest'
import { startedBeforeSignOutLine } from '../session-revocation'

const line = new Date('2026-10-14T12:00:00Z')
const before = line.getTime() - 60_000
const after = line.getTime() + 60_000

describe('sessions and the sign-out line', () => {
  it('ends sessions that started before the line, and keeps later ones', () => {
    expect(startedBeforeSignOutLine({ signedInAt: before }, line)).toBe(true)
    expect(startedBeforeSignOutLine({ signedInAt: after }, line)).toBe(false)
  })

  it('handles sessions from before signedInAt existed', () => {
    // Password sign-ins stored the line at sign-in as a number.
    expect(startedBeforeSignOutLine({ passwordChangedAt: before }, line)).toBe(true)
    expect(startedBeforeSignOutLine({ passwordChangedAt: line.getTime() }, line)).toBe(false)
    // Google and GitHub sign-ins stored it as text, which used to compare as never older.
    expect(
      startedBeforeSignOutLine({ passwordChangedAt: new Date(before).toISOString() }, line)
    ).toBe(true)
    expect(startedBeforeSignOutLine({ passwordChangedAt: line.toISOString() }, line)).toBe(false)
    // No line at sign-in: any line set since then ends the session.
    expect(startedBeforeSignOutLine({ passwordChangedAt: null }, line)).toBe(true)
    expect(startedBeforeSignOutLine({}, line)).toBe(true)
  })
})
