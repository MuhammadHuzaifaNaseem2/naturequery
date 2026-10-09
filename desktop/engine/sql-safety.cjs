'use strict'

// This is a defense-in-depth filter, not a SQL sandbox. Use a read-only DB
// account. PostgreSQL/MySQL execution also uses a read-only transaction.
function dialectFor(dbType) {
  if (['mysql', 'mariadb', 'planetscale'].includes(dbType)) return 'mysql'
  if (['sqlserver', 'mssql'].includes(dbType)) return 'sqlserver'
  return 'postgresql'
}
function maskSql(sql, dbType = 'postgresql') {
  const dialect = dialectFor(dbType)
  let output = '',
    i = 0
  while (i < sql.length) {
    const start = i
    const dashComment =
      sql.startsWith('--', i) &&
      (dialect !== 'mysql' || i + 2 === sql.length || /[\s\x00-\x20]/.test(sql[i + 2]))
    if (dashComment || (dialect === 'mysql' && sql[i] === '#')) {
      while (i < sql.length && sql[i] !== '\n' && sql[i] !== '\r') i++
    } else if (sql.startsWith('/*', i)) {
      if (/^\/\*(?:[!+]|M!)/i.test(sql.slice(i))) {
        throw new Error('Executable comments and optimizer hints are not supported.')
      }
      let depth = 1
      i += 2
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) {
          if (dialect === 'mysql')
            throw new Error('Nested comments are not supported for MySQL or MariaDB.')
          depth++
          i += 2
        } else if (sql.startsWith('*/', i)) {
          depth--
          i += 2
        } else i++
      }
      if (depth) throw new Error('Close the SQL comment before running the query.')
    } else if (
      ["'", '"'].includes(sql[i]) ||
      (dialect === 'mysql' && sql[i] === '\x60') ||
      (dialect === 'sqlserver' && sql[i] === '[')
    ) {
      const end = sql[i] === '[' ? ']' : sql[i]
      // PostgreSQL E strings explicitly opt into backslash escaping. Ordinary
      // PostgreSQL/MySQL strings depend on server settings, so refuse ambiguous
      // escapes instead of potentially hiding a second statement.
      const escapeString =
        dialect === 'postgresql' &&
        end === "'" &&
        /[eE]/.test(sql[i - 1] || '') &&
        !/[\w$]/.test(sql[i - 2] || '')
      i++
      let closed = false
      while (i < sql.length) {
        if (sql[i] === end) {
          if (sql[i + 1] === end) {
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        if (sql[i] === '\\') {
          if (escapeString) {
            i += 2
            continue
          }
          if ((dialect === 'postgresql' && end === "'") || dialect === 'mysql') {
            throw new Error(
              'Use doubled quotes instead of backslash escapes, or an explicit PostgreSQL E string.'
            )
          }
        }
        i++
      }
      if (!closed) throw new Error('Close the quoted text before running the query.')
    } else if (
      dialect === 'postgresql' &&
      sql[i] === '$' &&
      !/[\w$]/.test(sql[i - 1] || '') &&
      /^\$(?:[A-Za-z_]\w*)?\$/.test(sql.slice(i))
    ) {
      const marker = sql.slice(i).match(/^\$(?:[A-Za-z_]\w*)?\$/)[0]
      const end = sql.indexOf(marker, i + marker.length)
      if (end < 0) throw new Error('Close the quoted text before running the query.')
      i = end + marker.length
    } else {
      output += sql[i++]
      continue
    }
    output += sql.slice(start, i).replace(/[^\n]/g, ' ')
  }
  return output
}
const forbidden =
  /\b(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|CREATE|GRANT|REVOKE|EXEC(?:UTE)?|CALL|MERGE|REPLACE|RENAME|SET|SHUTDOWN|KILL|COPY|VACUUM|ANALYZE|LOCK|UNLOCK|INTO|FOR\s+SHARE|OPENROWSET|OPENDATASOURCE|NEXTVAL|SETVAL|PG_ADVISORY_LOCK|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|LO_IMPORT|LO_EXPORT)\b/i
function validateReadOnly(sql, dbType = 'postgresql') {
  if (typeof sql !== 'string' || !sql.trim()) return { valid: false, error: 'SQL query is empty.' }
  let masked
  try {
    masked = maskSql(sql, dbType)
  } catch (error) {
    return { valid: false, error: error.message }
  }
  if (masked.replace(/;\s*$/, '').includes(';'))
    return { valid: false, error: 'Run one SQL statement at a time.' }
  if (!/^\s*(SELECT|WITH)\b/i.test(masked))
    return { valid: false, error: 'Use a SELECT query, optionally with a WITH clause.' }
  if (forbidden.test(masked))
    return {
      valid: false,
      error: 'This workspace only accepts read queries. Use a read-only database account.',
    }
  return { valid: true }
}
function topLevel(masked) {
  let depth = 0,
    output = ''
  for (const char of masked) {
    if (char === '(') depth++
    output += depth ? ' ' : char
    if (char === ')') depth--
  }
  return output
}
function ensureLimit(sql, maxRows, dbType) {
  const masked = maskSql(sql, dbType)
  const semicolon = /;\s*$/.exec(masked)
  let cleaned = semicolon ? sql.slice(0, semicolon.index) + sql.slice(semicolon.index + 1) : sql
  const outer = topLevel(maskSql(cleaned, dbType))
  if (dbType === 'sqlserver' || dbType === 'mssql') {
    // SQL Server's driver also sets ROWCOUNT on its isolated connection.
    const select = /\bSELECT\s+(?:DISTINCT\s+|ALL\s+)?/i.exec(outer)
    if (!select) return cleaned
    const offset = select.index + select[0].length
    // TOP cannot be combined with OFFSET/FETCH in SQL Server. ROWCOUNT on
    // the isolated driver connection caps these queries without rewriting.
    if (/\b(?:OFFSET|FETCH)\b/i.test(outer)) return cleaned
    const top = /^TOP\s*(?:\(\s*(\d+)\s*\)|(\d+))\s*/i.exec(cleaned.slice(offset))
    if (top)
      return (
        cleaned.slice(0, offset) +
        top[0].replace(/\d+/, (n) => String(Math.min(Number(n), maxRows))) +
        cleaned.slice(offset + top[0].length)
      )
    if (/^TOP\b/i.test(outer.slice(offset))) return cleaned
    return cleaned.slice(0, offset) + 'TOP ' + maxRows + ' ' + cleaned.slice(offset)
  }
  const limit = /\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i.exec(outer)
  if (limit) {
    // Do not clamp only the first digit sequence of LIMIT 1e9 or LIMIT 1 + 999999.
    // Require the complete top-level limit clause to have a bounded numeric form.
    const tail = outer.slice(limit.index + limit[0].length)
    if (!/^\s*(?:OFFSET\s+\d+\s*(?:ROWS?\s*)?)?$/i.test(tail)) {
      throw new Error('Use a numeric row limit in this workspace.')
    }
    const value = limit[2] || limit[1]
    const relative = limit[0].lastIndexOf(value)
    const start = limit.index + relative
    return (
      cleaned.slice(0, start) +
      Math.min(Number(value), maxRows) +
      cleaned.slice(start + value.length)
    )
  }
  const fetch = /\bFETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY/i.exec(outer)
  if (fetch) {
    const start = fetch.index + fetch[0].indexOf(fetch[1])
    return (
      cleaned.slice(0, start) +
      Math.min(Number(fetch[1]), maxRows) +
      cleaned.slice(start + fetch[1].length)
    )
  }
  if (/\b(LIMIT|FETCH)\b/i.test(outer))
    throw new Error('Use a numeric row limit in this workspace.')
  return cleaned.trimEnd() + '\nLIMIT ' + maxRows
}
module.exports = { validateReadOnly, ensureLimit }
