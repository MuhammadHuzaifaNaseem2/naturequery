import { describe, expect, it } from 'vitest'
import { NqError } from '../../src/shared/errors'
import { applyRowLimit, assertReadOnlySql, type SqlDialect } from '../../src/engine/safety/sql'

const allows = (sql: string, dialect: SqlDialect = 'postgresql') => {
  expect(() => assertReadOnlySql(sql, dialect)).not.toThrow()
}
/** Requires a real validation error from the guard, never an accidental crash. */
const blocks = (sql: string, dialect: SqlDialect = 'postgresql', message?: RegExp) => {
  let caught: unknown
  try {
    assertReadOnlySql(sql, dialect)
  } catch (error) {
    caught = error
  }
  expect(caught, `expected "${sql}" to be blocked`).toBeInstanceOf(NqError)
  expect((caught as NqError).code).toBe('VALIDATION')
  if (message)
    expect(`${(caught as NqError).message} ${(caught as NqError).hint ?? ''}`).toMatch(message)
}

describe('read-only SQL guard', () => {
  it('allows ordinary read queries and keywords inside literals', () => {
    allows('SELECT * FROM orders')
    allows("SELECT 'DROP table' AS note")
    allows('WITH totals AS (SELECT 1) SELECT * FROM totals')
    allows('(SELECT 1) UNION (SELECT 2)')
  })

  it('allows common functions that share names with write keywords', () => {
    allows("SELECT REPLACE(phone, '-', '') FROM customers")
    allows("SELECT REPLACE(name, 'a', 'b') AS cleaned FROM t", 'mysql')
    allows('SELECT CAST(name AS CHAR CHARACTER SET utf8mb4) FROM t', 'mysql')
    allows('SELECT updated_at, created_at, deleted_flag FROM t')
    allows('EXPLAIN ANALYZE SELECT * FROM orders')
  })

  it('blocks multiple statements and data-changing CTEs', () => {
    blocks('SELECT 1; DELETE FROM users', 'postgresql', /one statement/)
    blocks('WITH removed AS (DELETE FROM users RETURNING *) SELECT * FROM removed')
  })

  it('blocks read-shaped statements that write or lock', () => {
    blocks('SELECT * INTO backup_users FROM users', 'postgresql', /INTO/)
    blocks('SELECT * FROM users FOR UPDATE', 'postgresql', /FOR UPDATE/)
    blocks('SELECT * FROM users FOR NO KEY UPDATE')
    blocks('SELECT * FROM users FOR SHARE')
    blocks("COPY users TO '/tmp/users.csv'")
    blocks('SELECT * FROM t LOCK IN SHARE MODE', 'mysql')
  })

  it('names the blocked statement in the message', () => {
    blocks('DELETE FROM customers WHERE id = 1', 'sqlite', /DELETE statements are not allowed/)
    blocks('UPDATE t SET a = 1', 'sqlserver', /UPDATE statements are not allowed/)
  })

  it('rejects executable comments, side-effect functions and malformed literals', () => {
    blocks("SELECT 1 /*! INTO OUTFILE 'x' */", 'mysql', /executable comments/)
    // MariaDB connections use the MySQL dialect.
    blocks("SELECT 1 /*M! INTO OUTFILE 'x' */", 'mysql', /executable comments/)
    blocks("SELECT nextval('seq')", 'postgresql', /NEXTVAL/)
    blocks("SELECT 'unclosed", 'postgresql', /not closed/)
    allows('SELECT $$DELETE FROM users$$ AS note')
    allows('SELECT 1 /* outer /* inner */ still comment */')
  })

  it('blocks PostgreSQL functions that bypass read-only transactions', () => {
    blocks("SELECT dblink_exec('dbname=x', 'DELETE FROM t')")
    blocks("SELECT query_to_xml('select 1', true, true, '')")
    blocks('SELECT pg_terminate_backend(123)')
    blocks('SELECT ARRAY[pg_terminate_backend(123)]')
    blocks("SELECT set_config('x', 'y', false)")
    blocks('SELECT pg_advisory_lock(1)')
  })

  it('hash comments cannot conceal statement batches in PostgreSQL or SQL Server', () => {
    blocks('SELECT 1 # 2; COMMIT; DELETE FROM customers; SELECT 1 --', 'postgresql')
    blocks('SELECT 1 AS #x; DELETE FROM customers; --', 'sqlserver')
    allows('SELECT 1 # 2', 'postgresql')
    allows('SELECT 1 AS #x', 'sqlserver')
    allows('SELECT 1 # DELETE is only a comment;', 'mysql')
  })

  it('line comments end at CR or LF and respect MySQL dash syntax', () => {
    for (const dialect of ['postgresql', 'mysql', 'sqlserver'] as SqlDialect[]) {
      blocks('SELECT 1 -- comment\r; DELETE FROM customers', dialect)
      blocks('SELECT 1 -- comment\n; DELETE FROM customers', dialect)
      allows('SELECT 1 -- harmless comment', dialect)
    }
    blocks('SELECT 1--1; DELETE FROM customers', 'mysql')
    allows('SELECT 1--1', 'mysql')
  })

  it('backslash handling cannot hide statements', () => {
    const batch = String.raw`SELECT '\' AS note; DELETE FROM customers; SELECT 'tail'`
    for (const dialect of ['postgresql', 'mysql', 'sqlserver'] as SqlDialect[]) {
      blocks(batch, dialect)
      allows("SELECT 'can''t' AS note", dialect)
    }
    blocks(String.raw`SELECT '\' AS note`, 'postgresql')
    blocks(String.raw`SELECT '\' AS note`, 'mysql')
    allows(String.raw`SELECT '\' AS note`, 'sqlserver')
    allows(String.raw`SELECT E'can\'t; DELETE' AS note`, 'postgresql')
    blocks(String.raw`SELECT E'can\'t' AS note; DELETE FROM customers`, 'postgresql')
    blocks(String.raw`SELECT E'can\'t; DELETE' AS note`, 'sqlserver')
  })

  it('identifier and dollar quoting are specific to each dialect', () => {
    allows('SELECT [DELETE] FROM [orders]', 'sqlserver')
    allows('SELECT `DELETE` FROM `orders`', 'mysql')
    allows('SELECT $body$DELETE; UPDATE$body$ AS note', 'postgresql')
    blocks('SELECT $body$DELETE; UPDATE$body$ AS note', 'mysql')
    allows('SELECT "Order Details" FROM "Sales"', 'sqlite')
    allows('SELECT [Order Details] FROM [Sales]', 'sqlite')
  })

  it('handles Oracle quote operators and blocks risky packages', () => {
    allows("SELECT q'[It's a DELETE; UPDATE]' AS note FROM dual", 'oracle')
    allows("SELECT q'{text}' FROM dual", 'oracle')
    blocks("SELECT UTL_HTTP.REQUEST('http://x') FROM dual", 'oracle', /UTL_HTTP/)
    blocks('EXPLAIN PLAN FOR SELECT 1 FROM dual', 'oracle')
    allows('SELECT * FROM employees FETCH FIRST 10 ROWS ONLY', 'oracle')
  })

  it('handles BigQuery, Snowflake and ClickHouse string rules', () => {
    allows("SELECT '''multi\nline; DELETE''' AS note", 'bigquery')
    allows('SELECT r"raw\\path; DELETE" AS note', 'bigquery')
    allows("SELECT 'it\\'s fine; DELETE' AS note", 'bigquery')
    allows('SELECT $$DELETE; UPDATE$$ AS note', 'snowflake')
    allows("SELECT 'it\\'s; DELETE' FROM t", 'snowflake')
    allows("SELECT 'a\\'b; DROP' FROM t", 'clickhouse')
    blocks('SELECT SYSTEM$CANCEL_ALL_QUERIES(1)', 'snowflake')
    blocks('SYSTEM DROP DNS CACHE', 'clickhouse')
    allows('SHOW TABLES', 'clickhouse')
    allows('// a comment\nSELECT 1', 'snowflake')
  })

  it('accepts only SELECT for Cassandra and DynamoDB', () => {
    allows('SELECT * FROM shop.orders WHERE id = 5', 'cql')
    blocks('INSERT INTO shop.orders (id) VALUES (1)', 'cql')
    blocks('BEGIN BATCH INSERT INTO t (a) VALUES (1) APPLY BATCH', 'cql')
    allows('SELECT * FROM "Orders" WHERE "pk" = \'a\'', 'partiql')
    blocks('UPDATE "Orders" SET x = 1', 'partiql')
  })

  it('allows metadata statements where the database supports them', () => {
    allows('SHOW TABLES', 'mysql')
    allows('DESCRIBE orders', 'mysql')
    allows('PRAGMA table_info(orders)', 'sqlite')
    allows('SHOW search_path', 'postgresql')
    blocks('SHOW TABLES', 'sqlserver')
  })

  it('allows PRAGMA only for reading details', () => {
    allows('PRAGMA main.index_list(orders)', 'sqlite')
    allows('pragma TABLE_XINFO("order items");', 'sqlite')
    allows('PRAGMA user_version', 'sqlite')
    blocks('PRAGMA user_version = 5', 'sqlite', /PRAGMA user_version is not allowed/)
    blocks('PRAGMA journal_mode(WAL)', 'sqlite', /PRAGMA journal_mode/)
    blocks('PRAGMA optimize', 'sqlite', /PRAGMA optimize/)
    blocks('PRAGMA writable_schema = ON', 'sqlite')
  })
})

describe('row limits', () => {
  it('adds a limit without replacing a smaller one', () => {
    expect(applyRowLimit('SELECT * FROM users;', 1000, 'mysql')).toBe(
      'SELECT * FROM users\nLIMIT 1000'
    )
    expect(applyRowLimit('SELECT * FROM users LIMIT 25', 1000, 'mysql')).toBe(
      'SELECT * FROM users LIMIT 25'
    )
    expect(applyRowLimit('SELECT * FROM users LIMIT 50000', 1000, 'mysql')).toBe(
      'SELECT * FROM users LIMIT 1000'
    )
    expect(applyRowLimit('SELECT * FROM users LIMIT 10, 9000', 1000, 'mysql')).toBe(
      'SELECT * FROM users LIMIT 10, 1000'
    )
  })

  it('keeps quoted comment markers and handles nested limits', () => {
    expect(applyRowLimit("SELECT '--keep this' AS note;", 1000, 'mysql')).toBe(
      "SELECT '--keep this' AS note\nLIMIT 1000"
    )
    expect(
      applyRowLimit('WITH x AS (SELECT * FROM users LIMIT 5) SELECT * FROM x', 1000, 'mysql')
    ).toMatch(/LIMIT 1000$/)
    expect(applyRowLimit('SELECT 1 # comment', 1000, 'mysql')).toBe(
      'SELECT 1 # comment\nLIMIT 1000'
    )
  })

  it('refuses limit expressions instead of partially clamping them', () => {
    for (const sql of ['SELECT 1 LIMIT 1e9', 'SELECT 1 LIMIT 1 + 999999', 'SELECT 1 LIMIT 10.5']) {
      expect(() => applyRowLimit(sql, 1001, 'mysql')).toThrow(/plain number/)
    }
    expect(applyRowLimit('SELECT 1 LIMIT 50000 OFFSET 5', 1001, 'mysql')).toBe(
      'SELECT 1 LIMIT 1001 OFFSET 5'
    )
  })

  it('leaves metadata statements unchanged', () => {
    expect(applyRowLimit('SHOW TABLES', 100, 'mysql')).toBe('SHOW TABLES')
    expect(applyRowLimit('DESCRIBE orders;', 100, 'mysql')).toBe('DESCRIBE orders')
  })
})
