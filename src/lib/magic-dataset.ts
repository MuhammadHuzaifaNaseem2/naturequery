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
//   4. Every user query is parsed before it runs, and refused if it cannot be.
//      It may read only the user's own tables and names it defines with WITH:
//      no other schemas, system tables, or functions that reveal other data.

import { Pool } from 'pg'
import Papa from 'papaparse'
import crypto from 'crypto'
import { parse, Statement } from 'pgsql-ast-parser'
import { validateSQLSafety } from '@/lib/sql-validator'

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

export function getPool(): Pool {
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

export function quoteIdent(ident: string): string {
  return '"' + ident.replace(/"/g, '""') + '"'
}

export function sanitizeIdentifier(raw: string, fallback = 'col'): string {
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

type InferredType =
  | 'integer'
  | 'bigint'
  | 'numeric'
  | 'boolean'
  | 'timestamp'
  | 'date'
  | 'date_dmy'
  | 'date_mdy'
  | 'timestamp_dmy'
  | 'timestamp_mdy'
  | 'text'

const INT_RE = /^-?\d+$/
const NUM_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/
const BOOL_RE = /^(true|false|t|f|yes|no)$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/
// Slashed / dashed regional date formats. We match the SHAPE here; the actual
// DD-vs-MM disambiguation happens in inferDateLayout() over the whole column.
const REGIONAL_DATE_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/
const REGIONAL_TS_RE =
  /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})[T ]\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?$/i

/**
 * Decide whether a column of regional dates uses DD/MM/YYYY or MM/DD/YYYY by
 * looking at every value. If we see a "first part" > 12 it must be a day.
 * If we see a "second part" > 12 it must be a day in MM/DD layout. If both,
 * the data is inconsistent and we fall back to text.
 */
type RegionalLayout = 'dmy' | 'mdy' | 'ambiguous' | 'inconsistent'
function inferDateLayout(values: string[]): RegionalLayout {
  let firstBig = false
  let secondBig = false
  for (const v of values) {
    const m = v.match(REGIONAL_DATE_RE) || v.match(REGIONAL_TS_RE)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12) firstBig = true
    if (b > 12) secondBig = true
    if (firstBig && secondBig) return 'inconsistent'
  }
  if (firstBig) return 'dmy'
  if (secondBig) return 'mdy'
  return 'ambiguous' // default to DMY for ambiguous — more common globally
}

/** Convert a regional date string to ISO YYYY-MM-DD given the layout. */
function regionalToIso(value: string, layout: 'dmy' | 'mdy'): string | null {
  const m = value.match(REGIONAL_DATE_RE) || value.match(REGIONAL_TS_RE)
  if (!m) return null
  const part1 = Number(m[1])
  const part2 = Number(m[2])
  const day = layout === 'dmy' ? part1 : part2
  const month = layout === 'dmy' ? part2 : part1
  let year = Number(m[3])
  if (year < 100) year += year >= 70 ? 1900 : 2000 // 2-digit year heuristic
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  // Preserve the time portion if it was a timestamp
  const tsMatch = value.match(REGIONAL_TS_RE)
  if (tsMatch) {
    const timePart = value.slice(value.search(/[T ]\d/) + 1)
    return `${iso} ${timePart}`
  }
  return iso
}

function inferType(values: unknown[]): InferredType {
  const nonEmpty = values.filter((v) => v != null && String(v).trim() !== '')
  if (nonEmpty.length === 0) return 'text'

  let allBool = true,
    allInt = true,
    allNum = true,
    allDate = true,
    allTs = true,
    allRegionalDate = true,
    allRegionalTs = true
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
    if (allRegionalDate && !REGIONAL_DATE_RE.test(s)) allRegionalDate = false
    if (allRegionalTs && !REGIONAL_TS_RE.test(s)) allRegionalTs = false
    if (!allBool && !allInt && !allNum && !allDate && !allTs && !allRegionalDate && !allRegionalTs)
      return 'text'
  }

  if (allBool) return 'boolean'
  if (allInt) return maxInt > INT32_MAX ? 'bigint' : 'integer'
  if (allNum) return 'numeric'
  if (allDate) return 'date'
  if (allTs) return 'timestamp'
  if (allRegionalTs) {
    const layout = inferDateLayout(nonEmpty.map((v) => String(v).trim()))
    if (layout === 'inconsistent') return 'text'
    return layout === 'mdy' ? 'timestamp_mdy' : 'timestamp_dmy'
  }
  if (allRegionalDate) {
    const layout = inferDateLayout(nonEmpty.map((v) => String(v).trim()))
    if (layout === 'inconsistent') return 'text'
    return layout === 'mdy' ? 'date_mdy' : 'date_dmy'
  }
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
    case 'date_dmy':
    case 'date_mdy':
      return 'DATE'
    case 'timestamp':
    case 'timestamp_dmy':
    case 'timestamp_mdy':
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
    case 'date_dmy':
    case 'timestamp_dmy':
      return regionalToIso(s, 'dmy') ?? null
    case 'date_mdy':
    case 'timestamp_mdy':
      return regionalToIso(s, 'mdy') ?? null
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

// Functions that reveal server details or read beyond the query's own tables
// (another table by name, or SQL passed in as text). The shared read-only
// guard already refuses the ones that write or reach other servers.
const BLOCKED_FUNCTION_PREFIXES = ['pg_', 'has_', 'to_reg', 'crosstab']
const BLOCKED_FUNCTIONS = new Set([
  'connectby',
  'current_setting',
  'inet_client_addr',
  'inet_client_port',
  'inet_server_addr',
  'inet_server_port',
  'ts_rewrite',
  'ts_stat',
  'xpath_table',
])
const ALLOWED_FUNCTIONS = new Set(['pg_typeof'])

function isBlockedFunction(name: string): boolean {
  const lower = name.toLowerCase()
  if (ALLOWED_FUNCTIONS.has(lower)) return false
  return (
    BLOCKED_FUNCTIONS.has(lower) ||
    lower.includes('_to_xml') ||
    BLOCKED_FUNCTION_PREFIXES.some((prefix) => lower.startsWith(prefix))
  )
}

type AstNode = Record<string, unknown>

function walkAst(node: unknown, visit: (node: AstNode) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkAst(item, visit)
  } else if (node && typeof node === 'object') {
    visit(node as AstNode)
    for (const value of Object.values(node)) walkAst(value, visit)
  }
}

function nameOf(node: unknown): { name?: string; schema?: string } {
  if (!node || typeof node !== 'object') return {}
  const { name, schema } = node as { name?: unknown; schema?: unknown }
  return {
    name: typeof name === 'string' ? name : undefined,
    schema: typeof schema === 'string' ? schema : undefined,
  }
}

/**
 * Check a query on uploaded data and return its parsed form. Fails closed: a
 * query the parser cannot read is refused, because the table check needs it.
 */
export function parseMagicQuery(sql: string): Statement[] {
  const check = validateSQLSafety(sql, 'magic')
  if (!check.valid) throw new Error(check.error ?? 'This query is not allowed.')
  try {
    return parse(sql)
  } catch {
    throw new Error('This query could not be checked, so it was not run. Check the SQL syntax.')
  }
}

/**
 * Allow only reads of the user's own uploaded tables and of names the query
 * defines with WITH. Refuses other schemas, system tables, and functions or
 * casts that reveal anything outside those tables.
 */
export function assertOwnTablesOnly(
  ast: Statement[],
  ownSchema: string,
  ownTables: ReadonlySet<string>
): void {
  const withNames = new Set<string>()
  walkAst(ast, (node) => {
    if (node.type === 'with' && Array.isArray(node.bind)) {
      for (const bind of node.bind) {
        const { name } = nameOf((bind as AstNode | null)?.alias)
        if (name) withNames.add(name)
      }
    } else if (node.type === 'with recursive') {
      const { name } = nameOf(node.alias)
      if (name) withNames.add(name)
    }
  })

  walkAst(ast, (node) => {
    if (node.type === 'table') {
      const { name, schema } = nameOf(node.name)
      const own = !!name && ownTables.has(name) && (!schema || schema === ownSchema)
      // System tables all start with pg_, so a WITH name never stands in for one.
      const defined = !!name && !schema && withNames.has(name) && !name.startsWith('pg_')
      if (!own && !defined) {
        const label = schema ? `${schema}.${name ?? ''}` : (name ?? 'this table')
        throw new Error(`"${label}" is not one of your uploaded tables, so this query was not run.`)
      }
    } else if (node.type === 'call') {
      const { name, schema } = nameOf(node.function)
      if (!name || schema || isBlockedFunction(name)) {
        const label = `${schema ? `${schema}.` : ''}${name ?? 'This function'}`
        throw new Error(`${label}() is not available for uploaded files.`)
      }
    } else if (node.type === 'cast') {
      const { name, schema } = nameOf(node.to)
      if (schema || name?.toLowerCase().startsWith('reg')) {
        throw new Error(`Converting to ${name ?? 'this type'} is not available for uploaded files.`)
      }
    }
  })
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
  const ast = parseMagicQuery(sql)

  const client = await getPool().connect()
  try {
    await client.query('BEGIN READ ONLY')
    // The user's schema comes first, ahead of the built-in catalog, so their own
    // table names always resolve to their own tables.
    await client.query(`SET LOCAL search_path TO ${quoteIdent(schema)}, pg_catalog, pg_temp`)
    await client.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`)

    const own = await client.query<{ tablename: string }>(
      'SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1',
      [schema]
    )
    assertOwnTablesOnly(ast, schema, new Set(own.rows.map((row) => row.tablename)))

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

// ── Batch-upload helpers (used by /api/upload-csv-json) ────────────────

export async function createMagicTable(
  userId: string,
  tableName: string,
  headers: string[],
  sampleRows?: Record<string, unknown>[]
): Promise<void> {
  const schema = userSchemaName(userId)
  const safeTable = sanitizeIdentifier(tableName, 't')

  // Infer column types from sample rows so date/numeric columns get proper PG types.
  // Falls back to TEXT when no sample is provided.
  const cols = headers
    .map((h) => {
      const type =
        sampleRows && sampleRows.length > 0 ? inferType(sampleRows.map((r) => r[h])) : 'text'
      return `${quoteIdent(sanitizeIdentifier(h, 'col'))} ${pgTypeOf(type)}`
    })
    .join(', ')

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`)
    await client.query(`DROP TABLE IF EXISTS ${quoteIdent(schema)}.${quoteIdent(safeTable)}`)
    await client.query(`CREATE TABLE ${quoteIdent(schema)}.${quoteIdent(safeTable)} (${cols})`)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function insertMagicRows(
  userId: string,
  tableName: string,
  headers: string[],
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return
  const schema = userSchemaName(userId)
  const safeTable = sanitizeIdentifier(tableName, 't')
  const safeCols = headers.map((h) => quoteIdent(sanitizeIdentifier(h, 'col')))
  const prefix = `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(safeTable)} (${safeCols.join(', ')}) VALUES `

  const values: unknown[] = []
  const placeholders: string[] = []
  let n = 0
  for (const row of rows) {
    const slots: string[] = []
    for (const h of headers) {
      const v = row[h]
      values.push(v == null || String(v).trim() === '' ? null : String(v))
      slots.push(`$${++n}`)
    }
    placeholders.push(`(${slots.join(', ')})`)
  }

  const client = await getPool().connect()
  try {
    await client.query(prefix + placeholders.join(', '), values)
  } finally {
    client.release()
  }
}
