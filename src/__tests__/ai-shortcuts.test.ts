// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseSchema } from '@/types/database'

vi.mock('@/lib/auth', () => ({ auth: async () => null }))

import { generateSQLFromSchema } from '@/actions/ai'

const schema: DatabaseSchema = {
  tables: ['products', "o'brien_notes", 'customers'].map((tableName) => ({
    tableName,
    columns: [{ name: 'id', type: 'int', nullable: false, defaultValue: null, isPrimaryKey: true }],
  })),
}

// No AI key: anything that is not a shortcut falls back to the offline answer.
beforeEach(() => vi.stubEnv('GROQ_API_KEYS', ''))
afterEach(() => vi.unstubAllEnvs())

describe('answers NatureQuery gives without the AI', () => {
  it('lists the known tables on any SQL database, without a PostgreSQL catalog', async () => {
    for (const dbType of ['mysql', 'postgresql', 'sqlserver', 'sqlite', 'clickhouse']) {
      const result = await generateSQLFromSchema('show tables', schema, [], dbType)
      expect(result.sql, dbType).toBe(
        "SELECT 'customers' AS table_name\nUNION ALL\nSELECT 'o''brien_notes'\nUNION ALL\nSELECT 'products'"
      )
    }
  })

  it('adds FROM DUAL on Oracle', async () => {
    const result = await generateSQLFromSchema('What tables are there?', schema, [], 'oracle')
    expect(result.sql).toContain("SELECT 'customers' AS table_name FROM DUAL")
  })

  it('recognises ways people ask for the table list', async () => {
    for (const question of [
      'show tables',
      'List all tables',
      'show me the tables',
      'which tables exist?',
      'What tables do we have',
      'tables in this database',
    ]) {
      const result = await generateSQLFromSchema(question, schema, [], 'mysql')
      expect(result.sql, question).toMatch(/^SELECT 'customers' AS table_name/)
    }
  })

  it('leaves questions about rows to the AI', async () => {
    for (const question of [
      'Show 5 rows from any table',
      'show the products table',
      'which tables have a customer_id column',
    ]) {
      const result = await generateSQLFromSchema(question, schema, [], 'mysql')
      expect(result.sql, question).not.toMatch(/AS table_name|information_schema/)
    }
  })

  it('does not use the shortcut where UNION does not exist', async () => {
    const result = await generateSQLFromSchema('show tables', schema, [], 'cassandra')
    expect(result.sql).not.toMatch(/UNION ALL/)
  })
})
