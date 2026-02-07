import { describe, it, expect } from 'vitest'
import { parse } from 'pgsql-ast-parser'

/**
 * We test the same validation logic used in actions/ai.ts.
 * Extracted here to test without the server action wrapper.
 */
const ALLOWED_STATEMENT_TYPES = new Set(['select', 'union', 'with'])

function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'Generated SQL is empty' }
  }

  if (sql.replace(/;+\s*$/, '').includes(';')) {
    return { valid: false, error: 'Multiple SQL statements are not allowed' }
  }

  let statements
  try {
    statements = parse(sql)
  } catch {
    return { valid: false, error: 'Could not parse SQL query. Ensure it is valid PostgreSQL syntax.' }
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
      error: `Only SELECT queries are allowed. Got: ${stmt.type.toUpperCase()}`,
    }
  }

  return { valid: true }
}

describe('SQL Validation', () => {
  describe('valid SELECT queries', () => {
    it('allows simple SELECT', () => {
      expect(validateSQL('SELECT * FROM users;')).toEqual({ valid: true })
    })

    it('allows SELECT with WHERE', () => {
      expect(validateSQL('SELECT name, email FROM users WHERE id = 1;')).toEqual({ valid: true })
    })

    it('allows SELECT with JOIN', () => {
      const sql = 'SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id;'
      expect(validateSQL(sql)).toEqual({ valid: true })
    })

    it('allows SELECT with CTE (WITH clause)', () => {
      const sql = 'WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM active_users;'
      expect(validateSQL(sql)).toEqual({ valid: true })
    })

    it('allows SELECT with subquery', () => {
      const sql = 'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);'
      expect(validateSQL(sql)).toEqual({ valid: true })
    })

    it('allows aggregate functions', () => {
      const sql = 'SELECT COUNT(*), AVG(amount) FROM orders GROUP BY status HAVING COUNT(*) > 5;'
      expect(validateSQL(sql)).toEqual({ valid: true })
    })

    it('allows UNION', () => {
      const sql = 'SELECT name FROM customers UNION SELECT name FROM suppliers;'
      expect(validateSQL(sql)).toEqual({ valid: true })
    })
  })

  describe('blocked dangerous statements', () => {
    it('rejects DROP TABLE', () => {
      const result = validateSQL('DROP TABLE users;')
      expect(result.valid).toBe(false)
    })

    it('rejects DELETE', () => {
      const result = validateSQL('DELETE FROM users WHERE id = 1;')
      expect(result.valid).toBe(false)
    })

    it('rejects UPDATE', () => {
      const result = validateSQL("UPDATE users SET name = 'hacked' WHERE id = 1;")
      expect(result.valid).toBe(false)
    })

    it('rejects INSERT', () => {
      const result = validateSQL("INSERT INTO users (name) VALUES ('hacker');")
      expect(result.valid).toBe(false)
    })

    it('rejects ALTER TABLE', () => {
      const result = validateSQL('ALTER TABLE users ADD COLUMN hacked boolean;')
      expect(result.valid).toBe(false)
    })

    it('rejects CREATE TABLE', () => {
      const result = validateSQL('CREATE TABLE evil (id int);')
      expect(result.valid).toBe(false)
    })

    it('rejects TRUNCATE', () => {
      const result = validateSQL('TRUNCATE TABLE users;')
      expect(result.valid).toBe(false)
    })
  })

  describe('injection attack prevention', () => {
    it('rejects piggy-backed DROP after SELECT', () => {
      const result = validateSQL('SELECT 1; DROP TABLE users;')
      expect(result.valid).toBe(false)
    })

    it('rejects piggy-backed DELETE after SELECT', () => {
      const result = validateSQL('SELECT 1; DELETE FROM users;')
      expect(result.valid).toBe(false)
    })

    it('rejects multiple statements', () => {
      const result = validateSQL('SELECT 1; SELECT 2;')
      expect(result.valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('rejects empty string', () => {
      expect(validateSQL('')).toEqual({ valid: false, error: 'Generated SQL is empty' })
    })

    it('rejects whitespace-only string', () => {
      expect(validateSQL('   ')).toEqual({ valid: false, error: 'Generated SQL is empty' })
    })

    it('rejects invalid SQL syntax', () => {
      const result = validateSQL('NOT VALID SQL AT ALL')
      expect(result.valid).toBe(false)
    })

    it('allows column names that contain reserved words (e.g., updated_at)', () => {
      const sql = 'SELECT updated_at, deleted_at FROM audit_log;'
      expect(validateSQL(sql)).toEqual({ valid: true })
    })
  })
})
