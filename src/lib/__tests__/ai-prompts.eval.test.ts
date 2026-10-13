// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { DatabaseSchema } from '@/types/database'

vi.mock('@/lib/auth', () => ({ auth: async () => null }))

/**
 * Real AI answers to questions people actually asked, on both the website and
 * NatureQuery Desktop. Uses the AI provider, so it runs only with NQ_AI_EVAL=1 and
 * a GROQ_API_KEYS value. Answers vary a little, so the student question runs three
 * times and must be answered every time.
 */
const enabled = process.env.NQ_AI_EVAL === '1' && !!process.env.GROQ_API_KEYS
const RUNS = 3

type Column = DatabaseSchema['tables'][number]['columns'][number]
const col = (name: string, type: string, isPrimaryKey = false): Column => ({
  name,
  type,
  nullable: !isPrimaryKey,
  defaultValue: null,
  isPrimaryKey,
})

const academy: DatabaseSchema = {
  tables: [
    {
      tableName: 'profiles',
      columns: [
        col('id', 'uuid', true),
        col('full_name', 'text'),
        col('email', 'text'),
        col('role', 'text'),
        col('created_at', 'timestamptz'),
      ],
    },
    {
      tableName: 'courses',
      columns: [col('id', 'uuid', true), col('title', 'text'), col('price', 'numeric')],
    },
    {
      tableName: 'enrollments',
      columns: [
        col('id', 'uuid', true),
        col('profile_id', 'uuid'),
        col('course_id', 'uuid'),
        col('enrolled_at', 'timestamptz'),
      ],
      foreignKeys: [
        { column: 'profile_id', referencedTable: 'profiles', referencedColumn: 'id' },
        { column: 'course_id', referencedTable: 'courses', referencedColumn: 'id' },
      ],
    },
    {
      tableName: 'leads',
      columns: [col('id', 'uuid', true), col('email', 'text'), col('source', 'text')],
    },
  ],
}

const shop: DatabaseSchema = {
  tables: [
    {
      tableName: 'products',
      columns: [
        col('id', 'int', true),
        col('name', 'varchar'),
        col('price', 'decimal'),
        col('stock', 'int'),
      ],
    },
  ],
}

const sales: DatabaseSchema = {
  tables: [
    { tableName: 'Customers', columns: [col('Id', 'int', true), col('Name', 'nvarchar')] },
    {
      tableName: 'Orders',
      columns: [
        col('Id', 'int', true),
        col('CustomerId', 'int'),
        col('Amount', 'decimal'),
        col('Status', 'nvarchar'),
      ],
      foreignKeys: [{ column: 'CustomerId', referencedTable: 'Customers', referencedColumn: 'Id' }],
    },
  ],
}

function asDesktopTables(schema: DatabaseSchema, quote: (name: string) => string) {
  return schema.tables.map((table) => ({
    name: quote(table.tableName),
    columns: table.columns.map((c) => ({ name: c.name, type: c.type, key: c.isPrimaryKey })),
    references: (table.foreignKeys ?? []).map((fk) => ({
      column: fk.column,
      table: quote(fk.referencedTable),
      tableColumn: fk.referencedColumn,
    })),
  }))
}

describe.skipIf(!enabled)('website answers', { timeout: 180_000 }, () => {
  it('counts students instead of asking what a student is', async () => {
    const { generateSQLFromSchema } = await import('@/actions/ai')
    for (let run = 1; run <= RUNS; run++) {
      const result = await generateSQLFromSchema(
        'How many students are there?',
        academy,
        [],
        'postgresql'
      )
      console.log(`website students ${run}:`, result.sql ?? result.error)
      expect(result.success, result.error).toBe(true)
      expect(result.sql).toMatch(/profiles|enrollments/i)
    }
  })

  it('shows rows from a real table on MySQL', async () => {
    const { generateSQLFromSchema } = await import('@/actions/ai')
    const result = await generateSQLFromSchema('Show 5 rows from any table', shop, [], 'mysql')
    console.log('website rows:', result.sql ?? result.error)
    expect(result.sql).toMatch(/from\s+`?products`?/i)
    expect(result.sql).not.toMatch(/'public'/)
  })

  it('lists tables without assuming a PostgreSQL schema', async () => {
    const { generateSQLFromSchema } = await import('@/actions/ai')
    const result = await generateSQLFromSchema('show tables', shop, [], 'mysql')
    console.log('website tables:', result.sql ?? result.error)
    expect(result.sql).toMatch(/products/)
    expect(result.sql).not.toMatch(/'public'/)
  })

  it('writes SQL Server syntax for SQL Server', async () => {
    const { generateSQLFromSchema } = await import('@/actions/ai')
    const result = await generateSQLFromSchema('Top 5 customers by revenue', sales, [], 'sqlserver')
    console.log('website sqlserver:', result.sql ?? result.error)
    expect(result.sql).toMatch(/\bTOP\s*\(?\s*5/i)
    expect(result.sql).not.toMatch(/\bLIMIT\b/i)
  })
})

describe.skipIf(!enabled)('desktop answers', { timeout: 180_000 }, () => {
  it('counts students instead of asking what a student is', async () => {
    const { complete } = await import('@/lib/desktop/ai')
    const { buildGenerateMessages, formatDesktopSchema, parseQueryReply } =
      await import('@/lib/desktop/prompts')
    const schemaText = formatDesktopSchema(
      asDesktopTables(academy, (name) => `public.${name}`),
      'postgresql'
    )
    for (let run = 1; run <= RUNS; run++) {
      const reply = await complete(
        buildGenerateMessages({
          dialect: 'postgresql',
          question: 'How many students are there?',
          schemaText,
        }),
        { maxTokens: 2048, temperature: 0.1 }
      )
      const outcome = parseQueryReply(reply, 'postgresql')
      console.log(`desktop students ${run}:`, outcome)
      expect(outcome.kind).toBe('query')
    }
  })
})
