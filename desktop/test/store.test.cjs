'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore } = require('../store.cjs')
const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(s),
  decryptString: (b) => b.toString(),
}
const input = {
  name: 'Test',
  dbType: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'test',
  user: 'reader',
  password: 'fixture-password',
}
function fixture(t, storage = encryption) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-store-test-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return { directory, store: createStore({ directory, safeStorage: storage }) }
}
test('passwords never appear in returned metadata; editing preserves them', (t) => {
  const { store, directory } = fixture(t)
  const saved = store.save(input)
  assert.equal(saved.password, undefined)
  assert.equal(store.list()[0].password, undefined)
  assert.equal(
    fs
      .readFileSync(path.join(directory, 'local-connections.json'), 'utf8')
      .includes(input.password),
    false
  )
  store.save({ ...input, id: saved.id, name: 'Renamed', password: undefined })
  assert.equal(store.credsFor(saved.id).password, input.password)
  assert.equal(store.list()[0].name, 'Renamed')
  store.remove(saved.id)
  assert.deepEqual(store.list(), [])
})
test('corrupt connection data is preserved instead of overwritten', (t) => {
  const { store, directory } = fixture(t)
  const filename = path.join(directory, 'local-connections.json')
  fs.writeFileSync(filename, '{broken')
  assert.throws(() => store.save(input), /preserved/)
  assert.equal(fs.readFileSync(filename, 'utf8'), '{broken')
})
test('refuses an unavailable keychain and Linux basic_text storage', (t) => {
  const unavailable = fixture(t, { isEncryptionAvailable: () => false })
  assert.throws(() => unavailable.store.save(input), /unavailable/)
  const plaintext = fixture(t, { ...encryption, getSelectedStorageBackend: () => 'basic_text' })
  assert.throws(() => plaintext.store.save(input), /unavailable/)
})
