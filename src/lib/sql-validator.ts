/**
 * SQL Safety Validator
 * Every query passes the shared read-only guard (src/lib/sql-guard.ts, the same rules
 * as NatureQuery Desktop): one statement, a read keyword first, no writing keywords,
 * no risky functions for that database, and no writing MongoDB stages. The
 * PostgreSQL family is also parsed, which catches writes inside CTEs.
 * Used in both server actions and API routes to prevent data destruction.
 */
import { parse } from 'pgsql-ast-parser'
import type { DatabaseType } from '@/lib/db-drivers'
import {
  assertReadOnlyMongo,
  assertReadOnlySql,
  guardDialectFor,
  SqlGuardError,
} from '@/lib/sql-guard'

const ALLOWED_STATEMENT_TYPES = new Set([
  'select',
  'union',
  'union all',
  'with',
  'with recursive',
  'intersect',
  'intersect all',
  'except',
  'except all',
])

/**
 * Validate that a query only reads. Returns a user-facing reason when it does not.
 */
export function validateSQLSafety(
  sql: string,
  dialect: DatabaseType = 'postgresql'
): { valid: boolean; error?: string } {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'SQL query is empty' }
  }

  const guard = guardDialectFor(dialect)
  try {
    if (guard === 'mongodb') {
      assertReadOnlyMongo(sql)
      return { valid: true }
    }
    // Firestore queries are structured JSON that the driver turns into reads only.
    if (guard === 'firestore') return { valid: true }
    assertReadOnlySql(sql, guard)
  } catch (error) {
    if (error instanceof SqlGuardError) {
      const reason = error.message.replace(/\.?$/, '.')
      return { valid: false, error: error.hint ? `${reason} ${error.hint}` : error.message }
    }
    throw error
  }

  // The PostgreSQL family is also parsed: this catches writes inside CTEs.
  if (guard === 'postgresql') return validateWithPgParser(sql)
  return { valid: true }
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

  // Inspect nested statements as well: WITH can contain DELETE/INSERT/UPDATE.
  const forbidden = new Set(['insert', 'update', 'delete', 'create table', 'drop table'])
  function containsWrite(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false
    if (Array.isArray(node)) return node.some(containsWrite)
    const record = node as Record<string, unknown>
    if (typeof record.type === 'string' && forbidden.has(record.type)) return true
    if (record.type === 'select' && (record.into || record.for)) return true
    return Object.values(record).some(containsWrite)
  }
  if (containsWrite(statements)) {
    return {
      valid: false,
      error: 'Only read-only SELECT queries are allowed, including inside CTEs.',
    }
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
 * Temporarily remove string literals and comments so the LIMIT check below
 * looks at the actual SQL keywords.
 */
function stripLiterals(sql: string): string {
  return sql
    .replace(/'(?:''|[^'])*'/g, "''") // Replace 'single' quotes
    .replace(/"(?:""|[^"])*"/g, '""') // Replace "double" quotes
    .replace(/`(?:``|[^`])*`/g, '``') // Replace `backticks`
    .replace(/--.*$/gm, '') // Remove -- comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* block comments */
}

// ── LIMIT Injection ──────────────────────────────────────────────────────

/**
 * Strip trailing comments and semicolons from SQL so we can reliably
 * inspect the tail of the actual query body.
 */
function stripTrailing(sql: string): string {
  return sql
    .replace(/--[^\n]*$/gm, '')
    .replace(/\s*;+\s*$/, '')
    .trim()
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
