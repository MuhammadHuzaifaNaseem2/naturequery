// @vitest-environment node
import crypto from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The second layer of read-only protection: the database itself refuses writes,
 * even from a query that skipped the read-only check. Creates and drops its own
 * PostgreSQL database beside a DATABASE_URL on localhost (never production), and
 * its own libSQL file. Runs with NQ_WEB_IT=1.
 */
const adminUrl = process.env.DATABASE_URL ?? ''
const enabled = process.env.NQ_WEB_IT === '1' && /127\.0\.0\.1|localhost/.test(adminUrl)

async function runSql(connectionString: string, sql: string) {
  const { Client } = await import('pg')
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

describe.skipIf(!enabled)('read-only protection inside PostgreSQL', () => {
  const run = crypto.randomUUID().slice(0, 8)
  const dbName = `nq_readonly_it_${run}`
  const url = new URL(adminUrl || 'postgresql://localhost/unused')
  url.pathname = `/${dbName}`

  beforeAll(async () => {
    await runSql(adminUrl, `CREATE DATABASE ${dbName}`)
    await runSql(
      url.toString(),
      "CREATE TABLE items (id int PRIMARY KEY, name text); INSERT INTO items VALUES (1, 'first')"
    )
    // Uploaded files are stored in this database too.
    process.env.MAGIC_DATABASE_URL = url.toString()
  })

  afterAll(async () => {
    const magic = await import('@/lib/magic-dataset')
    await magic
      .getPool()
      .end()
      .catch(() => {})
    await runSql(adminUrl, `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  })

  it('refuses a write that skipped the check', async () => {
    const { createPostgresDriver } = await import('@/lib/db-drivers')
    const driver = createPostgresDriver({
      host: url.hostname,
      port: Number(url.port || 5432),
      database: dbName,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      dbType: 'postgresql',
    })
    try {
      await expect(driver.executeQuery("INSERT INTO items VALUES (2, 'second')")).rejects.toThrow(
        /read-only transaction/
      )
      const result = await driver.executeQuery('SELECT id, name FROM items')
      expect(result.rows).toEqual([{ id: 1, name: 'first' }])
    } finally {
      await driver.close()
    }
  })

  it('lets a user read only their own uploaded tables', async () => {
    const magic = await import('@/lib/magic-dataset')
    const owner = `it-owner-${run}`
    const other = `it-other-${run}`
    await magic.ingestCsv({
      userId: owner,
      csvText: 'region,amount\nNorth,10\nSouth,5\nNorth,7\n',
      filename: 'sales.csv',
    })
    await magic.ingestCsv({ userId: other, csvText: 'note\nprivate\n', filename: 'notes.csv' })

    const own = await magic.runMagicQuery({
      userId: owner,
      sql: 'SELECT region, SUM(amount) AS total FROM sales GROUP BY region ORDER BY region',
      maxRows: 10,
    })
    expect(own.rows).toEqual([
      { region: 'North', total: '17' },
      { region: 'South', total: '5' },
    ])

    for (const sql of [
      `SELECT * FROM "${magic.userSchemaName(other)}".notes`,
      'SELECT * FROM notes',
      'SELECT * FROM items',
      'SELECT * FROM pg_tables',
    ]) {
      await expect(magic.runMagicQuery({ userId: owner, sql, maxRows: 10 }), sql).rejects.toThrow(
        /not one of your uploaded tables/
      )
    }
  })
})

describe.skipIf(process.env.NQ_WEB_IT !== '1')('read-only protection inside libSQL', () => {
  // SQLite has no true read-only transaction, so the driver never commits one.
  it('never saves a write that skipped the check', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'nq-libsql-'))
    const url = `file:${path.join(dir, 'check.db').replace(/\\/g, '/')}`
    const { createClient } = await import('@libsql/client')
    const setup = createClient({ url })
    await setup.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)')
    await setup.execute("INSERT INTO items VALUES (1, 'first')")
    setup.close()

    const { createTursoDriver } = await import('@/lib/db-drivers')
    const driver = createTursoDriver({ host: '', port: 0, database: url, user: '', password: '' })
    try {
      await driver.executeQuery("INSERT INTO items VALUES (2, 'second')").catch(() => {})
      const result = await driver.executeQuery('SELECT id, name FROM items')
      expect(result.rows).toHaveLength(1)
    } finally {
      await driver.close()
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // On Windows a local libSQL file stays open until garbage collection.
      }
    }
  })
})
