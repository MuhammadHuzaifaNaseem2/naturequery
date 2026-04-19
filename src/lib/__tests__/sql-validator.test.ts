import { describe, it, expect } from 'vitest'
import { validateSQLSafety, ensureLimitClause } from '../sql-validator'

describe('SQL Validator', () => {
    describe('PostgreSQL AST Validation', () => {
        it('allows valid SELECT statements', () => {
            const sql = 'SELECT id, name FROM users WHERE active = true'
            expect(validateSQLSafety(sql, 'postgresql')).toEqual({ valid: true })
        })

        it('allows WITH clauses (CTEs)', () => {
            const sql = 'WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM active_users'
            expect(validateSQLSafety(sql, 'postgresql')).toEqual({ valid: true })
        })

        it('blocks INSERT statements', () => {
            const sql = "INSERT INTO users (name) VALUES ('hacker')"
            const result = validateSQLSafety(sql, 'postgresql')
            expect(result.valid).toBe(false)
            expect(result.error).toContain('Only SELECT queries are allowed')
        })

        it('blocks DROP TABLE', () => {
            const sql = 'DROP TABLE users'
            const result = validateSQLSafety(sql, 'postgresql')
            expect(result.valid).toBe(false)
        })

        it('blocks multiple statements (SQL Injection check)', () => {
            const sql = 'SELECT 1; DROP TABLE users'
            const result = validateSQLSafety(sql, 'postgresql')
            expect(result.valid).toBe(false)
            expect(result.error).toContain('Multiple SQL statements')
        })
    })

    describe('Regex Fallback Validation (MySQL, SQLite, etc.)', () => {
        it('allows valid SELECT', () => {
            const sql = 'SELECT * FROM products'
            expect(validateSQLSafety(sql, 'mysql')).toEqual({ valid: true })
        })

        it('allows keywords inside string literals (Safe Regex Check)', () => {
            const sql = "SELECT 'System DROP detected' as message, 100 as score"
            // The old regex would block this because it contains "DROP"
            expect(validateSQLSafety(sql, 'mysql')).toEqual({ valid: true })
        })

        it('blocks dangerous keywords even if middle of query', () => {
            const sql = 'SELECT * FROM users; DELETE FROM users'
            expect(validateSQLSafety(sql, 'mysql').valid).toBe(false)
        })

        it('allows SHOW statements for MySQL', () => {
            const sql = 'SHOW TABLES'
            expect(validateSQLSafety(sql, 'mysql')).toEqual({ valid: true })
        })

        it('blocks UNION-based injection attempt', () => {
            const sql = 'SELECT name FROM users UNION SELECT password FROM secrets'
            // This is actually a SELECT statement, so it's valid structurally,
            // but we might want to flag it. Currently, our policy is SELECT-only,
            // so UNION is allowed as it is a SELECT variant.
            expect(validateSQLSafety(sql, 'mysql')).toEqual({ valid: true })
        })
    })

    describe('Limit Injection', () => {
        it('injects LIMIT for PostgreSQL', () => {
            const sql = 'SELECT * FROM logs'
            expect(ensureLimitClause(sql, 100, 'postgresql')).toBe('SELECT * FROM logs\nLIMIT 100')
        })

        it('injects TOP for SQL Server', () => {
            const sql = 'SELECT name, email FROM users'
            expect(ensureLimitClause(sql, 50, 'sqlserver')).toBe('SELECT TOP 50 name, email FROM users')
        })

        it('injects FETCH FIRST for Oracle', () => {
            const sql = 'SELECT * FROM hr.employees'
            expect(ensureLimitClause(sql, 10, 'oracle')).toBe('SELECT * FROM hr.employees\nFETCH FIRST 10 ROWS ONLY')
        })

        it('does not double-inject if LIMIT already exists', () => {
            const sql = 'SELECT * FROM logs LIMIT 500'
            expect(ensureLimitClause(sql, 100, 'postgresql')).toBe(sql)
        })

        it('handles LIMIT with casing and comments', () => {
            const sql = 'SELECT * FROM logs -- fetch some\nlimit 100;'
            expect(ensureLimitClause(sql, 50, 'postgresql')).toBe(sql)
        })
        
        it('ignores LIMIT inside single quotes', () => {
            const sql = "SELECT 'This has no LIMIT here' as text FROM table"
            expect(ensureLimitClause(sql, 10, 'postgresql')).toBe(sql + '\nLIMIT 10')
        })
    })
})
