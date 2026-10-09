import { describe, expect, it } from 'vitest'
import {
  applyConnectionUrl,
  draftFromConnection,
  draftToInput,
  emptyDraft,
} from '../../src/renderer/features/connections/draft'
import { splitServer, splitWindowsUser } from '../../src/engine/drivers/sqlserver'
import { zoomAction } from '../../src/main/zoom'

describe('connection form', () => {
  it('builds a save request with sensible defaults', () => {
    const draft = {
      ...emptyDraft('postgresql'),
      host: 'db.local',
      user: 'reader',
      password: 'pw',
      database: 'sales',
    }
    expect(draftToInput(draft)).toMatchObject({
      name: 'PostgreSQL · sales',
      type: 'postgresql',
      host: 'db.local',
      port: 5432,
      user: 'reader',
      tls: { mode: 'prefer' },
      secrets: { password: 'pw' },
      ssh: { enabled: false },
    })
  })

  it('does not resend secrets left blank while editing', () => {
    const draft = draftFromConnection({
      id: 'c1',
      name: 'ERP',
      type: 'sqlserver',
      host: 'ERP01',
      port: 1433,
      user: 'reader',
      sqlserver: {
        auth: 'sql',
        encrypt: true,
        trustServerCertificate: true,
        instance: 'SQLEXPRESS',
      },
      createdAt: '',
      updatedAt: '',
      savedSecrets: ['password'],
    })
    const input = draftToInput(draft)
    expect(input.secrets).toEqual({})
    expect(input.sqlserver?.instance).toBe('SQLEXPRESS')
    expect(input.tls).toBeUndefined()
  })

  it('reads pasted connection URLs', () => {
    const next = applyConnectionUrl(
      emptyDraft('postgresql'),
      'postgres://app%40x:p%23ss@db.example.com:6543/shop?sslmode=verify-full'
    )
    expect(next).toMatchObject({
      type: 'postgresql',
      host: 'db.example.com',
      port: '6543',
      user: 'app@x',
      password: 'p#ss',
      database: 'shop',
      tlsMode: 'verify-full',
    })
    expect(applyConnectionUrl(emptyDraft('mysql'), 'mysql://root@localhost/app')?.type).toBe(
      'mysql'
    )
    expect(applyConnectionUrl(emptyDraft('postgresql'), 'not a url')).toBeNull()
    // Keeps a compatible family type, such as Neon for a postgres:// URL.
    expect(applyConnectionUrl(emptyDraft('neon'), 'postgres://u:p@ep-x.neon.tech/db')?.type).toBe(
      'neon'
    )
  })
})

describe('SQL Server names', () => {
  it('accepts SERVER\\INSTANCE and DOMAIN\\user forms', () => {
    expect(splitServer('ERP01\\SQLEXPRESS', undefined)).toEqual({
      server: 'ERP01',
      instance: 'SQLEXPRESS',
    })
    expect(splitServer('ERP01', 'PROD')).toEqual({ server: 'ERP01', instance: 'PROD' })
    expect(splitServer('ERP01', '')).toEqual({ server: 'ERP01', instance: undefined })
    expect(splitWindowsUser('COMPANY\\jane', undefined)).toEqual({
      domain: 'COMPANY',
      userName: 'jane',
    })
    expect(splitWindowsUser('jane', 'COMPANY')).toEqual({ domain: 'COMPANY', userName: 'jane' })
  })
})

describe('zoom shortcuts', () => {
  const base = {
    type: 'keyDown' as const,
    control: true,
    meta: false,
    alt: false,
    shift: false,
    key: '',
    code: '',
  }
  it('recognizes main keyboard and numpad keys', () => {
    expect(zoomAction({ ...base, key: '=' }, 'win32')).toBe('in')
    expect(zoomAction({ ...base, key: '+', shift: true }, 'win32')).toBe('in')
    expect(zoomAction({ ...base, code: 'NumpadAdd' }, 'win32')).toBe('in')
    expect(zoomAction({ ...base, key: '-' }, 'win32')).toBe('out')
    expect(zoomAction({ ...base, key: '0' }, 'win32')).toBe('reset')
    expect(zoomAction({ ...base, control: false, meta: true, key: '+' }, 'darwin')).toBe('in')
  })

  it('leaves typing, AltGr and other shortcuts alone', () => {
    expect(zoomAction({ ...base, control: false, key: '+' }, 'win32')).toBeNull()
    expect(zoomAction({ ...base, alt: true, key: '+' }, 'win32')).toBeNull()
    expect(zoomAction({ ...base, key: 's' }, 'win32')).toBeNull()
    expect(zoomAction({ ...base, type: 'keyUp', key: '+' }, 'win32')).toBeNull()
  })
})
