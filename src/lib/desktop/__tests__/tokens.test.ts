// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  ACCESS_TOKEN_PREFIX,
  bearerToken,
  cleanDeviceName,
  hashToken,
  isValidCodeChallenge,
  randomToken,
  verifyPkce,
} from '../tokens'
import { safeCallbackUrl } from '../../safe-redirect'

describe('desktop tokens', () => {
  it('verifies PKCE with the RFC 7636 example', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    expect(isValidCodeChallenge(challenge)).toBe(true)
    expect(verifyPkce(verifier, challenge)).toBe(true)
    expect(verifyPkce(`${verifier.slice(0, -1)}A`, challenge)).toBe(false)
    expect(verifyPkce('short', challenge)).toBe(false)
    expect(verifyPkce(verifier, 'not-a-challenge')).toBe(false)
  })

  it('creates unique prefixed tokens and stable hashes', () => {
    const a = randomToken(ACCESS_TOKEN_PREFIX)
    const b = randomToken(ACCESS_TOKEN_PREFIX)
    expect(a).toMatch(/^nqd_at_[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reads only well-formed bearer tokens', () => {
    const token = randomToken(ACCESS_TOKEN_PREFIX)
    expect(bearerToken(`Bearer ${token}`)).toBe(token)
    expect(bearerToken(`bearer ${token}`)).toBe(token)
    expect(bearerToken('Bearer rp_api_key')).toBeNull()
    expect(bearerToken(token)).toBeNull()
    expect(bearerToken(null)).toBeNull()
  })

  it('keeps device names short and printable', () => {
    expect(cleanDeviceName('  Office PC\n')).toBe('Office PC')
    expect(cleanDeviceName('x'.repeat(200))).toHaveLength(80)
    expect(cleanDeviceName('\u0000')).toBeNull()
    expect(cleanDeviceName(42)).toBeNull()
  })
})

describe('sign-in redirects', () => {
  it('allows only paths on this site', () => {
    expect(safeCallbackUrl('/desktop/authorize?challenge=a&state=b')).toBe(
      '/desktop/authorize?challenge=a&state=b'
    )
    expect(safeCallbackUrl(null)).toBe('/dashboard')
    expect(safeCallbackUrl('https://evil.example/phish')).toBe('/dashboard')
    expect(safeCallbackUrl('//evil.example')).toBe('/dashboard')
    expect(safeCallbackUrl('/\\evil.example')).toBe('/dashboard')
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/dashboard')
  })
})
