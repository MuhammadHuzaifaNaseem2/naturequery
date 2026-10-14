// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { middleware } from '@/middleware'

const visit = (path: string) => middleware(new NextRequest(`https://www.naturequery.app${path}`))

describe('pages a signed-out visitor can open', () => {
  it('serves the link-preview image, which WhatsApp, LinkedIn and X fetch while signed out', async () => {
    const res = await visit('/opengraph-image?31225a67f1f861cb')
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('serves public pages such as pricing and the security page', async () => {
    for (const path of ['/pricing', '/security', '/download']) {
      expect((await visit(path)).headers.get('location'), path).toBeNull()
    }
  })

  it('still sends signed-out visitors from the dashboard to the login page', async () => {
    const res = await visit('/dashboard')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?callbackUrl=%2Fdashboard')
  })
})
