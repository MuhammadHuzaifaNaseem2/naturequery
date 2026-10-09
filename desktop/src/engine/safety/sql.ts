import { NqError } from '@shared/errors'
import type { Dialect } from '@shared/db-types'

/**
 * Read-only guard for SQL text. This is defense in depth, not a sandbox:
 * drivers also open read-only transactions or read-only sessions where the
 * engine supports them, and customers should connect with read-only accounts.
 *
 * The guard masks comments and quoted text (so keywords inside them are
 * ignored), then checks the remaining text for a single statement that starts
 * with a read keyword and contains no writing keywords or risky functions.
 */

export type SqlDialect = Exclude<Dialect, 'mongodb' | 'firestore'>

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

function fail(message: string, hint?: string): never {
  throw new NqError('VALIDATION', message, { hint })
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
      const close = { '[': ']', '(': ')', '{': '}', '<': '>' }[open] ?? open
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
 * Throws a validation error unless the text is a single read-only statement.
 * Returns the masked text for callers that rewrite the query.
 */
export function assertReadOnlySql(sql: string, dialect: SqlDialect): string {
  if (!sql.trim()) fail('Write a query first.')
  const rules = RULES[dialect]
  const masked = maskSql(sql, dialect)

  const body = masked.replace(/;\s*$/, '')
  if (body.includes(';')) {
    fail('Run one statement at a time.', 'Remove the extra statements after the first semicolon.')
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
  return masked
}

/** Removes everything nested inside parentheses from masked text. */
export function topLevel(masked: string): string {
  let depth = 0
  let output = ''
  for (const char of masked) {
    if (char === '(') depth++
    output += depth > 0 ? ' ' : char
    if (char === ')') depth = Math.max(0, depth - 1)
  }
  return output
}

/** Drops a single trailing semicolon, keeping everything else intact. */
export function stripTrailingSemicolon(sql: string, masked: string): string {
  const match = /;\s*$/.exec(masked)
  return match ? sql.slice(0, match.index) + sql.slice(match.index + 1) : sql
}

/**
 * Makes sure a LIMIT-style query returns at most maxRows rows. Existing
 * smaller limits are kept; larger ones are reduced. Used for dialects where
 * the driver cannot stop reading rows itself.
 */
export function applyRowLimit(sql: string, maxRows: number, dialect: SqlDialect): string {
  const masked = maskSql(sql, dialect)
  const cleaned = stripTrailingSemicolon(sql, masked).trimEnd()
  const outer = topLevel(maskSql(cleaned, dialect))

  if (/^\s*\(*\s*(SHOW|DESCRIBE|DESC|EXPLAIN|PRAGMA|EXISTS)\b/i.test(outer)) return cleaned

  const limit = /\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i.exec(outer)
  if (limit) {
    // Refuse LIMIT 1e9 or LIMIT 1 + 999999 instead of clamping part of it.
    const tail = outer.slice(limit.index + limit[0].length)
    if (!/^\s*(?:OFFSET\s+\d+\s*(?:ROWS?\s*)?)?$/i.test(tail)) {
      fail('Use a plain number for LIMIT in this workspace.', 'For example: LIMIT 100')
    }
    const value = limit[2] ?? limit[1]
    const position = limit.index + limit[0].lastIndexOf(value)
    return (
      cleaned.slice(0, position) +
      Math.min(Number(value), maxRows) +
      cleaned.slice(position + value.length)
    )
  }
  const fetch = /\bFETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY/i.exec(outer)
  if (fetch) {
    const position = fetch.index + fetch[0].indexOf(fetch[1])
    return (
      cleaned.slice(0, position) +
      Math.min(Number(fetch[1]), maxRows) +
      cleaned.slice(position + fetch[1].length)
    )
  }
  if (/\b(LIMIT|FETCH)\b/i.test(outer)) {
    fail('Use a plain number for LIMIT in this workspace.', 'For example: LIMIT 100')
  }
  return `${cleaned}\nLIMIT ${maxRows}`
}
