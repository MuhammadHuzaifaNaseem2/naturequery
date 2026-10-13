// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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

/**
 * The Academy database on Supabase keeps the role in an enum (user_role). The AI once
 * wrote lower(role), which PostgreSQL refuses for enums. These answers must run on a
 * real database with that schema, created beside a DATABASE_URL on localhost.
 */
const adminUrl = process.env.DATABASE_URL ?? ''
const canRun = enabled && /127\.0\.0\.1|localhost/.test(adminUrl)

const academyEnum: DatabaseSchema = {
  tables: academy.tables.map((table) => ({
    ...table,
    columns: table.columns.map((c) =>
      c.name === 'role' && table.tableName === 'profiles'
        ? { ...c, type: 'user_role', values: ['student', 'teacher', 'admin'] }
        : c
    ),
  })),
}

describe.skipIf(!canRun)('answers that must run on an enum column', { timeout: 240_000 }, () => {
  const dbName = `nq_eval_enum_${crypto.randomUUID().slice(0, 8)}`
  const url = new URL(adminUrl || 'postgresql://localhost/unused')
  url.pathname = `/${dbName}`

  async function runSql(connectionString: string, sql: string) {
    const { Client } = await import('pg')
    const client = new Client({ connectionString })
    await client.connect()
    try {
      return await client.query(sql)
    } finally {
      await client.end()
    }
  }
  const runReadOnly = (sql: string) =>
    runSql(url.toString(), `BEGIN READ ONLY; ${sql.replace(/;\s*$/, '')}; ROLLBACK;`)

  beforeAll(async () => {
    await runSql(adminUrl, `CREATE DATABASE ${dbName}`)
    await runSql(
      url.toString(),
      `CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
       CREATE TABLE profiles (id uuid PRIMARY KEY, full_name text, email text,
         role user_role NOT NULL, created_at timestamptz DEFAULT now());
       CREATE TABLE courses (id uuid PRIMARY KEY, title text, price numeric);
       CREATE TABLE enrollments (id uuid PRIMARY KEY, profile_id uuid REFERENCES profiles,
         course_id uuid REFERENCES courses, enrolled_at timestamptz DEFAULT now());
       CREATE TABLE leads (id uuid PRIMARY KEY, email text, source text);
       INSERT INTO profiles (id, full_name, role) VALUES
         (gen_random_uuid(), 'A', 'student'), (gen_random_uuid(), 'B', 'student'),
         (gen_random_uuid(), 'C', 'teacher');`
    )
  })

  afterAll(async () => {
    await runSql(adminUrl, `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  })

  it('website: counts students with a query that runs', async () => {
    const { generateSQLFromSchema } = await import('@/actions/ai')
    for (let run = 1; run <= RUNS; run++) {
      const result = await generateSQLFromSchema(
        'How many students are there?',
        academyEnum,
        [],
        'supabase'
      )
      console.log(`website enum ${run}:`, result.sql ?? result.error)
      expect(result.success, result.error).toBe(true)
      await expect(runReadOnly(result.sql!), result.sql).resolves.toBeDefined()
    }
  })

  it('desktop: counts students with a query that runs', async () => {
    const { complete } = await import('@/lib/desktop/ai')
    const { buildGenerateMessages, formatDesktopSchema, parseQueryReply } =
      await import('@/lib/desktop/prompts')
    const tables = asDesktopTables(academyEnum, (name) => `public.${name}`).map((table, i) => ({
      ...table,
      columns: table.columns.map((c, j) => ({
        ...c,
        values: academyEnum.tables[i].columns[j].values,
      })),
    }))
    const schemaText = formatDesktopSchema(tables, 'postgresql')
    expect(schemaText).toContain("role: user_role (one of 'student', 'teacher', 'admin')")
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
      console.log(`desktop enum ${run}:`, outcome)
      expect(outcome.kind).toBe('query')
      if (outcome.kind === 'query') {
        await expect(runReadOnly(outcome.text), outcome.text).resolves.toBeDefined()
      }
    }
  })

  it('desktop without values (0.9.1 and older): still casts before text functions', async () => {
    const { complete } = await import('@/lib/desktop/ai')
    const { buildGenerateMessages, formatDesktopSchema, parseQueryReply } =
      await import('@/lib/desktop/prompts')
    const schemaText = formatDesktopSchema(
      asDesktopTables(academyEnum, (name) => `public.${name}`),
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
      console.log(`desktop enum, no values ${run}:`, outcome)
      expect(outcome.kind).toBe('query')
      if (outcome.kind === 'query') {
        await expect(runReadOnly(outcome.text), outcome.text).resolves.toBeDefined()
      }
    }
  })
})
