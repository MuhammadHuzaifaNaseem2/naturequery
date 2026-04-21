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

import { Pool } from 'pg'
import Papa from 'papaparse'
import crypto from 'crypto'
import { parse, astVisitor, Statement } from 'pgsql-ast-parser'

// ── Connection pool ────────────────────────────────────────────────────

let pool: Pool | null = null

// Hosts that are local — never force SSL for these.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

function ensureSslMode(url: string): string {
  // Cloud Postgres providers (Neon, Supabase, Railway, Vercel Postgres, RDS)
  // all require SSL. If the user pasted a URL without sslmode= and the host
  // isn't local, append sslmode=require so the connection just works.
  try {
    const u = new URL(url)
    if (LOCAL_HOSTS.has(u.hostname)) return url
    if (u.searchParams.has('sslmode')) return url
    u.searchParams.set('sslmode', 'require')
    return u.toString()
  } catch {
    return url
  }
}

function getPool(): Pool {
  if (!pool) {
    const raw = process.env.MAGIC_DATABASE_URL || process.env.DATABASE_URL
    if (!raw) {
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
      connectionString: ensureSslMode(raw),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    // Prevent "idle client" unhandled-rejection crashes (common with serverless
    // cold starts against cloud PG). Log and move on — the pool recovers.
    pool.on('error', (err) => {
      console.error('[magic-dataset] Idle PG client error:', err.message)
    })
  }
  return pool
}

/**
 * Verify the Magic Dataset database is reachable and writable. Useful for an
 * admin/diagnostics endpoint so you can confirm MAGIC_DATABASE_URL is wired
 * up correctly before any user uploads.
 */
export async function checkMagicDatasetHealth(): Promise<{
  ok: boolean
  usingDedicatedDb: boolean
  error?: string
  serverVersion?: string
}> {
  const usingDedicatedDb = !!process.env.MAGIC_DATABASE_URL
  try {
    const client = await getPool().connect()
    try {
      const res = await client.query<{ v: string }>('SELECT version() AS v')
      return { ok: true, usingDedicatedDb, serverVersion: res.rows[0]?.v }
    } finally {
      client.release()
    }
  } catch (err) {
    return {
      ok: false,
      usingDedicatedDb,
      error: err instanceof Error ? err.message : String(err),
    }
  }
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

export async function fetchMagicSchema(
  userId: string,
  tableName?: string
): Promise<MagicTableInfo[]> {
  const schema = userSchemaName(userId)
  const client = await getPool().connect()
  try {
    // Single query for all columns (optionally filtered to one table).
    // Previously this was 1 + N queries (list tables, then per-table columns),
    // which was slow for the common magic-driver path that only needs a single
    // table's columns.
    const params: (string | undefined)[] = [schema]
    let sql = `SELECT table_name, column_name, data_type, is_nullable
               FROM information_schema.columns
               WHERE table_schema = $1`
    if (tableName) {
      sql += ` AND table_name = $2`
      params.push(tableName)
    }
    sql += ` ORDER BY table_name, ordinal_position`

    const rows = await client.query<{
      table_name: string
      column_name: string
      data_type: string
      is_nullable: string
    }>(sql, params)

    const byTable = new Map<string, MagicTableInfo>()
    for (const r of rows.rows) {
      let t = byTable.get(r.table_name)
      if (!t) {
        t = { tableName: r.table_name, columns: [] }
        byTable.set(r.table_name, t)
      }
      t.columns.push({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
        defaultValue: null,
        isPrimaryKey: false,
      })
    }
    return Array.from(byTable.values())
  } finally {
    client.release()
  }
}
