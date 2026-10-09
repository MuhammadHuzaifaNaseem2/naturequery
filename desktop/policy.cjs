'use strict'

const path = require('node:path')
const { fileURLToPath } = require('node:url')

const TYPES = new Set(['postgresql', 'mysql', 'mariadb', 'sqlserver'])

function createPolicy(webUrl, rendererDirectory) {
  const configured = new URL(webUrl)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname)
  if (configured.protocol !== 'https:' && !(loopback && configured.protocol === 'http:')) {
    throw new Error('NatureQuery requires HTTPS, except for localhost development.')
  }
  const origins = new Set([configured.origin])
  if (['naturequery.app', 'www.naturequery.app'].includes(configured.hostname)) {
    origins.add('https://naturequery.app')
    origins.add('https://www.naturequery.app')
  }
  const localPages = new Set(
    ['local.html', 'offline.html'].map((name) => path.resolve(rendererDirectory, name))
  )
  function isLocal(raw) {
    try {
      const url = new URL(raw)
      return url.protocol === 'file:' && localPages.has(path.resolve(fileURLToPath(url)))
    } catch {
      return false
    }
  }
  function isTrusted(raw) {
    try {
      return origins.has(new URL(raw).origin) || isLocal(raw)
    } catch {
      return false
    }
  }
  return { isTrusted, isLocal }
}

function validateConnection(input, allowStoredPassword = false) {
  if (!input || typeof input !== 'object') throw new Error('Enter connection details first.')
  if (!TYPES.has(input.dbType)) throw new Error('Choose a supported database type.')
  for (const field of ['host', 'database', 'user']) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > 255) {
      throw new Error(`Enter a valid ${field}.`)
    }
  }
  const port = Number(input.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Port must be between 1 and 65535.')
  if (input.id !== undefined) validateId(input.id)
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.length > 120)) {
    throw new Error('Connection name must be 120 characters or fewer.')
  }
  if (
    !(allowStoredPassword && input.id && input.password === undefined) &&
    (typeof input.password !== 'string' || input.password.length > 4096)
  ) {
    throw new Error('Enter a valid password.')
  }
  if (input.tls !== undefined && !['auto', 'verify'].includes(input.tls)) {
    throw new Error('Choose a valid connection security setting.')
  }
  return {
    ...input,
    port,
    host: input.host.trim(),
    database: input.database.trim(),
    user: input.user.trim(),
  }
}

function validateId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new Error('Invalid connection ID.')
}

function validateSql(sql) {
  if (typeof sql !== 'string' || !sql.trim() || sql.length > 100000)
    throw new Error('Enter a query of up to 100,000 characters.')
}

function isOAuthRedirect(raw) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    return (
      (url.hostname === 'accounts.google.com' && url.pathname.startsWith('/o/oauth2/')) ||
      (url.hostname === 'github.com' && url.pathname === '/login/oauth/authorize')
    )
  } catch {
    return false
  }
}

module.exports = { createPolicy, validateConnection, validateId, validateSql, isOAuthRedirect }
