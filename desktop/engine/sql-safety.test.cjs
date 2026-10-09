'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { validateReadOnly, ensureLimit } = require('./sql-safety.cjs')

test('rejects expression and exponential row limits instead of partially clamping them', () => {
  for (const sql of ['SELECT 1 LIMIT 1e9', 'SELECT 1 LIMIT 1 + 999999', 'SELECT 1 LIMIT 10.5']) {
    assert.throws(() => ensureLimit(sql, 1001, 'postgresql'), /numeric row limit/)
  }
  assert.equal(
    ensureLimit('SELECT 1 LIMIT 50000 OFFSET 5', 1001, 'postgresql'),
    'SELECT 1 LIMIT 1001 OFFSET 5'
  )
})

test('allows ordinary read queries and keywords inside literals', () => {
  assert.equal(validateReadOnly('SELECT * FROM orders').valid, true)
  assert.equal(validateReadOnly("SELECT 'DROP table' AS note").valid, true)
  assert.equal(validateReadOnly('WITH totals AS (SELECT 1) SELECT * FROM totals').valid, true)
})

test('blocks multiple statements and data-changing CTEs', () => {
  assert.equal(validateReadOnly('SELECT 1; DELETE FROM users').valid, false)
  assert.equal(
    validateReadOnly('WITH removed AS (DELETE FROM users RETURNING *) SELECT * FROM removed').valid,
    false
  )
})

test('blocks read-shaped statements that can mutate or lock data', () => {
  assert.equal(validateReadOnly('SELECT * INTO backup_users FROM users').valid, false)
  assert.equal(validateReadOnly('SELECT * FROM users FOR UPDATE').valid, false)
  assert.equal(validateReadOnly("COPY users TO '/tmp/users.csv'").valid, false)
})

test('adds a row cap without replacing an existing cap', () => {
  assert.equal(
    ensureLimit('SELECT * FROM users;', 1000, 'postgresql'),
    'SELECT * FROM users\nLIMIT 1000'
  )
  assert.equal(
    ensureLimit('SELECT * FROM users LIMIT 25', 1000, 'postgresql'),
    'SELECT * FROM users LIMIT 25'
  )
  assert.equal(
    ensureLimit('SELECT id FROM users', 1000, 'sqlserver'),
    'SELECT TOP 1000 id FROM users'
  )
})

test('preserves quoted comment markers and caps excessive or nested limits', () => {
  assert.equal(
    ensureLimit("SELECT '--keep this' AS note;", 1000, 'postgresql'),
    "SELECT '--keep this' AS note\nLIMIT 1000"
  )
  assert.equal(
    ensureLimit('SELECT * FROM users LIMIT 50000', 1000, 'postgresql'),
    'SELECT * FROM users LIMIT 1000'
  )
  assert.match(
    ensureLimit('WITH x AS (SELECT * FROM users LIMIT 5) SELECT * FROM x', 1000, 'postgresql'),
    /LIMIT 1000$/
  )
  assert.equal(
    ensureLimit('SELECT * FROM users LIMIT 10, 9000', 1000, 'mysql'),
    'SELECT * FROM users LIMIT 10, 1000'
  )
  assert.match(
    ensureLimit('WITH x AS (SELECT 1 AS n) SELECT n FROM x', 1000, 'sqlserver'),
    /SELECT TOP 1000 n FROM x/
  )
})

test('rejects executable comments, side-effect functions, and malformed literals', () => {
  assert.equal(validateReadOnly("SELECT 1 /*! INTO OUTFILE 'x' */").valid, false)
  assert.equal(validateReadOnly("SELECT nextval('seq')").valid, false)
  assert.equal(validateReadOnly("SELECT 'unclosed").valid, false)
  assert.equal(validateReadOnly('SELECT $$DELETE FROM users$$ AS note').valid, true)
  assert.equal(validateReadOnly('SELECT 1 /* outer /* inner */ still comment */').valid, true)
})

test('hash comments cannot conceal statement batches in PostgreSQL or SQL Server', () => {
  assert.equal(
    validateReadOnly('SELECT 1 # 2; COMMIT; DELETE FROM customers; SELECT 1 --', 'postgresql')
      .valid,
    false
  )
  assert.equal(
    validateReadOnly('SELECT 1 AS #x; DELETE FROM customers; --', 'sqlserver').valid,
    false
  )
  assert.equal(validateReadOnly('SELECT 1 # 2', 'postgresql').valid, true)
  assert.equal(validateReadOnly('SELECT 1 AS #x', 'sqlserver').valid, true)
  assert.equal(validateReadOnly('SELECT 1 # DELETE is only a comment;', 'mysql').valid, true)
  assert.equal(ensureLimit('SELECT 1 # comment', 1000, 'mysql'), 'SELECT 1 # comment\nLIMIT 1000')
})

test('line comments end at either CR or LF and respect MySQL dash syntax', () => {
  for (const dialect of ['postgresql', 'mysql', 'sqlserver']) {
    assert.equal(
      validateReadOnly('SELECT 1 -- comment\r; DELETE FROM customers', dialect).valid,
      false
    )
    assert.equal(
      validateReadOnly('SELECT 1 -- comment\n; DELETE FROM customers', dialect).valid,
      false
    )
    assert.equal(validateReadOnly('SELECT 1 -- harmless comment', dialect).valid, true)
  }
  assert.equal(validateReadOnly('SELECT 1--1; DELETE FROM customers', 'mysql').valid, false)
  assert.equal(validateReadOnly('SELECT 1--1', 'mysql').valid, true)
})

test('backslash handling cannot hide statements and supports explicit PostgreSQL E strings', () => {
  const batch = String.raw`SELECT '\' AS note; DELETE FROM customers; SELECT 'tail'`
  for (const dialect of ['postgresql', 'mysql', 'sqlserver']) {
    assert.equal(validateReadOnly(batch, dialect).valid, false)
    assert.equal(validateReadOnly("SELECT 'can''t' AS note", dialect).valid, true)
  }
  const ordinary = String.raw`SELECT '\' AS note`
  assert.equal(validateReadOnly(ordinary, 'postgresql').valid, false)
  assert.equal(validateReadOnly(ordinary, 'mysql').valid, false)
  assert.equal(validateReadOnly(ordinary, 'sqlserver').valid, true)
  assert.equal(
    validateReadOnly(String.raw`SELECT E'can\'t; DELETE' AS note`, 'postgresql').valid,
    true
  )
  assert.equal(
    validateReadOnly(String.raw`SELECT E'can\'t' AS note; DELETE FROM customers`, 'postgresql')
      .valid,
    false
  )
  assert.equal(
    validateReadOnly(String.raw`SELECT E'can\'t; DELETE' AS note`, 'sqlserver').valid,
    false
  )
})

test('identifier and dollar quoting are specific to their database dialect', () => {
  assert.equal(
    validateReadOnly('SELECT ARRAY[pg_terminate_backend(123)]', 'postgresql').valid,
    false
  )
  assert.equal(validateReadOnly('SELECT [DELETE] FROM [orders]', 'sqlserver').valid, true)
  assert.equal(validateReadOnly('SELECT `DELETE` FROM `orders`', 'mysql').valid, true)
  assert.equal(
    validateReadOnly('SELECT $body$DELETE; UPDATE$body$ AS note', 'postgresql').valid,
    true
  )
  assert.equal(validateReadOnly('SELECT $body$DELETE; UPDATE$body$ AS note', 'mysql').valid, false)
})

test('rejects MariaDB executable comments and ambiguous MySQL nested comments', () => {
  assert.equal(validateReadOnly("SELECT 1 /*M! INTO OUTFILE 'x' */", 'mariadb').valid, false)
  assert.equal(validateReadOnly('SELECT 1 /* outer /* inner */ DELETE */', 'mysql').valid, false)
  assert.equal(validateReadOnly("SELECT '/*! comment text */' AS note", 'mysql').valid, true)
})

test('SQL Server OFFSET/FETCH and TOP expressions are left for the driver ROWCOUNT cap', () => {
  for (const sql of [
    'SELECT * FROM customers ORDER BY id OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY',
    'WITH x AS (SELECT 1 AS n) SELECT n FROM x ORDER BY n OFFSET 0 ROWS',
    'SELECT TOP (100 + 1) * FROM customers',
  ]) {
    assert.equal(validateReadOnly(sql, 'sqlserver').valid, true)
    assert.equal(ensureLimit(sql, 1000, 'sqlserver'), sql)
  }
  assert.equal(
    ensureLimit('SELECT TOP (50000) * FROM customers', 1000, 'sqlserver'),
    'SELECT TOP (1000) * FROM customers'
  )
})
