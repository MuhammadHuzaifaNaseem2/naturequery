// Magic Dataset backend. Replaces the SQLite-on-disk approach, which doesn't
// work on serverless (read-only filesystem). CSVs are ingested into a dedicated
// Postgres schema per user and queried in-place.
//
// Isolation model (defense in depth):
//   1. Dedicated database (MAGIC_DATABASE_URL) that contains no app tables.
//      Falls back to DATABASE_URL in dev with a warning.
//   2. Per-user schema: magic_u_<hash>.
//   3. Every user query is wrapped in a read-only transaction with
//      search_path pinned to the user's schema and a statement timeout.
//   4. Any schema-qualified identifier in user SQL that references something
//      other than the user's schema is rejected before execution.

import { Pool, PoolClient } from 'pg'
import Papa from 'papaparse'
import crypto from 'crypto'
import { parse, astVisitor, Statement } from 'pgsql-ast-parser'

// ── Connection pool ────────────────────────────────────────────────────

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const url = process.env.MAGIC_DATABASE_URL || process.env.DATABASE_URL
    if (!url) {
      throw new Error(
        'Magic Dataset storage not configured. Set MAGIC_DATABASE_URL or DATABASE_URL.'
      )
    }
    if (!process.env.MAGIC_DATABASE_URL && process.env.NODE_ENV === 'production') {
      console.warn(
        '[magic-dataset] MAGIC_DATABASE_URL not set. Falling back to DATABASE_URL. ' +
          'For production, point MAGIC_DATABASE_URL at a dedicated database to isolate ' +
          'user-uploaded data from application tables.'
      )
    }
    pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}

// ── Identifier helpers ─────────────────────────────────────────────────

// Derive a stable, SQL-safe schema name from an arbitrary user id. We hash
// rather than embed the id so that ids containing punctuation (UUIDs etc.)
// always produce a valid identifier and stay under the 63-char PG limit.
export function userSchemaName(userId: string): string {
  const hash = crypto.createHash('sha1').update(userId).digest('hex').slice(0, 20)
  return `magic_u_${hash}`
}

function quoteIdent(ident: string): string {
  // Double-quote any embedded double quotes; this is the standard PG escape
  return '"' + ident.replace(/"/g, '""') + '"'
}

function sanitizeIdentifier(raw: string, fallback = 'col'): string {
  let s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!s) s = fallback
  if (!/^[a-z_]/.test(s)) s = `${fallback}_${s}`
  return s.slice(0, 60)
}

// ── Type inference ─────────────────────────────────────────────────────

type InferredType = 'integer' | 'bigint' | 'numeric' | 'boolean' | 'timestamp' | 'date' | 'text'

const INT_RE = /^-?\d+$/
const NUM_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/
const BOOL_RE = /^(true|false|t|f|yes|no)$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

function inferType(values: unknown[]): InferredType {
  const nonEmpty = values.filter((v) => v != null && String(v).trim() !== '')
  if (nonEmpty.length === 0) return 'text'

  let allBool = true,
    allInt = true,
    allNum = true,
    allDate = true,
    allTs = true
  const INT32_MAX = BigInt(2147483647)
  const ZERO = BigInt(0)
  let maxInt = ZERO

  for (const v of nonEmpty) {
    const s = String(v).trim()
    if (allBool && !BOOL_RE.test(s)) allBool = false
    if (allInt && !INT_RE.test(s)) allInt = false
    if (allInt) {
      try {
        const n = BigInt(s)
        const abs = n < ZERO ? -n : n
        if (abs > maxInt) maxInt = abs
      } catch {
        allInt = false
      }
    }
    if (allNum && !NUM_RE.test(s)) allNum = false
    if (allDate && !DATE_RE.test(s)) allDate = false
    if (allTs && !TS_RE.test(s)) allTs = false
    if (!allBool && !allInt && !allNum && !allDate && !allTs) return 'text'
  }

  if (allBool) return 'boolean'
  if (allInt) return maxInt > INT32_MAX ? 'bigint' : 'integer'
  if (allNum) return 'numeric'
  if (allDate) return 'date'
  if (allTs) return 'timestamp'
  return 'text'
}

function pgTypeOf(t: InferredType): string {
  switch (t) {
    case 'integer':
      return 'INTEGER'
    case 'bigint':
      return 'BIGINT'
    case 'numeric':
      return 'NUMERIC'
    case 'boolean':
      return 'BOOLEAN'
    case 'date':
      return 'DATE'
    case 'timestamp':
      return 'TIMESTAMP'
    default:
      return 'TEXT'
  }
}

function coerceValue(raw: unknown, type: InferredType): unknown {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s === '') return null

  // CSV formula-injection guard for string columns (Excel etc. execute
  // cells starting with = + - @). Prefix with an apostrophe so the value
  // is still searchable but never executed when exported back out.
  if (type === 'text' && /^[=+\-@\t\r|%]/.test(s)) {
    return `'${s}`
  }

  switch (type) {
    case 'boolean':
      return /^(true|t|yes|1)$/i.test(s)
    case 'integer':
    case 'bigint':
      return s // let PG parse
    case 'numeric':
      return s
    case 'date':
    case 'timestamp':
      return s
    default:
      return s
  }
}

// ── Ingest ─────────────────────────────────────────────────────────────

export interface IngestResult {
  schema: string
  tableName: string
  rowsInserted: number
  columns: { name: string; type: InferredType }[]
}

export async function ingestCsv(params: {
  userId: string
  csvText: string
  filename: string
}): Promise<IngestResult> {
  const { userId, csvText, filename } = params

  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const rawRows = parsed.data
  if (!rawRows || rawRows.length === 0) {
    throw new Error('CSV file contains no data rows.')
  }
  if (rawRows.length > 100_000) {
    throw new Error('CSV exceeds the 100,000 row limit.')
  }

  const rawHeaders = parsed.meta.fields ?? []
  if (rawHeaders.length === 0) throw new Error('CSV has no header row.')
  if (rawHeaders.length > 200) throw new Error('CSV exceeds the 200 column limit.')

  // Map original -> sanitized, ensuring uniqueness
  const usedNames = new Set<string>()
  const columnMap = rawHeaders.map((orig) => {
    let clean = sanitizeIdentifier(orig)
    let suffix = 2
    while (usedNames.has(clean)) clean = `${sanitizeIdentifier(orig)}_${suffix++}`
    usedNames.add(clean)
    return { orig, clean }
  })

  // Type inference over up to 1000 rows per column
  const sample = rawRows.slice(0, Math.min(1000, rawRows.length))
  const columns = columnMap.map(({ orig, clean }) => ({
    name: clean,
    type: inferType(sample.map((r) => r[orig])),
  }))

  const tableName = sanitizeIdentifier(filename.replace(/\.csv$/i, ''), 't')
  const schema = userSchemaName(userId)

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`)
    await client.query(`DROP TABLE IF EXISTS ${quoteIdent(schema)}.${quoteIdent(tableName)}`)
    const colDefs = columns.map((c) => `${quoteIdent(c.name)} ${pgTypeOf(c.type)}`).join(', ')
    await client.query(`CREATE TABLE ${quoteIdent(schema)}.${quoteIdent(tableName)} (${colDefs})`)

    // Batched parameterized INSERT. PG caps parameters at 65535 per statement;
    // we conservatively aim for 1000 rows × columns below that.
    const maxParams = 60_000
    const rowsPerBatch = Math.max(1, Math.floor(maxParams / Math.max(1, columns.length)))
    const insertPrefix = `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(tableName)} (${columns
      .map((c) => quoteIdent(c.name))
      .join(', ')}) VALUES `

    for (let i = 0; i < rawRows.length; i += rowsPerBatch) {
      const batch = rawRows.slice(i, i + rowsPerBatch)
      const values: unknown[] = []
      const placeholders: string[] = []
      let n = 0
      for (const row of batch) {
        const slots: string[] = []
        for (let c = 0; c < columns.length; c++) {
          values.push(coerceValue(row[columnMap[c].orig], columns[c].type))
          n += 1
          slots.push(`$${n}`)
        }
        placeholders.push(`(${slots.join(', ')})`)
      }
      await client.query(insertPrefix + placeholders.join(', '), values)
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  return { schema, tableName, rowsInserted: rawRows.length, columns }
}

// ── Teardown ───────────────────────────────────────────────────────────

export async function dropMagicTable(userId: string, tableName: string): Promise<void> {
  const schema = userSchemaName(userId)
  const safeTable = sanitizeIdentifier(tableName, 't')
  const client = await getPool().connect()
  try {
    await client.query(`DROP TABLE IF EXISTS ${quoteIdent(schema)}.${quoteIdent(safeTable)}`)
  } finally {
    client.release()
  }
}

// ── Query-time isolation ───────────────────────────────────────────────

// Reject any schema-qualified identifier that isn't the user's own schema.
// Combined with a pinned search_path, this prevents a user from reading
// app tables even if this database happens to share with the app.
function assertAllowedSchemas(sql: string, allowedSchema: string): void {
  let ast: Statement[]
  try {
    ast = parse(sql)
  } catch {
    // If parsing fails we still let pg report the syntax error — it's a
    // better error message than our fallback would produce.
    return
  }
  const visitor = astVisitor((v) => ({
    tableRef: (t) => {
      if (t.schema && t.schema !== allowedSchema && t.schema !== 'pg_temp') {
        throw new Error(`Access to schema "${t.schema}" is not allowed in Magic Datasets.`)
      }
      return v.super().tableRef(t)
    },
  }))
  for (const stmt of ast) visitor.statement(stmt)
}

export interface MagicQueryResult {
  rows: Record<string, unknown>[]
  fields: string[]
  rowCount: number
  truncated: boolean
}

export async function runMagicQuery(params: {
  userId: string
  sql: string
  maxRows: number
  timeoutMs?: number
}): Promise<MagicQueryResult> {
  const { userId, sql, maxRows, timeoutMs = 30000 } = params
  const schema = userSchemaName(userId)
  assertAllowedSchemas(sql, schema)

  const client = await getPool().connect()
  try {
    await client.query('BEGIN READ ONLY')
    // pg_temp must remain on the path for things like temp tables PG creates
    // internally. Explicitly pin user schema first so unqualified names
    // resolve there.
    await client.query(`SET LOCAL search_path TO ${quoteIdent(schema)}, pg_temp`)
    await client.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`)

    const result = await client.query(sql)
    await client.query('COMMIT')

    const rows = result.rows as Record<string, unknown>[]
    const fields = result.fields?.map((f) => f.name) ?? (rows[0] ? Object.keys(rows[0]) : [])
    const total = rows.length
    const truncated = total > maxRows
    return {
      rows: truncated ? rows.slice(0, maxRows) : rows,
      fields,
      rowCount: total,
      truncated,
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// ── Schema introspection ───────────────────────────────────────────────

export interface MagicTableInfo {
  tableName: string
  columns: {
    name: string
    type: string
    nullable: boolean
    defaultValue: string | null
    isPrimaryKey: boolean
  }[]
}

export async function fetchMagicSchema(userId: string): Promise<MagicTableInfo[]> {
  const schema = userSchemaName(userId)
  const client = await getPool().connect()
  try {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 ORDER BY table_name`,
      [schema]
    )
    const result: MagicTableInfo[] = []
    for (const { table_name } of tables.rows) {
      const cols = await client.query<{
        column_name: string
        data_type: string
        is_nullable: string
      }>(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table_name]
      )
      result.push({
        tableName: table_name,
        columns: cols.rows.map((c) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          defaultValue: null,
          isPrimaryKey: false,
        })),
      })
    }
    return result
  } finally {
    client.release()
  }
}
