/**
 * Prompts for NatureQuery Desktop's AI features. The desktop app runs queries
 * against many database engines, so every prompt is written for the query
 * language of the connected database.
 */

export const DESKTOP_DIALECTS = [
  'postgresql',
  'mysql',
  'sqlserver',
  'oracle',
  'sqlite',
  'clickhouse',
  'snowflake',
  'bigquery',
  'cql',
  'partiql',
  'mongodb',
  'firestore',
] as const

export type DesktopDialect = (typeof DESKTOP_DIALECTS)[number]

export interface DesktopSchemaColumn {
  name: string
  type: string
  key?: boolean
  nullable?: boolean
  /** The allowed values of an enum column. */
  values?: string[]
}

const MAX_LISTED_VALUES = 30

/** " (one of 'student', 'teacher')" for an enum column, so queries use the exact values. */
export function enumValuesText(values: string[] | undefined): string {
  if (!values?.length) return ''
  const listed = values.slice(0, MAX_LISTED_VALUES).map((value) => `'${value.replace(/'/g, "''")}'`)
  const more = values.length - listed.length
  return ` (one of ${listed.join(', ')}${more > 0 ? `, and ${more} more` : ''})`
}

export interface DesktopSchemaTable {
  /** Fully qualified, already quoted name, exactly as it must appear in queries. */
  name: string
  kind?: 'table' | 'view' | 'collection'
  rows?: number
  columns: DesktopSchemaColumn[]
  references?: { column: string; table: string; tableColumn: string }[]
}

export interface ConversationTurn {
  question: string
  query: string
}

interface DialectGuide {
  language: string
  json: boolean
  rules: string[]
}

const GUIDES: Record<DesktopDialect, DialectGuide> = {
  postgresql: {
    language: 'PostgreSQL',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, MERGE, DDL, COPY or locking clauses.',
      'Limit row listings with LIMIT n.',
      'Use ILIKE for case-insensitive text matching.',
      "Enum and other custom-type columns: compare with = and one of the listed values (role = 'student'). Before LOWER, UPPER, LIKE or ILIKE, cast to text: role::text ILIKE '%stud%'.",
      "Dates: date_trunc('month', col), now(), current_date, now() - interval '30 days', to_char(col, 'YYYY-MM').",
    ],
  },
  mysql: {
    language: 'MySQL (also MariaDB)',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, REPLACE, DDL or locking reads.',
      'Limit row listings with LIMIT n.',
      'Quote identifiers with backticks only when the schema shows them quoted.',
      "Dates: DATE_FORMAT(col, '%Y-%m'), NOW(), CURDATE(), DATE_SUB(NOW(), INTERVAL 30 DAY).",
      'There is no FULL OUTER JOIN; combine a LEFT and a RIGHT JOIN with UNION if needed.',
    ],
  },
  sqlserver: {
    language: 'Microsoft SQL Server (T-SQL)',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, MERGE, EXEC, DDL or table hints that lock.',
      'Never use LIMIT. Limit rows with SELECT TOP (n) ..., or ORDER BY ... OFFSET 0 ROWS FETCH NEXT n ROWS ONLY.',
      'An ORDER BY inside a subquery or view needs TOP.',
      'Quote identifiers with square brackets only when the schema shows them quoted.',
      "Dates: GETDATE(), CAST(GETDATE() AS date), DATEADD(day, -30, GETDATE()), DATEFROMPARTS(YEAR(col), MONTH(col), 1) for the month, FORMAT(col, 'yyyy-MM').",
      'Booleans are bit columns: compare with 1 or 0.',
      'Every selected column that is not aggregated must be in GROUP BY.',
    ],
  },
  oracle: {
    language: 'Oracle Database SQL',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, MERGE, DDL, PL/SQL blocks or FOR UPDATE.',
      'Never use LIMIT. Limit rows with FETCH FIRST n ROWS ONLY after ORDER BY.',
      'Table aliases have no AS keyword (FROM orders o). Column aliases may use AS.',
      'Do not end the query with a semicolon.',
      'Unquoted names are upper case. Use names exactly as written in the schema.',
      "Dates: SYSDATE, TRUNC(col, 'MM') for the month, ADD_MONTHS(SYSDATE, -1), SYSDATE - 30, TO_CHAR(col, 'YYYY-MM').",
      'Concatenate text with ||. A query without a table selects FROM dual.',
    ],
  },
  sqlite: {
    language: 'SQLite',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, REPLACE, DDL, ATTACH or PRAGMA writes.',
      'Limit row listings with LIMIT n.',
      "Dates are stored as text or numbers: strftime('%Y-%m', col), date('now'), date('now', '-30 days').",
      'LIKE is already case-insensitive for English letters. Concatenate text with ||.',
    ],
  },
  clickhouse: {
    language: 'ClickHouse SQL',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, ALTER, DROP, OPTIMIZE, SYSTEM or KILL.',
      'Limit row listings with LIMIT n.',
      "Dates: toStartOfMonth(col), toDate(col), today(), now(), today() - 30, formatDateTime(col, '%Y-%m').",
      'Use countIf and sumIf for conditional totals, and uniqExact for exact distinct counts.',
      'Text comparison is case-sensitive: use ILIKE or lower() for case-insensitive matching.',
    ],
  },
  snowflake: {
    language: 'Snowflake SQL',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, MERGE, COPY, PUT or DDL.',
      'Limit row listings with LIMIT n.',
      'Unquoted names are upper case. Use names exactly as written in the schema.',
      "Dates: DATE_TRUNC('month', col), CURRENT_DATE, DATEADD(day, -30, CURRENT_DATE), TO_CHAR(col, 'YYYY-MM').",
      'Use ILIKE for case-insensitive matching and QUALIFY to filter on window functions.',
    ],
  },
  bigquery: {
    language: 'Google BigQuery standard SQL',
    json: false,
    rules: [
      'Only SELECT or WITH queries. Never INSERT, UPDATE, DELETE, MERGE, DDL, EXPORT or scripting.',
      'Limit row listings with LIMIT n.',
      'Reference tables exactly as written in the schema (dataset.table).',
      "Dates: DATE_TRUNC(col, MONTH), CURRENT_DATE(), DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), FORMAT_DATE('%Y-%m', col). For TIMESTAMP columns use TIMESTAMP_TRUNC and TIMESTAMP_SUB.",
      'Use SAFE_DIVIDE for ratios.',
      'BigQuery bills by the data scanned: select only the needed columns and filter on date or partition columns when the question allows.',
    ],
  },
  cql: {
    language: 'Apache Cassandra CQL',
    json: false,
    rules: [
      'Only SELECT. Never INSERT, UPDATE, DELETE, BATCH, TRUNCATE or DDL.',
      'Query a single table: CQL has no JOINs, subqueries or OR.',
      'Restrict the partition key with = or IN, and clustering columns in their order. Add ALLOW FILTERING only when no key can be used.',
      'GROUP BY works only on primary key columns. Aggregates: COUNT, SUM, AVG, MIN, MAX.',
      'Limit row listings with LIMIT n.',
    ],
  },
  partiql: {
    language: 'Amazon DynamoDB PartiQL',
    json: false,
    rules: [
      'Only SELECT. Never INSERT, UPDATE, DELETE or EXISTS.',
      'Query a single table, named in double quotes exactly as in the schema.',
      'There are no JOINs, GROUP BY, aggregate functions (COUNT, SUM...) or LIMIT.',
      'Filter on the partition key with = or IN whenever possible, so the whole table is not scanned.',
      'Text values use single quotes. ORDER BY needs a WHERE on the partition key.',
      'If the question needs totals or grouping, reply with CLARIFY and offer to list the matching items instead.',
    ],
  },
  mongodb: {
    language: 'MongoDB',
    json: true,
    rules: [
      'Reply with one JSON object in one of two forms:',
      '  {"collection": "<name>", "pipeline": [ ...aggregation stages ]}',
      '  {"collection": "<name>", "filter": {...}, "projection": {...}, "sort": {...}, "limit": n}',
      'Write dates as {"$date": "2026-01-01T00:00:00Z"} and object IDs as {"$oid": "..."}.',
      'Never use $out, $merge, $where, $function or $accumulator.',
      'Use $lookup to combine collections, $group for totals, $sort and $limit. Nested fields use dot notation.',
      'Add {"$limit": 100} (or "limit": 100) to open-ended listings.',
    ],
  },
  firestore: {
    language: 'Cloud Firestore',
    json: true,
    rules: [
      'Reply with one JSON object: {"collection": "<path>", "where": [["field", "op", value]], "orderBy": [["field", "asc" or "desc"]], "select": ["field"], "limit": n}.',
      'Use "collectionGroup" instead of "collection" to search every subcollection with that name.',
      'Operators: <, <=, ==, !=, >=, >, array-contains, array-contains-any, in, not-in.',
      'Write dates as {"$date": "2026-01-01T00:00:00Z"}.',
      'Firestore cannot join, group or total. If the question needs that, reply with CLARIFY and offer what is possible.',
      'When filtering a field with a range operator, that field must come first in orderBy.',
      'Add "limit": 100 to open-ended listings.',
    ],
  },
}

export function dialectLanguage(dialect: DesktopDialect): string {
  return GUIDES[dialect].language
}

export function isJsonDialect(dialect: DesktopDialect): boolean {
  return GUIDES[dialect].json
}

const MAX_SCHEMA_CHARS = 60_000

/** Compact schema description. Names are given exactly as queries must use them. */
export function formatDesktopSchema(tables: DesktopSchemaTable[], dialect: DesktopDialect): string {
  if (!tables.length) return 'The database has no tables the user can read.'
  const document = GUIDES[dialect].json
  const lines: string[] = []
  const relationships: string[] = []
  for (const table of tables) {
    const kind =
      document || table.kind === 'collection'
        ? 'Collection'
        : table.kind === 'view'
          ? 'View'
          : 'Table'
    const size =
      typeof table.rows === 'number' && table.rows >= 0 ? ` (about ${table.rows} rows)` : ''
    lines.push(`${kind} ${table.name}${size}`)
    for (const column of table.columns) {
      const flags = [
        column.key ? 'key' : '',
        column.nullable === false && !column.key ? 'not null' : '',
      ]
        .filter(Boolean)
        .join(', ')
      lines.push(
        `  ${column.name}: ${column.type}${enumValuesText(column.values)}${flags ? ` [${flags}]` : ''}`
      )
    }
    for (const reference of table.references ?? []) {
      relationships.push(
        `  ${table.name}.${reference.column} -> ${reference.table}.${reference.tableColumn}`
      )
    }
  }
  if (relationships.length) lines.push('', 'Relationships (use these to join):', ...relationships)
  const text = lines.join('\n')
  return text.length > MAX_SCHEMA_CHARS
    ? `${text.slice(0, MAX_SCHEMA_CHARS)}\n(schema truncated)`
    : text
}

function outputRules(dialect: DesktopDialect): string[] {
  const guide = GUIDES[dialect]
  return [
    guide.json
      ? 'Reply with the JSON query only: no explanation, no markdown, no code fences, no comments.'
      : 'Reply with the query only: no explanation, no markdown, no code fences.',
    'If the request asks to change data or the database, reply exactly: REFUSE: <one short sentence>',
    'If nothing in the schema could answer the question, or it has no clear data request, reply exactly: CLARIFY: <one short question for the user>. When the schema has a likely answer, write the query instead.',
  ]
}

/** Rules for this query language, shared with the website's prompts. */
export function dialectRules(dialect: DesktopDialect): string[] {
  return GUIDES[dialect].rules
}

/** How to read business words that are not table names, such as "students". */
export function assumptionRule(json: boolean): string {
  return json
    ? 'When the question uses a word that is not a collection or field name (for example students, members, clients or patients), use the collection and field that most likely hold it, such as people filtered by a role or type field.'
    : "When the question uses a word that is not a table or column name (for example students, members, clients or patients), use the table and column that most likely hold it, such as a people table filtered by a role or type column, or the distinct people in a related table. If you have not seen the exact value, match it loosely, for example lower(role) LIKE '%student%'. State that assumption in a short -- comment on the first line."
}

function queryRules(dialect: DesktopDialect): string[] {
  const guide = GUIDES[dialect]
  return [
    ...guide.rules,
    'Use only the tables, collections and fields in the schema below, with names exactly as written there.',
    guide.json
      ? 'Only reference fields that exist in the schema.'
      : 'Join tables using the listed relationships, and check every column exists on the table you use it with.',
    'Prefer the specific columns that answer the question over selecting everything.',
    'Limit open-ended listings to 100 rows. Totals and grouped results need no limit.',
    'Never invent filter values that the question does not mention, apart from the loose match described next.',
    assumptionRule(guide.json),
    'Answer questions about the data from the tables in the schema. Use system catalogs only when the question is about the database structure itself.',
    guide.json
      ? 'For revenue or sales, total the amount field of completed or paid records when a status field exists.'
      : 'For revenue or sales, total the amount column of completed or paid rows when a status column exists, and state that assumption in a short -- comment on the first line.',
  ]
}

function systemPrompt(dialect: DesktopDialect, schemaText: string): string {
  const guide = GUIDES[dialect]
  return [
    `You write ${guide.language} queries that answer questions about the user's database. The queries are read-only and run in NatureQuery Desktop.`,
    '',
    'Output:',
    ...outputRules(dialect).map((rule) => `- ${rule}`),
    '',
    'Query rules:',
    ...queryRules(dialect).map((rule) => (rule.startsWith('  ') ? rule : `- ${rule}`)),
    '',
    'Schema:',
    schemaText,
  ].join('\n')
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildGenerateMessages(input: {
  dialect: DesktopDialect
  question: string
  schemaText: string
  conversation?: ConversationTurn[]
}): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(input.dialect, input.schemaText) },
  ]
  const turns = (input.conversation ?? []).slice(-6)
  if (turns.length) {
    messages[0].content +=
      '\n\nThe user is refining earlier questions. Change the most recent query to answer the new question instead of starting over.'
    for (const turn of turns) {
      messages.push({ role: 'user', content: turn.question })
      messages.push({ role: 'assistant', content: turn.query })
    }
  }
  messages.push({ role: 'user', content: input.question })
  return messages
}

export function buildFixMessages(input: {
  dialect: DesktopDialect
  question: string
  failedQuery: string
  errorMessage: string
  schemaText: string
}): ChatMessage[] {
  const goal = input.question.trim()
    ? `The user asked: "${input.question.trim()}"`
    : 'The user wrote this query by hand.'
  return [
    { role: 'system', content: systemPrompt(input.dialect, input.schemaText) },
    {
      role: 'user',
      content: [
        goal,
        '',
        'This query failed:',
        input.failedQuery,
        '',
        `The database returned this error: ${input.errorMessage}`,
        '',
        'Reply with a corrected query that does what was intended.',
      ].join('\n'),
    },
  ]
}

export function buildExplainMessages(input: {
  dialect: DesktopDialect
  query: string
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        `You explain ${GUIDES[input.dialect].language} queries to business users who do not write queries.`,
        '- Reply with 2 to 5 short bullet points, each starting with "- ".',
        '- Say which data is used, how it is filtered, grouped and sorted, in plain words.',
        '- Do not repeat the query, and do not use headings or code.',
      ].join('\n'),
    },
    { role: 'user', content: `Explain this query:\n\n${input.query}` },
  ]
}

export function buildInsightsMessages(input: {
  question: string
  query: string
  columns: string[]
  rows: unknown[][]
  rowCount: number
}): ChatMessage[] {
  const sample = input.rows.length
    ? JSON.stringify(input.rows.slice(0, 50))
    : '(rows were not shared; describe what the result contains from the column names)'
  return [
    {
      role: 'system',
      content: [
        'You summarize query results for business users.',
        'Reply with one JSON object: {"summary": "<one or two sentences>", "highlights": ["<short finding>", ...]}.',
        'Give at most 4 highlights. Use numbers from the data. Never invent values that are not in the rows.',
        'No markdown, no code fences.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Question: ${input.question || '(no question; the user wrote the query)'}`,
        `Query: ${input.query}`,
        `Columns: ${input.columns.join(', ')}`,
        `Total rows: ${input.rowCount}`,
        `Rows: ${sample}`,
      ].join('\n'),
    },
  ]
}

export type GenerateOutcome =
  | { kind: 'query'; text: string }
  | { kind: 'clarify'; message: string }
  | { kind: 'refuse'; message: string }

/** Thrown when the model's reply cannot be used as a query. */
export class UnusableReplyError extends Error {}

function stripWrapping(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const fence = /```[\w-]*[ \t]*\n?([\s\S]*?)```/.exec(text)
  if (fence) text = fence[1].trim()
  return text
}

/** Turns the model's reply into a query, a clarifying question or a refusal. */
export function parseQueryReply(raw: string, dialect: DesktopDialect): GenerateOutcome {
  const text = stripWrapping(raw)
  const clarify = /^CLARIFY:\s*([\s\S]+)$/i.exec(text)
  if (clarify) return { kind: 'clarify', message: clarify[1].trim() }
  const refuse = /^REFUSE:\s*([\s\S]+)$/i.exec(text)
  if (refuse) return { kind: 'refuse', message: refuse[1].trim() }
  // Older prompt style that some models still produce.
  const message = /^SELECT\s+'(?:I need more context:\s*)?([^']+)'\s+AS\s+message\b/i.exec(text)
  if (message) return { kind: 'clarify', message: message[1].trim() }

  if (GUIDES[dialect].json) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) throw new UnusableReplyError('The AI did not return a query.')
    try {
      const parsed = JSON.parse(text.slice(start, end + 1))
      return { kind: 'query', text: JSON.stringify(parsed, null, 2) }
    } catch {
      throw new UnusableReplyError('The AI returned a query that is not valid JSON.')
    }
  }
  if (!text) throw new UnusableReplyError('The AI did not return a query.')
  return { kind: 'query', text }
}

export function parseExplainReply(raw: string): string {
  return stripWrapping(raw)
}

/**
 * Reads a summary reply. Models sometimes return slightly broken JSON (a
 * missing bracket, a trailing comma, a cut-off ending), so the reply is
 * repaired or picked apart rather than shown to the user as raw JSON.
 */
export function parseInsightsReply(raw: string): { summary: string; highlights: string[] } {
  const text = stripWrapping(raw)
  if (!text.includes('{')) return plainInsights(text)

  const parsed = readJsonObject(text)
  if (parsed && typeof parsed.summary === 'string' && parsed.summary.trim()) {
    const highlights = Array.isArray(parsed.highlights) ? parsed.highlights : []
    return {
      summary: parsed.summary.trim(),
      highlights: highlights
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim())
        .slice(0, 4),
    }
  }
  const summary = jsonStringField(text, 'summary')
  if (summary) return { summary, highlights: jsonStringList(text, 'highlights').slice(0, 4) }
  throw new UnusableReplyError('The AI summary could not be read.')
}

/** Plain-text summaries: lines starting with a bullet are highlights. */
function plainInsights(text: string): { summary: string; highlights: string[] } {
  const summary: string[] = []
  const highlights: string[] = []
  for (const line of text.split('\n')) {
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line)
    if (bullet) highlights.push(bullet[1].trim())
    else if (line.trim()) summary.push(line.trim())
  }
  if (!summary.length && !highlights.length) {
    throw new UnusableReplyError('The AI summary could not be read.')
  }
  return {
    summary: (summary.length ? summary.join(' ') : highlights.shift()!).slice(0, 600),
    highlights: highlights.slice(0, 4),
  }
}

/** The first JSON object in a reply, with one repair attempt if it does not parse. */
function readJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  const candidates = [end > start ? text.slice(start, end + 1) : '', repairJson(text.slice(start))]
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

/**
 * Closes brackets and strings the model left open and drops trailing commas.
 * Only used for summaries: guessing where a bracket belongs could change what
 * a query does, so queries must parse as they are.
 */
function repairJson(text: string): string {
  const closers: string[] = []
  let out = ''
  let inString = false
  let escaped = false
  const close = (closer: string) => {
    out = out.replace(/,\s*$/, '') + closer
  }
  for (const char of text) {
    if (inString) {
      out += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
      out += char
    } else if (char === '{' || char === '[') {
      closers.push(char === '{' ? '}' : ']')
      out += char
    } else if (char === '}' || char === ']') {
      // Ignore a closing bracket that matches nothing that is open.
      if (!closers.includes(char)) continue
      while (closers.at(-1) !== char) close(closers.pop()!)
      close(closers.pop()!)
      if (!closers.length) return out
    } else {
      out += char
    }
  }
  if (inString) out += '"'
  while (closers.length) close(closers.pop()!)
  return out
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
  }
}

/** A string field from text that is not valid JSON, for example `"summary": "..."`. */
function jsonStringField(text: string, key: string): string {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text)
  return match ? unescapeJsonString(match[1]).trim() : ''
}

/** The strings of a list field from text that is not valid JSON. */
function jsonStringList(text: string, key: string): string[] {
  const start = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(text)
  if (!start) return []
  const items: string[] = []
  const item = /\s*,?\s*"((?:[^"\\]|\\.)*)"/y
  item.lastIndex = start.index + start[0].length
  for (let match = item.exec(text); match; match = item.exec(text)) {
    const value = unescapeJsonString(match[1]).trim()
    if (value) items.push(value)
  }
  return items
}
