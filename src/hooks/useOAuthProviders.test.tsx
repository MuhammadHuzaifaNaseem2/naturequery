import { act } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOAuthProviders } from './useOAuthProviders'

function readProviders() {
  let providers: ReturnType<typeof useOAuthProviders> | undefined
  function Probe() {
    providers = useOAuthProviders()
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    act(() => root.render(<Probe />))
    return providers
  } finally {
    act(() => root.unmount())
  }
}

function installDesktopBridge() {
  window.naturequery = {
    isDesktop: true,
    platform: 'win32',
    localdb: {
      openManager: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      test: vi.fn(),
      schema: vi.fn(),
      query: vi.fn(),
    },
  }
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  delete window.naturequery
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_GITHUB_ENABLED', 'true')
})
afterEach(() => {
  delete window.naturequery
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('useOAuthProviders', () => {
  it('keeps configured OAuth providers in a browser', () => {
    expect(readProviders()).toEqual({ isDesktop: false, google: true, github: true })
  })
  it('respects disabled provider configuration in browsers', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENABLED', 'false')
    expect(readProviders()).toEqual({ isDesktop: false, google: false, github: true })
  })
  it('hides OAuth only in desktop', () => {
    installDesktopBridge()
    expect(readProviders()).toEqual({ isDesktop: true, google: false, github: false })
  })
  it('hydrates without a mismatch before applying desktop state', async () => {
    function AuthOptions() {
      const providers = useOAuthProviders()
      return <div>{providers.isDesktop ? 'Email and password' : 'Browser sign-in'}</div>
    }
    const container = document.createElement('div')
    container.innerHTML = renderToString(<AuthOptions />)
    expect(container.textContent).toBe('Browser sign-in')
    installDesktopBridge()
    const onRecoverableError = vi.fn()
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, <AuthOptions />, { onRecoverableError })
      })
      expect(container.textContent).toBe('Email and password')
      expect(onRecoverableError).not.toHaveBeenCalled()
    } finally {
      act(() => root?.unmount())
    }
  })
})
