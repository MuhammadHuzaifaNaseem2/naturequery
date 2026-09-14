import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateSQLSafety } from '@/lib/sql-validator'
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }))
vi.mock('pg', () => ({
  Pool: class {
    connect = async () => mocks
    end = vi.fn()
  },
}))
import { createPostgresDriver } from '@/lib/db-drivers'

describe('SQL write protection', () => {
  it.each([
    'WITH changed AS (DELETE FROM orders RETURNING *) SELECT * FROM changed',
    'WITH changed AS (UPDATE orders SET amount = 0 RETURNING *) SELECT * FROM changed',
    'WITH changed AS (INSERT INTO orders (amount) VALUES (1) RETURNING *) SELECT * FROM changed',
    'SELECT * FROM orders FOR UPDATE',
    'SELECT * INTO copied FROM orders',
  ])('rejects %s', (sql) => expect(validateSQLSafety(sql).valid).toBe(false))
  it.each([
    'WITH totals AS (SELECT sum(amount) AS amount FROM orders) SELECT * FROM totals',
    "SELECT 'DELETE FROM orders' AS example",
    'SELECT 1 UNION SELECT 2',
  ])('allows %s', (sql) => expect(validateSQLSafety(sql).valid).toBe(true))
})
describe('PostgreSQL transaction enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.mockReset()
    mocks.query.mockResolvedValue({
      rows: [{ amount: 1 }],
      fields: [{ name: 'amount' }],
      rowCount: 1,
    })
  })
  const driver = () =>
    createPostgresDriver({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    })
  it('begins read-only before running SQL and commits afterward', async () => {
    const result = await driver().executeQuery('SELECT amount FROM orders')
    expect(mocks.query.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN READ ONLY',
      expect.stringMatching(/^SET LOCAL statement_timeout = /),
      'SELECT amount FROM orders',
      'COMMIT',
    ])
    expect(result.rows).toEqual([{ amount: 1 }])
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })
  it('rolls back a failed query before releasing the connection', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql === 'SELECT fail()') throw new Error('read only')
      return {}
    })
    await expect(driver().executeQuery('SELECT fail()')).rejects.toThrow('read only')
    expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK')
    expect(mocks.release).toHaveBeenCalledWith(false)
  })
  it('discards a connection if rollback also fails', async () => {
    mocks.query.mockRejectedValue(new Error('connection lost'))
    await expect(driver().executeQuery('SELECT 1')).rejects.toThrow('connection lost')
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith(true)
  })
})
