/**
 * Read-only guard for query text, shared in behaviour with NatureQuery Desktop
 * (desktop/src/engine/safety/sql.ts and desktop/src/engine/drivers/mongodb.ts).
 * Keep the two in step: a rule added in one belongs in the other.
 *
 * This is defense in depth, not a sandbox: drivers also open read-only
 * transactions where the database supports them, and customers should connect
 * with read-only accounts.
 *
 * The guard masks comments and quoted text (so keywords inside them are
 * ignored), then checks the remaining text for a single statement that starts
 * with a read keyword and contains no writing keywords or risky functions.
 */
import type { DatabaseType } from '@/lib/db-drivers'

export type SqlDialect =
  | 'postgresql'
  | 'mysql'
  | 'sqlserver'
  | 'sqlite'
  | 'oracle'
  | 'clickhouse'
  | 'snowflake'
  | 'bigquery'
  | 'cql'
  | 'partiql'

export class SqlGuardError extends Error {
  readonly hint?: string
  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'SqlGuardError'
    this.hint = hint
  }
}

/** Which guard rules apply to a connection type; null for types that are not SQL. */
export function guardDialectFor(type: DatabaseType): SqlDialect | 'mongodb' | 'firestore' {
  switch (type) {
    case 'postgresql':
    case 'neon':
    case 'cockroachdb':
    case 'redshift':
    case 'magic':
      return 'postgresql'
    case 'mysql':
    case 'mariadb':
    case 'planetscale':
      return 'mysql'
    case 'sqlserver':
      return 'sqlserver'
    case 'sqlite':
    case 'turso':
    case 'duckdb':
      return 'sqlite'
    case 'oracle':
    case 'db2':
      return 'oracle'
    case 'clickhouse':
      return 'clickhouse'
    case 'snowflake':
      return 'snowflake'
    case 'bigquery':
      return 'bigquery'
    case 'cassandra':
      return 'cql'
    case 'dynamodb':
      return 'partiql'
    case 'mongodb':
      return 'mongodb'
    case 'firestore':
      return 'firestore'
  }
}

interface DialectRules {
  lineComments: string[]
  /** MySQL needs whitespace after "--" for it to start a comment. */
  dashNeedsSpace?: boolean
  nestedBlockComments: boolean
  /** MySQL and MariaDB run code inside /*! ... *\/ and /*M! ... *\/. */
  executableComments?: boolean
  stringQuotes: string[]
  identifierQuotes: [open: string, close: string][]
  /**
   * escape: a backslash escapes the next character.
   * literal: a backslash is an ordinary character.
   * reject: ambiguous (depends on server settings), so refuse it.
   */
  backslash: 'escape' | 'literal' | 'reject'
  /** PostgreSQL E'...' strings always allow backslash escapes. */
  escapeStringPrefix?: boolean
  dollarQuotes?: 'tagged' | 'plain'
  oracleQuoteOperator?: boolean
  tripleQuotes?: boolean
  readStarts: string[]
  extraForbidden?: RegExp
}

const COMMON_STARTS = ['SELECT', 'WITH']

const RULES: Record<SqlDialect, DialectRules> = {
  postgresql: {
    lineComments: ['--'],
    nestedBlockComments: true,
    stringQuotes: ["'"],
    identifierQuotes: [['"', '"']],
    backslash: 'reject',
    escapeStringPrefix: true,
    dollarQuotes: 'tagged',
    readStarts: [...COMMON_STARTS, 'VALUES', 'TABLE', 'SHOW', 'EXPLAIN'],
    extraForbidden:
      /\b(NEXTVAL|SETVAL|SET_CONFIG|PG_(?:TRY_)?ADVISORY_(?:XACT_)?LOCK(?:_SHARED)?|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_RELOAD_CONF|PG_ROTATE_LOGFILE|PG_SWITCH_WAL|PG_PROMOTE|PG_STAT_RESET\w*|PG_FILE_WRITE|PG_READ_FILE|PG_READ_BINARY_FILE|PG_LS_DIR|LO_IMPORT|LO_EXPORT|LO_UNLINK|LO_CREATE|LO_PUT|LO_FROM_BYTEA|DBLINK\w*|QUERY_TO_XML\w*|QUERY_TO_XMLSCHEMA|CURSOR_TO_XML\w*)\b/i,
  },
  mysql: {
    lineComments: ['--', '#'],
    dashNeedsSpace: true,
    nestedBlockComments: false,
    executableComments: true,
    stringQuotes: ["'", '"'],
    identifierQuotes: [['`', '`']],
    backslash: 'reject',
    readStarts: [...COMMON_STARTS, 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'VALUES', 'TABLE'],
    extraForbidden: /\b(GET_LOCK|RELEASE_LOCK|RELEASE_ALL_LOCKS|LOAD_FILE|HANDLER)\b/i,
  },
  sqlserver: {
    lineComments: ['--'],
    nestedBlockComments: true,
    stringQuotes: ["'"],
    identifierQuotes: [
      ['"', '"'],
      ['[', ']'],
    ],
    backslash: 'literal',
    readStarts: COMMON_STARTS,
    extraForbidden: /\b(OPENROWSET|OPENDATASOURCE|OPENQUERY|BULK|WAITFOR|DBCC)\b|\bXP_\w+/i,
  },
  sqlite: {
    lineComments: ['--'],
    nestedBlockComments: false,
    stringQuotes: ["'"],
    identifierQuotes: [
      ['"', '"'],
      ['`', '`'],
      ['[', ']'],
    ],
    backslash: 'literal',
    readStarts: [...COMMON_STARTS, 'VALUES', 'EXPLAIN', 'PRAGMA'],
    extraForbidden: /\b(ATTACH|DETACH|LOAD_EXTENSION)\b/i,
  },
  oracle: {
    lineComments: ['--'],
    nestedBlockComments: false,
    stringQuotes: ["'"],
    identifierQuotes: [['"', '"']],
    backslash: 'literal',
    oracleQuoteOperator: true,
    readStarts: COMMON_STARTS,
    extraForbidden:
      /\b(UTL_FILE|UTL_HTTP|UTL_TCP|UTL_SMTP|DBMS_SCHEDULER|DBMS_JOB|DBMS_PIPE|DBMS_LOCK|DBMS_SQL|DBMS_SYS_SQL|DBMS_AQ|DBMS_STATS|DBMS_ADVISOR)\b/i,
  },
  clickhouse: {
    lineComments: ['--', '#'],
    nestedBlockComments: false,
    stringQuotes: ["'"],
    identifierQuotes: [
      ['"', '"'],
      ['`', '`'],
    ],
    backslash: 'escape',
    readStarts: [...COMMON_STARTS, 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'EXISTS'],
    extraForbidden: /\b(OPTIMIZE|SYSTEM|DETACH|ATTACH|EXCHANGE)\b/i,
  },
  snowflake: {
    lineComments: ['--', '//'],
    nestedBlockComments: false,
    stringQuotes: ["'"],
    identifierQuotes: [['"', '"']],
    backslash: 'escape',
    dollarQuotes: 'plain',
    readStarts: [...COMMON_STARTS, 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN'],
    extraForbidden: /\bSYSTEM\$\w+|\b(PUT|UNDROP|REMOVE)\b/i,
  },
  bigquery: {
    lineComments: ['--', '#'],
    nestedBlockComments: false,
    stringQuotes: ["'", '"'],
    identifierQuotes: [['`', '`']],
    backslash: 'escape',
    tripleQuotes: true,
    readStarts: COMMON_STARTS,
    extraForbidden: /\b(EXPORT|DECLARE|ASSERT)\b/i,
  },
  cql: {
    lineComments: ['--', '//'],
    nestedBlockComments: false,
    stringQuotes: ["'"],
    identifierQuotes: [['"', '"']],
    backslash: 'literal',
    dollarQuotes: 'plain',
    readStarts: ['SELECT'],
    extraForbidden: /\b(BATCH|USE)\b/i,
  },
  partiql: {
    lineComments: ['--'],
    nestedBlockComments: false,
    stringQuotes: ["'"],
    identifierQuotes: [['"', '"']],
    backslash: 'literal',
    readStarts: ['SELECT'],
  },
}

/** Statements and clauses that write data, change the schema or take locks. */
const WRITE_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|CALL|RENAME|COPY|LOCK|UNLOCK|VACUUM|REINDEX|INTO|SET|SHUTDOWN|KILL|RESTORE|BACKUP|DENY|REFRESH)\b|\bFOR\s+(?:NO\s+KEY\s+)?(?:UPDATE|SHARE)\b|\bFOR\s+KEY\s+SHARE\b/i

/** Message used when more than one statement is sent (callers match on it). */
export const MULTIPLE_STATEMENTS_MESSAGE = 'Multiple SQL statements are not allowed'

function fail(message: string, hint?: string): never {
  throw new SqlGuardError(message, hint)
}

/**
 * PRAGMA can change a setting as well as read it, so only these reads run. The
 * first group takes a table or index name; the second takes nothing at all.
 */
const PRAGMA_READS_WITH_NAME = new Set([
  'foreign_key_list',
  'index_info',
  'index_list',
  'index_xinfo',
  'table_info',
  'table_list',
  'table_xinfo',
])
const PRAGMA_READS = new Set([
  'application_id',
  'collation_list',
  'compile_options',
  'data_version',
  'database_list',
  'encoding',
  'foreign_keys',
  'freelist_count',
  'function_list',
  'journal_mode',
  'module_list',
  'page_count',
  'page_size',
  'pragma_list',
  'schema_version',
  'user_version',
])

function assertReadPragma(body: string): void {
  const match = /^\s*\(*\s*PRAGMA\s+(?:\w+\s*\.\s*)?(\w+)\s*(\S?)/i.exec(body)
  const name = match?.[1]?.toLowerCase() ?? ''
  const next = match?.[2] ?? ''
  const allowed =
    !body.includes('=') &&
    (PRAGMA_READS_WITH_NAME.has(name) || (PRAGMA_READS.has(name) && next === ''))
  if (!allowed) {
    fail(
      `NatureQuery runs PRAGMA only to read details, so ${name ? `PRAGMA ${name}` : 'this PRAGMA'} is not allowed.`,
      'For example, PRAGMA table_info(orders) lists the columns of a table.'
    )
  }
}

/** Blanks out comments and quoted text, keeping offsets and line breaks. */
export function maskSql(sql: string, dialect: SqlDialect): string {
  const rules = RULES[dialect]
  let output = ''
  let i = 0
  const blank = (from: number, to: number) => {
    output += sql.slice(from, to).replace(/[^\r\n]/g, ' ')
  }

  while (i < sql.length) {
    const start = i
    const char = sql[i]

    // Line comments
    const line = rules.lineComments.find((marker) => sql.startsWith(marker, i))
    if (line) {
      const needsSpace = line === '--' && rules.dashNeedsSpace
      const next = sql[i + 2]
      if (!needsSpace || next === undefined || /[\s\x00-\x1f]/.test(next)) {
        while (i < sql.length && sql[i] !== '\n' && sql[i] !== '\r') i++
        blank(start, i)
        continue
      }
    }

    // Block comments
    if (sql.startsWith('/*', i)) {
      if (rules.executableComments && /^\/\*(?:!|M!)/i.test(sql.slice(i, i + 4))) {
        fail(
          'MySQL executable comments (/*! ... */) are not allowed.',
          'Remove the comment, or write the statement inside it as plain SQL.'
        )
      }
      let depth = 1
      i += 2
      while (i < sql.length && depth > 0) {
        if (sql.startsWith('/*', i)) {
          if (!rules.nestedBlockComments) {
            fail(
              'Nested comments are not supported for this database.',
              'Remove the inner /* comment.'
            )
          }
          depth++
          i += 2
        } else if (sql.startsWith('*/', i)) {
          depth--
          i += 2
        } else i++
      }
      if (depth > 0) fail('A /* comment is not closed.', 'Add */ to close the comment.')
      blank(start, i)
      continue
    }

    // Oracle q'[...]' quoted literals
    if (
      rules.oracleQuoteOperator &&
      /[qQ]/.test(char) &&
      sql[i + 1] === "'" &&
      !/[\w$#]/.test(sql[i - 1] ?? '')
    ) {
      const open = sql[i + 2]
      if (!open || /\s/.test(open)) fail('The quoted text is not valid.')
      const close =
        ({ '[': ']', '(': ')', '{': '}', '<': '>' } as Record<string, string>)[open] ?? open
      const end = sql.indexOf(`${close}'`, i + 3)
      if (end < 0) fail('Quoted text is not closed.', `Close it with ${close}'.`)
      i = end + 2
      blank(start, i)
      continue
    }

    // BigQuery triple-quoted strings
    if (rules.tripleQuotes && (sql.startsWith("'''", i) || sql.startsWith('"""', i))) {
      const quote = sql.slice(i, i + 3)
      const raw = /[rR]/.test(sql[i - 1] ?? '')
      i += 3
      let closed = false
      while (i < sql.length) {
        if (!raw && sql[i] === '\\') {
          i += 2
          continue
        }
        if (sql.startsWith(quote, i)) {
          i += 3
          closed = true
          break
        }
        i++
      }
      if (!closed) fail('Quoted text is not closed.', `Close it with ${quote}.`)
      blank(start, i)
      continue
    }

    // Strings and quoted identifiers
    const identifier = rules.identifierQuotes.find(([open]) => open === char)
    const isString = rules.stringQuotes.includes(char)
    if (identifier || isString) {
      const close = identifier ? identifier[1] : char
      const prefixed =
        rules.escapeStringPrefix &&
        isString &&
        /[eE]/.test(sql[i - 1] ?? '') &&
        !/[\w$]/.test(sql[i - 2] ?? '')
      const raw =
        rules.tripleQuotes &&
        isString &&
        /[rR]/.test(sql[i - 1] ?? '') &&
        !/[\w]/.test(sql[i - 2] ?? '')
      i++
      let closed = false
      while (i < sql.length) {
        if (sql[i] === close) {
          if (sql[i + 1] === close) {
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        if (isString && sql[i] === '\\' && !raw) {
          if (prefixed || rules.backslash === 'escape') {
            i += 2
            continue
          }
          if (rules.backslash === 'reject') {
            fail(
              'Backslashes inside quoted text are not supported for this database.',
              dialect === 'postgresql'
                ? "Double the quote ('') instead of using \\', or use an E'' string."
                : "Double the quote ('') instead of using \\'."
            )
          }
        }
        i++
      }
      if (!closed) fail('Quoted text is not closed.', `Add the closing ${close}.`)
      blank(start, i)
      continue
    }

    // Dollar-quoted strings
    if (rules.dollarQuotes && char === '$' && !/[\w$]/.test(sql[i - 1] ?? '')) {
      const marker =
        rules.dollarQuotes === 'tagged'
          ? /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))?.[0]
          : sql.startsWith('$$', i)
            ? '$$'
            : undefined
      if (marker) {
        const end = sql.indexOf(marker, i + marker.length)
        if (end < 0) fail('Dollar-quoted text is not closed.', `Close it with ${marker}.`)
        i = end + marker.length
        blank(start, i)
        continue
      }
    }

    output += char
    i++
  }
  return output
}

/**
 * Throws a SqlGuardError unless the text is a single read-only statement.
 * Returns the masked text for callers that inspect the query further.
 */
export function assertReadOnlySql(sql: string, dialect: SqlDialect): string {
  if (!sql.trim()) fail('SQL query is empty')
  const rules = RULES[dialect]
  const masked = maskSql(sql, dialect)

  const body = masked.replace(/;\s*$/, '')
  if (body.includes(';')) {
    fail(MULTIPLE_STATEMENTS_MESSAGE, 'Remove the extra statements after the first semicolon.')
  }

  const first = /^\s*\(*\s*([A-Za-z]+)/.exec(body)?.[1]?.toUpperCase()
  if (!first || !rules.readStarts.includes(first)) {
    const allowed = rules.readStarts.includes('WITH') ? 'SELECT or WITH' : 'SELECT'
    fail(
      first
        ? `NatureQuery only runs read-only queries, so ${first} statements are not allowed.`
        : 'This does not look like a query NatureQuery can run.',
      `Start the query with ${allowed}. To change data, use your database's own admin tool.`
    )
  }

  const scrubbed = body.replace(/\bCHARACTER\s+SET\b/gi, ' ').replace(/\bCHARSET\b/gi, ' ')
  const write = WRITE_KEYWORDS.exec(scrubbed)
  if (write) {
    const keyword = write[0].replace(/\s+/g, ' ').toUpperCase()
    fail(
      `NatureQuery only runs read-only queries, so ${keyword} is not allowed.`,
      "To change data, use your database's own admin tool with an account that has write access."
    )
  }
  const risky = rules.extraForbidden?.exec(scrubbed)
  if (risky) {
    fail(
      `${risky[0].toUpperCase()} is blocked because it can change data or affect the server.`,
      'Remove it from the query, or ask your database administrator to run it.'
    )
  }
  if (first === 'PRAGMA') assertReadPragma(scrubbed)
  return masked
}

// ── MongoDB ──────────────────────────────────────────────────────────────

/** Aggregation stages that write data. */
const MONGO_WRITE_STAGES = new Set(['$out', '$merge'])
/** Operators that run JavaScript on the database server. */
const MONGO_SERVER_CODE = new Set(['$where', '$function', '$accumulator'])

function scanMongo(value: unknown, depth = 0): void {
  if (depth > 40) fail('This MongoDB query is nested too deeply to check.')
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) scanMongo(item, depth + 1)
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (MONGO_WRITE_STAGES.has(key)) {
      fail(`${key} writes data, so it is not allowed.`, 'NatureQuery only runs read-only queries.')
    }
    if (MONGO_SERVER_CODE.has(key)) {
      fail(`${key} runs code on the database server, so it is not allowed.`)
    }
    scanMongo(child, depth + 1)
  }
}

/**
 * Checks a MongoDB query written as { "collection": "...", "pipeline": [...] }:
 * it must be valid JSON in that shape, with no stage that writes data and no
 * operator that runs server-side JavaScript, at any depth.
 */
export function assertReadOnlyMongo(text: string): { collection: string; pipeline: unknown[] } {
  let spec: unknown
  try {
    spec = JSON.parse(text)
  } catch {
    fail(
      'MongoDB queries are written as JSON, and this is not valid JSON.',
      'Example: { "collection": "orders", "pipeline": [{ "$limit": 10 }] }'
    )
  }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    fail('Write the query as a JSON object with a "collection" and a "pipeline".')
  }
  const { collection, pipeline } = spec as { collection?: unknown; pipeline?: unknown }
  if (typeof collection !== 'string' || !collection.trim()) {
    fail('Say which collection to query, for example "collection": "orders".')
  }
  if (!Array.isArray(pipeline)) fail('"pipeline" must be a list of stages.')
  scanMongo(spec)
  return { collection, pipeline }
}
