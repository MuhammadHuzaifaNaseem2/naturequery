'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { validateReadOnly, ensureLimit } = require('./sql-safety.cjs')

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
  assert.equal(ensureLimit('SELECT * FROM users;', 1000, 'postgresql'), 'SELECT * FROM users\nLIMIT 1000')
  assert.equal(ensureLimit('SELECT * FROM users LIMIT 25', 1000, 'postgresql'), 'SELECT * FROM users LIMIT 25')
  assert.equal(ensureLimit('SELECT id FROM users', 1000, 'sqlserver'), 'SELECT TOP 1000 id FROM users')
})
