'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createPolicy, validateConnection, isOAuthRedirect } = require('../policy.cjs')
const policy = createPolicy('https://naturequery.app', path.resolve(__dirname, '../renderer'))
test('trusts only configured origins and exact bundled screens', () => {
  assert.equal(policy.isTrusted('https://www.naturequery.app/dashboard'), true)
  assert.equal(policy.isTrusted('https://naturequery.app.evil.example/'), false)
  assert.equal(policy.isTrusted('http://naturequery.app/'), false)
  assert.equal(policy.isTrusted('https://naturequery.app@evil.example/'), false)
  assert.equal(
    policy.isLocal(pathToFileURL(path.resolve(__dirname, '../renderer/local.html')).href),
    true
  )
  assert.equal(
    policy.isLocal(pathToFileURL(path.resolve(__dirname, '../renderer/welcome.html')).href),
    false
  )
})
test('only loopback development may use HTTP', () => {
  assert.throws(() => createPolicy('http://example.com', '.'), /HTTPS/)
  assert.equal(
    createPolicy('http://127.0.0.1:3000', '.').isTrusted('http://127.0.0.1:3000/login'),
    true
  )
})
test('validates connection type, port, credentials, TLS and edited passwords', () => {
  const valid = {
    dbType: 'postgresql',
    host: ' localhost ',
    port: '5432',
    database: 'sample',
    user: 'reader',
    password: '',
  }
  assert.equal(validateConnection(valid).host, 'localhost')
  for (const patch of [
    { port: 'invalid' },
    { port: 0 },
    { dbType: 'unknown' },
    { user: '' },
    { tls: 'insecure' },
    { password: undefined },
  ]) {
    assert.throws(() => validateConnection({ ...valid, ...patch }))
  }
  assert.equal(
    validateConnection({ ...valid, id: 'saved-id', password: undefined }, true).password,
    undefined
  )
})
test('recognizes only the supported external OAuth authorization URLs', () => {
  assert.equal(isOAuthRedirect('https://accounts.google.com/o/oauth2/v2/auth?client_id=test'), true)
  assert.equal(isOAuthRedirect('https://github.com/login/oauth/authorize?client_id=test'), true)
  assert.equal(isOAuthRedirect('https://github.com.evil.example/login/oauth/authorize'), false)
  assert.equal(isOAuthRedirect('http://accounts.google.com/o/oauth2/v2/auth'), false)
  assert.equal(isOAuthRedirect('https://github.com/settings/apps'), false)
})
