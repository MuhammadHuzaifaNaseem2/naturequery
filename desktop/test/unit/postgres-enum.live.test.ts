import crypto from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPostgresDriver } from '../../src/engine/drivers/postgres'
import { aiSchema } from '../../src/main/ai-schema'
import type { ConnectionConfig } from '../../src/shared/types'

/**
 * Enum columns reach the AI with their values, so it writes role = 'student' instead
 * of lower(role), which PostgreSQL refuses for enums. Creates and drops its own
 * database beside NQ_PG_ADMIN_URL, which must point at localhost.
 */
const adminUrl = process.env.NQ_PG_ADMIN_URL ?? ''
const enabled = /127\.0\.0\.1|localhost/.test(adminUrl)

async function runSql(connectionString: string, sql: string) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

describe.skipIf(!enabled)('PostgreSQL enum values (desktop)', () => {
  const dbName = `nq_desktop_enum_${crypto.randomUUID().slice(0, 8)}`
  const url = new URL(adminUrl || 'postgresql://localhost/unused')
  url.pathname = `/${dbName}`

  beforeAll(async () => {
    await runSql(adminUrl, `CREATE DATABASE ${dbName}`)
    await runSql(
      url.toString(),
      `CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
       CREATE TABLE profiles (id int PRIMARY KEY, role user_role NOT NULL);`
    )
  })

  afterAll(async () => {
    await runSql(adminUrl, `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  })

  it('reads the values and sends them with the schema', async () => {
    const config = {
      id: 'enum-check',
      name: 'Enum check',
      type: 'postgresql',
      host: url.hostname,
      port: Number(url.port || 5432),
      database: dbName,
      user: decodeURIComponent(url.username),
      tls: { mode: 'disable' },
    } as ConnectionConfig
    const driver = createPostgresDriver(
      config,
      { password: decodeURIComponent(url.password) },
      { connectTimeoutMs: 10_000 }
    )
    try {
      const { tables } = await driver.schema()
      const role = tables[0].columns.find((column) => column.name === 'role')
      expect(role).toMatchObject({ type: 'user_role', values: ['student', 'teacher', 'admin'] })
      const [sent] = aiSchema({ tables, fetchedAt: new Date().toISOString() }, 'students')
      expect(sent.columns.find((column) => column.name === 'role')?.values).toEqual([
        'student',
        'teacher',
        'admin',
      ])
    } finally {
      await driver.close()
    }
  })
})
