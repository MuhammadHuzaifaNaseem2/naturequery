// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * What the PostgreSQL driver tells the AI about column types. Enums used to arrive
 * as "USER-DEFINED", so the AI guessed and wrote lower(role), which PostgreSQL
 * refuses for enums. Creates and drops its own database beside a DATABASE_URL on
 * localhost (never production). Runs with NQ_WEB_IT=1.
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

describe.skipIf(!enabled)('PostgreSQL column types', () => {
  const dbName = `nq_schema_it_${crypto.randomUUID().slice(0, 8)}`
  const url = new URL(adminUrl || 'postgresql://localhost/unused')
  url.pathname = `/${dbName}`

  beforeAll(async () => {
    await runSql(adminUrl, `CREATE DATABASE ${dbName}`)
    await runSql(
      url.toString(),
      `CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
       CREATE TABLE profiles (id int PRIMARY KEY, role user_role NOT NULL, tags text[]);`
    )
  })

  afterAll(async () => {
    await runSql(adminUrl, `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  })

  it('names enums and arrays, and lists the enum values in order', async () => {
    const { createPostgresDriver } = await import('@/lib/db-drivers')
    const driver = createPostgresDriver({
      host: url.hostname,
      port: Number(url.port || 5432),
      database: dbName,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    })
    try {
      const [profiles] = await driver.fetchSchema()
      const column = (name: string) => profiles.columns.find((c) => c.name === name)
      expect(column('role')).toMatchObject({
        type: 'user_role',
        values: ['student', 'teacher', 'admin'],
      })
      expect(column('tags')).toMatchObject({ type: 'text[]' })
      expect(column('tags')?.values).toBeUndefined()
      expect(column('id')?.type).toBe('integer')
    } finally {
      await driver.close()
    }
  })
})
