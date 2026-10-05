import { describe, expect, it } from 'vitest'
import { preferRequestAuthOriginInPreview } from './preview-auth-origin'

describe('preferRequestAuthOriginInPreview', () => {
  it('ignores fixed live-site URLs in Preview', () => {
    const env = {
      VERCEL_ENV: 'preview',
      AUTH_URL: 'https://naturequery.app',
      NEXTAUTH_URL: 'https://naturequery.app',
    }

    preferRequestAuthOriginInPreview(env)

    expect(env.AUTH_URL).toBeUndefined()
    expect(env.NEXTAUTH_URL).toBeUndefined()
  })

  it('leaves Production settings unchanged', () => {
    const env = {
      VERCEL_ENV: 'production',
      AUTH_URL: 'https://naturequery.app',
      NEXTAUTH_URL: 'https://naturequery.app',
    }

    preferRequestAuthOriginInPreview(env)

    expect(env.AUTH_URL).toBe('https://naturequery.app')
    expect(env.NEXTAUTH_URL).toBe('https://naturequery.app')
  })
})
