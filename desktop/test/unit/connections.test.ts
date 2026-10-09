import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertComplete, createConnectionStore } from '../../src/main/connections'
import { createSecretBox, type SafeStorageLike } from '../../src/main/secure-store'
import { connectionInputSchema } from '../../src/main/validation'
import { NqError } from '../../src/shared/errors'
import type { ConnectionConfig, ConnectionInput } from '../../src/shared/types'

// Reversible stand-in for the operating system's encryption.
const fakeSafeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`sealed:${text}`).reverse(),
  decryptString: (buffer) =>
    Buffer.from(buffer)
      .reverse()
      .toString()
      .replace(/^sealed:/, ''),
}

const directories: string[] = []
function fixture(storage: SafeStorageLike = fakeSafeStorage) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-connections-'))
  directories.push(directory)
  const file = path.join(directory, 'connections.json')
  const legacyFile = path.join(directory, 'local-connections.json')
  const store = createConnectionStore({ file, legacyFile, box: createSecretBox(storage) })
  // Inputs go through the same validation as requests from the interface.
  const save = (input: ConnectionInput) => store.save(connectionInputSchema.parse(input))
  return { directory, file, legacyFile, store: { ...store, save } }
}
afterEach(() => {
  for (const directory of directories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true })
})

const postgres = {
  name: 'Sales',
  type: 'postgresql' as const,
  host: 'db.company.local',
  port: 5432,
  database: 'sales',
  user: 'reader',
  tls: { mode: 'require' as const },
  secrets: { password: 'correct horse battery staple' },
}

describe('connection store', () => {
  it('never writes or returns secret values', () => {
    const { store, file } = fixture()
    const saved = store.save(postgres)
    expect(saved).not.toHaveProperty('secrets')
    expect(saved.savedSecrets).toEqual(['password'])
    expect(JSON.stringify(store.list())).not.toContain('battery')
    expect(fs.readFileSync(file, 'utf8')).not.toContain('battery')
    expect(store.resolve(saved.id).secrets.password).toBe('correct horse battery staple')
  })

  it('keeps the saved password when editing without re-entering it', () => {
    const { store } = fixture()
    const saved = store.save(postgres)
    store.save({ ...postgres, id: saved.id, name: 'Renamed', secrets: {} })
    expect(store.get(saved.id).name).toBe('Renamed')
    expect(store.resolve(saved.id).secrets.password).toBe('correct horse battery staple')
  })

  it('clears a secret when asked', () => {
    const { store } = fixture()
    const saved = store.save({ ...postgres, type: 'postgresql' })
    store.save({ ...postgres, id: saved.id, secrets: {}, clearSecrets: ['password'] })
    expect(store.resolve(saved.id).secrets.password).toBeUndefined()
  })

  it('duplicates and removes connections', () => {
    const { store } = fixture()
    const saved = store.save(postgres)
    const copy = store.duplicate(saved.id)
    expect(copy.id).not.toBe(saved.id)
    expect(copy.name).toBe('Sales (copy)')
    expect(store.resolve(copy.id).secrets.password).toBe('correct horse battery staple')
    store.remove(saved.id)
    expect(store.list().map((c) => c.id)).toEqual([copy.id])
  })

  it('preserves a damaged file instead of overwriting it', () => {
    const { store, file } = fixture()
    fs.writeFileSync(file, '{broken')
    expect(() => store.save(postgres)).toThrow(/damaged/)
    expect(fs.readFileSync(file, 'utf8')).toBe('{broken')
  })

  it('refuses to save when the system keychain is unavailable or plain text', () => {
    const unavailable = fixture({ ...fakeSafeStorage, isEncryptionAvailable: () => false })
    expect(() => unavailable.store.save(postgres)).toThrow(/Secure credential storage/)
    const plain = fixture({ ...fakeSafeStorage, getSelectedStorageBackend: () => 'basic_text' })
    expect(() => plain.store.save(postgres)).toThrow(/Secure credential storage/)
  })

  it('imports connections saved by desktop 0.2 and keeps their sealed passwords', () => {
    const { store, legacyFile } = fixture()
    const sealed = {
      method: 'os',
      value: fakeSafeStorage.encryptString('legacy-secret').toString('base64'),
    }
    fs.writeFileSync(
      legacyFile,
      JSON.stringify([
        {
          id: 'local-1',
          name: 'Office DB',
          dbType: 'sqlserver',
          host: '192.168.1.20',
          port: 1433,
          database: 'erp',
          user: 'sa',
          tls: 'auto',
          password: sealed,
        },
        {
          id: 'local-2',
          name: '',
          dbType: 'postgresql',
          host: 'localhost',
          port: '5432',
          database: 'reports',
          user: 'me',
          tls: 'auto',
          password: sealed,
        },
        { id: 'bad', dbType: 'unknown', host: 'x', port: 1, database: 'x', user: 'x' },
      ])
    )
    expect(store.migrateLegacy()).toBe(2)
    const office = store.resolve('local-1')
    expect(office.config.type).toBe('sqlserver')
    expect(office.config.sqlserver).toEqual({
      auth: 'sql',
      encrypt: true,
      trustServerCertificate: false,
    })
    expect(office.secrets.password).toBe('legacy-secret')
    const local = store.resolve('local-2')
    expect(local.config.tls?.mode).toBe('disable')
    expect(local.config.name).toBe('PostgreSQL · reports')
    expect(fs.existsSync(legacyFile)).toBe(false)
    expect(fs.existsSync(`${legacyFile}.v0-backup`)).toBe(true)
    // Running again does nothing.
    expect(store.migrateLegacy()).toBe(0)
  })
})

describe('required fields per database type', () => {
  const base = { id: 'x', name: 'x', createdAt: '', updatedAt: '' }
  const expectMessage = (
    config: ConnectionConfig,
    secrets: Record<string, string>,
    message: RegExp
  ) => {
    try {
      assertComplete(config, secrets)
      throw new Error('expected a validation error')
    } catch (error) {
      expect(error).toBeInstanceOf(NqError)
      expect((error as NqError).message).toMatch(message)
    }
  }

  it('asks for the essentials in plain language', () => {
    expectMessage({ ...base, type: 'postgresql', user: 'a' }, {}, /host/)
    expectMessage({ ...base, type: 'sqlserver', host: 'srv', user: 'sa' }, {}, /password/)
    expectMessage(
      {
        ...base,
        type: 'sqlserver',
        host: 'srv',
        user: 'jane',
        sqlserver: { auth: 'windows', encrypt: true, trustServerCertificate: true },
      },
      { password: 'x' },
      /domain/
    )
    expectMessage(
      { ...base, type: 'sqlite', sqlite: { path: 'Z:/missing.db' } },
      {},
      /could not be found/
    )
    expectMessage(
      {
        ...base,
        type: 'postgresql',
        host: 'db',
        user: 'a',
        ssh: { enabled: true, host: 'jump', port: 22, user: 'me', auth: 'key' },
      },
      {},
      /private key/
    )
  })

  it('accepts DOMAIN\\user for Windows sign-in', () => {
    expect(() =>
      assertComplete(
        {
          ...base,
          type: 'sqlserver',
          host: 'srv',
          user: 'COMPANY\\jane',
          sqlserver: { auth: 'windows', encrypt: true, trustServerCertificate: true },
        },
        { password: 'x' }
      )
    ).not.toThrow()
  })
})
