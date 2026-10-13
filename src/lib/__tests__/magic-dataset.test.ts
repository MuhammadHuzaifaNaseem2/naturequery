import { describe, expect, it } from 'vitest'
import { assertOwnTablesOnly, parseMagicQuery, userSchemaName } from '../magic-dataset'

const schema = userSchemaName('user-1')
const ownTables = new Set(['sales', 'customers'])

function check(sql: string, tables: ReadonlySet<string> = ownTables) {
  assertOwnTablesOnly(parseMagicQuery(sql), schema, tables)
}

describe('queries on uploaded files', () => {
  it("allows everyday reads of the user's own tables", () => {
    for (const sql of [
      'SELECT region, SUM(amount) FROM sales GROUP BY region',
      'SELECT c.name, COUNT(*) FROM customers c JOIN sales s ON s.customer_id = c.id GROUP BY c.name',
      `SELECT * FROM "${schema}".sales`,
      "WITH monthly AS (SELECT date_trunc('month', d) AS m, amount FROM sales) SELECT m, SUM(amount) FROM monthly GROUP BY m",
      'WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM t WHERE n < 3) SELECT * FROM t',
      'SELECT region, SUM(amount) OVER (PARTITION BY region) FROM sales',
      'SELECT region, COUNT(*) FILTER (WHERE amount > 10) FROM sales GROUP BY region',
      "SELECT * FROM sales WHERE d > NOW() - INTERVAL '30 days' AND region ILIKE '%north%'",
      'SELECT pg_typeof(amount) FROM sales LIMIT 1',
      'SELECT CAST(amount AS numeric) FROM sales',
    ]) {
      expect(() => check(sql), sql).not.toThrow()
    }
  })

  it('allows an uploaded table whose name starts with pg_', () => {
    expect(() => check('SELECT * FROM pg_report', new Set(['pg_report']))).not.toThrow()
  })

  it("refuses tables that are not the user's own", () => {
    for (const sql of [
      'SELECT * FROM orders',
      'SELECT * FROM public.sales',
      'SELECT * FROM pg_tables',
      'SELECT * FROM information_schema.tables',
      'SELECT * FROM sales WHERE customer_id IN (SELECT id FROM accounts)',
      'WITH pg_roles AS (SELECT 1) SELECT * FROM pg_roles',
    ]) {
      expect(() => check(sql), sql).toThrow(/not one of your uploaded tables/)
    }
  })

  it('refuses functions and conversions that reveal other data', () => {
    for (const sql of [
      'SELECT pg_sleep(1)',
      "SELECT current_setting('server_version')",
      "SELECT has_table_privilege('sales', 'select')",
      'SELECT public.report_totals()',
      "SELECT * FROM ts_stat('SELECT 1')",
    ]) {
      expect(() => check(sql), sql).toThrow(/not available for uploaded files/)
    }
    expect(() => check("SELECT 'sales'::regclass")).toThrow(/Converting to regclass/)
  })

  it('refuses writes, several statements and anything it cannot read', () => {
    expect(() => parseMagicQuery('DELETE FROM sales')).toThrow(/only runs read-only queries/)
    expect(() => parseMagicQuery('SELECT 1; SELECT 2')).toThrow(/Multiple SQL statements/)
    expect(() => parseMagicQuery("SELECT query_to_xml('SELECT 1', true, true, '')")).toThrow(
      /is blocked/
    )
    expect(() => parseMagicQuery('SELECT FROM WHERE')).toThrow(/parse|could not be checked/i)
  })
})
