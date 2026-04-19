/**
 * SQL Safety Validator
 * Enforces SELECT-only queries using AST parsing (PostgreSQL/Redshift)
 * and regex-based validation (MySQL, SQLite, SQL Server, others).
 * Used in both server actions and API routes to prevent data destruction.
 */
import { parse } from 'pgsql-ast-parser'
import type { DatabaseType } from '@/lib/db-drivers'

const ALLOWED_STATEMENT_TYPES = new Set(['select', 'union', 'with'])

/**
 * Universal dangerous-keyword blocklist. Defense-in-depth layer that runs
 * for ALL dialects before any parser-specific validation.
 */
const DANGEROUS_KEYWORDS =
  /\b(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|CREATE|GRANT|REVOKE|EXEC(?:UTE)?|LOAD\s+DATA|INTO\s+(?:OUT|DUMP)FILE|CALL|MERGE|REPLACE\s+INTO|RENAME|SET\s+(?:GLOBAL|SESSION)|SHUTDOWN|KILL)\b/i

/**
 * Validate SQL safety. Uses full AST parsing for PostgreSQL/Redshift,
 * and a strict regex-based approach for other dialects.
 */
export function validateSQLSafety(
  sql: string,
  dialect: DatabaseType = 'postgresql'
): { valid: boolean; error?: string } {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'SQL query is empty' }
  }

  if (dialect === 'mongodb') {
    return { valid: true }
  }

  // ── Universal checks (all dialects) ────────────────────────────────────

  // Reject multiple statements — prevents "SELECT 1; DROP TABLE x"
  if (sql.replace(/;+\s*$/, '').includes(';')) {
    return { valid: false, error: 'Multiple SQL statements are not allowed' }
  }

  // Dangerous keyword blocklist (defense-in-depth)
  if (DANGEROUS_KEYWORDS.test(sql)) {
    // Allow "SET" inside SELECT (e.g., OFFSET) but not standalone SET statements
    const trimmed = sql.trim().toUpperCase()
    if (trimmed.startsWith('SET')) {
      return {
        valid: false,
        error: 'Only SELECT queries are allowed. This platform is read-only to protect your data.',
      }
    }
    // Check if the dangerous keyword is at the statement level (not inside a subquery or string)
    // For safety, if it matches at the start, reject immediately
    const firstWord = trimmed.split(/\s+/)[0]
    const blockedStarters = new Set([
      'DROP', 'ALTER', 'TRUNCATE', 'DELETE', 'INSERT', 'UPDATE', 'CREATE',
      'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'LOAD', 'CALL', 'MERGE',
      'REPLACE', 'RENAME', 'SHUTDOWN', 'KILL',
    ])
    if (blockedStarters.has(firstWord)) {
      return {
        valid: false,
        error: `Only SELECT queries are allowed. Got: ${firstWord}. This platform is read-only to protect your data.`,
      }
    }
  }

  // ── Dialect-specific validation ────────────────────────────────────────

  if (dialect === 'postgresql' || dialect === 'redshift') {
    return validateWithPgParser(sql)
  }

  // For MySQL, SQLite, SQL Server, MariaDB, Oracle — regex-based validation
  return validateWithRegex(sql)
}

/**
 * Full AST validation for PostgreSQL and Redshift.
 */
function validateWithPgParser(sql: string): { valid: boolean; error?: string } {
  let statements
  try {
    statements = parse(sql)
  } catch {
    // Parser can't understand it — reject rather than guess
    return { valid: false, error: 'Could not parse SQL query. Ensure it is valid SQL syntax.' }
  }

  if (statements.length === 0) {
    return { valid: false, error: 'No SQL statements found' }
  }

  if (statements.length > 1) {
    return { valid: false, error: 'Only a single SQL statement is allowed' }
  }

  const stmt = statements[0]
  if (!ALLOWED_STATEMENT_TYPES.has(stmt.type)) {
    return {
      valid: false,
      error: `Only SELECT queries are allowed. Got: ${stmt.type.toUpperCase()}. This platform is read-only to protect your data.`,
    }
  }

  return { valid: true }
}

/**
 * Temporarily remove string literals and comments so we can run regex
 * checks against the actual SQL keywords without false positives.
 */
function stripLiterals(sql: string): string {
  return sql
    .replace(/'(?:''|[^'])*'/g, "''")      // Replace 'single' quotes
    .replace(/"(?:""|[^"])*"/g, '""')      // Replace "double" quotes
    .replace(/`(?:``|[^`])*`/g, '``')      // Replace `backticks`
    .replace(/--.*$/gm, '')                // Remove -- comments
    .replace(/\/\*[\s\S]*?\*\//g, '')      // Remove /* block comments */
}

/**
 * Regex-based validation for non-PostgreSQL dialects.
 * Ensures the statement starts with SELECT, WITH, or EXPLAIN.
 */
function validateWithRegex(sql: string): { valid: boolean; error?: string } {
  const stripped = stripLiterals(sql)
  const trimmed = stripped.trim()
  const upper = trimmed.toUpperCase()

  // 1. Check for dangerous keywords in the "clean" SQL
  if (DANGEROUS_KEYWORDS.test(stripped)) {
    const matched = stripped.match(DANGEROUS_KEYWORDS)?.[0] || 'Unknown keyword'
    return {
      valid: false,
      error: `Only SELECT queries are allowed. Got forbidden keyword: ${matched.toUpperCase()}.`,
    }
  }

  // 2. Must start with a safe keyword
  const safeStarters = [
    'SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'DESC', 
    'PRAGMA', 'LIST', 'GET', 'CHECK'
  ]
  const firstWord = upper.split(/[\s(]+/)[0]

  if (!safeStarters.includes(firstWord)) {
    return {
      valid: false,
      error: `Only SELECT queries are allowed. Got: ${firstWord}. This platform is read-only to protect your data.`,
    }
  }

  return { valid: true }
}

// ── LIMIT Injection ──────────────────────────────────────────────────────

/**
 * Strip trailing comments and semicolons from SQL so we can reliably
 * inspect the tail of the actual query body.
 */
function stripTrailing(sql: string): string {
  return sql.replace(/--[^\n]*$/gm, '').replace(/\s*;+\s*$/, '').trim()
}

/**
 * Check whether the *outermost* statement already contains a LIMIT, TOP,
 * or FETCH FIRST clause. Uses stripLiterals to ignore keywords in strings.
 */
function hasLimitClause(sql: string): boolean {
  const stripped = stripLiterals(sql)
  // Find text after the last ')' — this usually gets the tail limit/offset
  const lastParen = stripped.lastIndexOf(')')
  const tail = lastParen >= 0 ? stripped.slice(lastParen) : stripped
  const upper = tail.toUpperCase()

  return (
    /\bLIMIT\s+(\d+|\?|\$)/i.test(upper) ||
    /\bTOP\s+\d+/i.test(upper) ||
    /\bFETCH\s+(FIRST|NEXT)\s+(\d+|\?|\$)/i.test(upper) ||
    /\bROWNUM\b/i.test(upper) ||
    /\bOFFSET\s+\d+\s+ROWS\s+FETCH\s+NEXT/i.test(upper)
  )
}

/**
 * Ensures the SQL has a LIMIT clause. If one is missing, silently injects
 * `LIMIT maxRows` (or TOP/FETCH equivalent) based on the database dialect.
 */
export function ensureLimitClause(
  sql: string,
  maxRows: number = 1000,
  dialect: DatabaseType = 'postgresql'
): string {
  const cleaned = stripTrailing(sql)
  const upper = cleaned.toUpperCase()

  // Don't inject LIMIT on non-SELECT statements (EXPLAIN, SHOW, DESCRIBE, PRAGMA)
  const firstWord = upper.split(/[\s(]+/)[0]
  if (!['SELECT', 'WITH'].includes(firstWord)) return sql

  // Already has a limit → leave untouched
  if (hasLimitClause(cleaned)) return sql

  // 1. SQL Server uses TOP N
  if (dialect === 'sqlserver') {
    return cleaned.replace(/^(SELECT\s+)(DISTINCT\s+)?/i, `$1$2TOP ${maxRows} `)
  }

  // 2. Oracle uses FETCH FIRST N ROWS ONLY (12c+) or ROWNUM (legacy)
  if (dialect === 'oracle') {
    return `${cleaned}\nFETCH FIRST ${maxRows} ROWS ONLY`
  }

  // 3. BigQuery / DB2 / PostgreSQL / MySQL / SQLite use LIMIT
  return `${cleaned}\nLIMIT ${maxRows}`
}
