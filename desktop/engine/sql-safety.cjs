'use strict'

// SQL read-only safety for the desktop engine.
//
// Mirrors the regex protection layer of the web app's src/lib/sql-validator.ts
// so the desktop enforces the same promise: NatureQuery only ever reads data,
// it never modifies it. Blocks destructive keywords, multiple statements, and
// anything that does not start as a read query. Also caps result size with a
// LIMIT/TOP clause so a huge table cannot be pulled down by accident.

const DANGEROUS_KEYWORDS =
  /\b(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|CREATE|GRANT|REVOKE|EXEC(?:UTE)?|LOAD\s+DATA|INTO\s+(?:OUT|DUMP)FILE|CALL|MERGE|REPLACE\s+INTO|RENAME|SET\s+(?:GLOBAL|SESSION)|SHUTDOWN|KILL)\b/i

const SAFE_STARTERS = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'DESC', 'PRAGMA']

// Blank out string literals and comments so keywords inside them (e.g. a value
// like 'DROP off the package') don't trigger a false positive.
function stripLiterals(sql) {
  return sql
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, '``')
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function validateReadOnly(sql) {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'SQL query is empty' }
  }

  const stripped = stripLiterals(sql)

  // Reject multiple statements — prevents "SELECT 1; DROP TABLE x"
  if (stripped.replace(/;+\s*$/, '').includes(';')) {
    return { valid: false, error: 'Multiple SQL statements are not allowed' }
  }

  // Block destructive keywords
  if (DANGEROUS_KEYWORDS.test(stripped)) {
    const matched = (stripped.match(DANGEROUS_KEYWORDS) || [])[0] || 'a forbidden keyword'
    return {
      valid: false,
      error: `Only read-only queries are allowed. Found: ${String(matched).toUpperCase().trim()}. NatureQuery never modifies your data.`,
    }
  }

  // Must start with a safe, read-only keyword
  const firstWord = stripped.trim().toUpperCase().split(/[\s(]+/)[0]
  if (!SAFE_STARTERS.includes(firstWord)) {
    return {
      valid: false,
      error: `Only read-only queries are allowed. Got: ${firstWord}. NatureQuery never modifies your data.`,
    }
  }

  return { valid: true }
}

// ── Result-size cap ────────────────────────────────────────────────────────

function stripTrailing(sql) {
  return sql
    .replace(/--[^\n]*$/gm, '')
    .replace(/\s*;+\s*$/, '')
    .trim()
}

function hasLimitClause(sql) {
  const stripped = stripLiterals(sql)
  const lastParen = stripped.lastIndexOf(')')
  const tail = (lastParen >= 0 ? stripped.slice(lastParen) : stripped).toUpperCase()
  return (
    /\bLIMIT\s+(\d+|\?|\$)/i.test(tail) ||
    /\bTOP\s+\d+/i.test(tail) ||
    /\bFETCH\s+(FIRST|NEXT)\s+(\d+|\?|\$)/i.test(tail)
  )
}

// Inject a row cap if the query doesn't already have one.
function ensureLimit(sql, maxRows, dbType) {
  const cleaned = stripTrailing(sql)
  const firstWord = cleaned.toUpperCase().split(/[\s(]+/)[0]
  if (!['SELECT', 'WITH'].includes(firstWord)) return sql
  if (hasLimitClause(cleaned)) return sql

  if (dbType === 'sqlserver' || dbType === 'mssql') {
    return cleaned.replace(/^(SELECT\s+)(DISTINCT\s+)?/i, `$1$2TOP ${maxRows} `)
  }
  return `${cleaned}\nLIMIT ${maxRows}`
}

module.exports = { validateReadOnly, ensureLimit }
