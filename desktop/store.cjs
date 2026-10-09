'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

// A factory allows tests to use temporary directories and fake OS encryption.
function createStore({ directory, safeStorage }) {
  const filename = path.join(directory, 'local-connections.json')
  function readAll() {
    try {
      const records = JSON.parse(fs.readFileSync(filename, 'utf8'))
      if (!Array.isArray(records)) throw new Error('Invalid connection file')
      return records
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw new Error(
        'Your connection file could not be read. It has been preserved. Contact support before adding connections.'
      )
    }
  }
  function writeAll(records) {
    fs.mkdirSync(directory, { recursive: true })
    const temporary = filename + '.' + crypto.randomUUID() + '.tmp'
    try {
      fs.writeFileSync(temporary, JSON.stringify(records, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      })
      fs.renameSync(temporary, filename)
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
  }
  function secureStorageAvailable() {
    return (
      safeStorage?.isEncryptionAvailable() &&
      safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
    )
  }
  function encrypt(value) {
    if (!secureStorageAvailable())
      throw new Error(
        'Secure credential storage is unavailable. Unlock your system keychain and try again.'
      )
    return { method: 'os', value: safeStorage.encryptString(value).toString('base64') }
  }
  function decrypt(record) {
    if (record?.method !== 'os' || !secureStorageAvailable()) {
      throw new Error('This password cannot be unlocked. Edit the connection and enter it again.')
    }
    try {
      return safeStorage.decryptString(Buffer.from(record.value, 'base64'))
    } catch {
      throw new Error('This password cannot be unlocked. Edit the connection and enter it again.')
    }
  }
  function publicView(record) {
    const { id, name, dbType, host, port, database, user, tls } = record
    return { id, name, dbType, host, port: Number(port), database, user, tls: tls || 'auto' }
  }
  function save(input) {
    const records = readAll()
    const existing = input.id ? records.find((record) => record.id === input.id) : undefined
    if (input.id && !existing) throw new Error('Connection no longer exists. Add it again.')
    const record = {
      ...publicView(input),
      id: existing?.id || crypto.randomUUID(),
      name: input.name?.trim() || input.dbType + ' · ' + input.database,
      password:
        input.password === undefined && existing
          ? existing.password
          : encrypt(input.password || ''),
    }
    const index = records.findIndex((item) => item.id === record.id)
    if (index < 0) records.push(record)
    else records[index] = record
    writeAll(records)
    return publicView(record)
  }
  function credsFor(id) {
    const record = readAll().find((item) => item.id === id)
    return record ? { ...publicView(record), password: decrypt(record.password) } : null
  }
  return {
    list: () => readAll().map(publicView),
    save,
    remove(id) {
      writeAll(readAll().filter((record) => record.id !== id))
      return { ok: true }
    },
    credsFor,
  }
}

let defaultStore
function store() {
  if (!defaultStore) {
    const { app, safeStorage } = require('electron')
    defaultStore = createStore({ directory: app.getPath('userData'), safeStorage })
  }
  return defaultStore
}
module.exports = {
  createStore,
  list: () => store().list(),
  save: (input) => store().save(input),
  remove: (id) => store().remove(id),
  credsFor: (id) => store().credsFor(id),
}
