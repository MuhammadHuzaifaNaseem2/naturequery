'use strict'

// Secure local connection store for NatureQuery Desktop.
//
// Saved local database connections live on the user's own machine, in the
// app's userData folder. Passwords are encrypted with the operating system's
// secure storage (DPAPI on Windows, Keychain on macOS) via Electron's
// safeStorage. The password is only ever decrypted inside the main process at
// connect time; it is never sent to the UI. This is the core promise of the
// desktop app: your credentials never leave your computer.

const { app, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function storePath() {
  return path.join(app.getPath('userData'), 'local-connections.json')
}

function readAll() {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeAll(list) {
  fs.writeFileSync(storePath(), JSON.stringify(list, null, 2), 'utf8')
}

function encryptPassword(pw) {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    return { method: 'os', value: safeStorage.encryptString(pw).toString('base64') }
  }
  // Fallback only when OS encryption is unavailable. Not secure; obfuscation.
  return { method: 'plain', value: Buffer.from(pw, 'utf8').toString('base64') }
}

function decryptPassword(rec) {
  if (!rec || !rec.value) return ''
  if (rec.method === 'os' && safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(rec.value, 'base64'))
    } catch {
      return ''
    }
  }
  return Buffer.from(rec.value, 'base64').toString('utf8')
}

// The shape the UI is allowed to see — note: no password.
function publicView(c) {
  return {
    id: c.id,
    name: c.name,
    dbType: c.dbType,
    host: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
  }
}

function list() {
  return readAll().map(publicView)
}

function save(input) {
  const all = readAll()
  const id = input.id || crypto.randomUUID()
  const record = {
    id,
    name: input.name || `${input.dbType} @ ${input.host}`,
    dbType: input.dbType,
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    password: encryptPassword(input.password || ''),
  }
  const idx = all.findIndex((c) => c.id === id)
  if (idx >= 0) all[idx] = record
  else all.push(record)
  writeAll(all)
  return publicView(record)
}

function remove(id) {
  writeAll(readAll().filter((c) => c.id !== id))
  return { ok: true }
}

// Full credentials, including the decrypted password. Main process only.
function credsFor(id) {
  const c = readAll().find((x) => x.id === id)
  if (!c) return null
  return {
    dbType: c.dbType,
    host: c.host,
    port: c.port,
    database: c.database,
    user: c.user,
    password: decryptPassword(c.password),
  }
}

module.exports = { list, save, remove, credsFor }
