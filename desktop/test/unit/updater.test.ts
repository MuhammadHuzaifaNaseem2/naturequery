import { describe, expect, it, vi } from 'vitest'

vi.mock('electron-updater', () => ({ autoUpdater: { on: vi.fn() } }))

const { friendlyError, plainNotes, createUpdater } = await import('../../src/main/updater')

describe('updates', () => {
  it('turns release notes into plain text', () => {
    expect(
      plainNotes('<h2>Fixes</h2><ul><li>Faster <b>Oracle</b> schemas</li><li>Sign-in</li></ul>')
    ).toBe('Fixes\nFaster Oracle schemas\nSign-in')
    expect(
      plainNotes([
        { version: '1', note: 'One' },
        { version: '2', note: 'Two' },
      ])
    ).toBe('One\nTwo')
    expect(plainNotes(null)).toBeUndefined()
  })

  it('explains update failures without technical noise', () => {
    expect(friendlyError(new Error('No published versions on GitHub'))).toBeNull()
    expect(friendlyError(new Error('net::ERR_INTERNET_DISCONNECTED'))).toMatch(
      /internet connection/
    )
    expect(friendlyError(new Error('sha512 checksum mismatch'))).toMatch(/could not be verified/)
    expect(friendlyError(new Error('something odd'))).toBe(
      'Could not check for updates. Try again later.'
    )
  })

  it('stays off in development builds', async () => {
    const updater = createUpdater({
      packaged: false,
      emit: () => {},
      automaticChecks: () => true,
      logger: { info() {}, warn() {}, error() {} },
    })
    expect(updater.status()).toEqual({
      state: 'disabled',
      reason: 'Development builds do not update.',
    })
    expect(await updater.check()).toEqual(updater.status())
  })

  it('leaves updates to the Microsoft Store in Store installs', async () => {
    const { autoUpdater } = await import('electron-updater')
    vi.mocked(autoUpdater.on).mockClear()
    const updater = createUpdater({
      packaged: true,
      store: true,
      emit: () => {},
      automaticChecks: () => true,
      logger: { info() {}, warn() {}, error() {} },
    })
    expect(updater.status()).toEqual({
      state: 'disabled',
      reason: 'The Microsoft Store installs updates for you.',
    })
    expect(await updater.check()).toEqual(updater.status())
    // Never wired to GitHub releases.
    expect(autoUpdater.on).not.toHaveBeenCalled()
  })
})
