import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { accountFolderName, openAccountData } from '../../src/main/account-data'
import { createConnectionStore } from '../../src/main/connections'
import { createSecretBox, type SafeStorageLike } from '../../src/main/secure-store'
import { connectionInputSchema } from '../../src/main/validation'
import { openWorkspaceDb } from '../../src/main/workspace-db'

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
const box = createSecretBox(fakeSafeStorage)

const sales = connectionInputSchema.parse({
  name: 'Sales',
  type: 'postgresql',
  host: 'db.company.local',
  port: 5432,
  database: 'sales',
  user: 'reader',
  tls: { mode: 'require' },
  secrets: { password: 'correct horse battery staple' },
})

const history = {
  connectionId: 'c1',
  connectionName: 'Sales',
  text: 'SELECT * FROM orders',
  source: 'editor' as const,
  status: 'success' as const,
  rowCount: 1,
  durationMs: 12,
}

const roots: string[] = []
function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-accounts-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('account workspaces', () => {
  it("keeps each account's connections and history to itself", () => {
    const root = makeRoot()
    const alice = openAccountData({ root, userId: 'user_alice', box })
    alice.connections.save(sales)
    alice.workspace.addHistory(history)
    alice.close()

    const bob = openAccountData({ root, userId: 'user_bob', box })
    expect(bob.connections.list()).toEqual([])
    expect(bob.workspace.listHistory({})).toEqual([])
    bob.close()

    const again = openAccountData({ root, userId: 'user_alice', box })
    expect(again.connections.list().map((c) => c.name)).toEqual(['Sales'])
    expect(again.workspace.listHistory({}).map((h) => h.text)).toEqual(['SELECT * FROM orders'])
    again.close()
  })

  it('gives the first account to sign in the data from earlier versions', () => {
    const root = makeRoot()
    // Before sign-in was required, everything lived directly in the app folder.
    createConnectionStore({ file: path.join(root, 'connections.json'), box }).save(sales)
    const earlier = openWorkspaceDb(path.join(root, 'workspace.db'))
    earlier.addHistory(history)
    earlier.close()

    const first = openAccountData({ root, userId: 'user_owner', box })
    expect(first.connections.list().map((c) => c.name)).toEqual(['Sales'])
    expect(first.workspace.listHistory({})).toHaveLength(1)
    first.close()
    expect(fs.existsSync(path.join(root, 'connections.json'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'workspace.db'))).toBe(false)

    const second = openAccountData({ root, userId: 'user_colleague', box })
    expect(second.connections.list()).toEqual([])
    expect(second.workspace.listHistory({})).toEqual([])
    second.close()
  })

  it('turns account ids into safe folder names', () => {
    expect(accountFolderName('clx9f2abc_DEF-123')).toBe('clx9f2abc_DEF-123')
    expect(accountFolderName('../../Windows')).toBe('______Windows')
    expect(accountFolderName('a/b\\c:d')).not.toMatch(/[\\/:.]/)
    expect(() => accountFolderName('../..')).toThrow()
    expect(() => accountFolderName('')).toThrow()
  })
})
