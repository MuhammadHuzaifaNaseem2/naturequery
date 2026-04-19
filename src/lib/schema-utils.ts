/**
 * Schema utility functions — no 'use server', safe to import anywhere
 * (server actions, API routes, edge functions).
 */

import { DatabaseSchema } from '@/actions/db'

const MAX_TABLES_UNFILTERED = 12
const MAX_TABLES_IN_PROMPT = 15

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'that', 'from',
  'this', 'all', 'has', 'have', 'not', 'but', 'its', 'show',
  'me', 'give', 'get', 'list', 'find', 'what', 'how', 'many',
  'last', 'top', 'first', 'per', 'each', 'their',
])

/**
 * Abbreviation dictionary — maps short/cryptic tokens to their full English meanings.
 * Handles the common real-world pattern where DBAs abbreviate everything.
 */
const ABBR_MAP: Record<string, string[]> = {
  ord:    ['order', 'orders'],
  ordr:   ['order', 'orders'],
  cust:   ['customer', 'customers', 'client', 'clients'],
  emp:    ['employee', 'employees', 'staff', 'worker'],
  empl:   ['employee', 'employees'],
  prod:   ['product', 'products'],
  inv:    ['invoice', 'invoices', 'inventory'],
  invt:   ['inventory'],
  invc:   ['invoice', 'invoices'],
  dept:   ['department', 'departments'],
  mgr:    ['manager'],
  addr:   ['address'],
  ph:     ['phone'],
  qty:    ['quantity', 'count'],
  amt:    ['amount', 'total', 'value'],
  dt:     ['date'],
  nm:     ['name'],
  stts:   ['status'],
  sts:    ['status'],
  flg:    ['flag'],
  wh:     ['warehouse'],
  po:     ['purchase', 'order'],
  grp:    ['group'],
  cat:    ['category', 'categories'],
  catg:   ['category', 'categories'],
  pmt:    ['payment', 'payments'],
  shp:    ['shipment', 'shipping', 'ship'],
  dlvry:  ['delivery'],
  dlv:    ['delivery'],
  rcv:    ['receive', 'received'],
  recv:   ['receive', 'received'],
  vnd:    ['vendor', 'vendors', 'supplier'],
  vndr:   ['vendor', 'vendors'],
  sup:    ['supplier', 'suppliers', 'support'],
  supp:   ['supplier', 'suppliers'],
  acct:   ['account', 'accounts'],
  txn:    ['transaction', 'transactions'],
  trans:  ['transaction', 'transactions'],
  cfg:    ['config', 'configuration'],
  usr:    ['user', 'users'],
  hdr:    ['header'],
  dtl:    ['detail', 'details', 'line'],
  ln:     ['line'],
  mstr:   ['master'],
  ref:    ['reference'],
  log:    ['log', 'logs', 'history', 'audit'],
  hist:   ['history', 'historical'],
  rpt:    ['report', 'reports'],
  msg:    ['message', 'messages'],
  notif:  ['notification', 'notifications'],
  tkt:    ['ticket', 'tickets'],
  seg:    ['segment', 'segments'],
  mktg:   ['marketing'],
  camp:   ['campaign', 'campaigns'],
  rev:    ['revenue', 'review'],
  prc:    ['price'],
  prm:    ['promo', 'promotion'],
  promo:  ['promotion', 'promotions', 'discount'],
  disc:   ['discount'],
  tax:    ['tax'],
  curr:   ['currency'],
  loc:    ['location'],
  geo:    ['geography', 'location'],
  tbl:    [], // meaningless prefix
  raw:    [], // ignore — prefix meaning unprocessed
}

/**
 * Expand a token using the abbreviation map.
 * Returns the original token plus any expanded meanings.
 */
function expandToken(token: string): string[] {
  const expanded = ABBR_MAP[token]
  if (expanded && expanded.length > 0) return [token, ...expanded]
  return [token]
}

/**
 * Tokenise a question or identifier into cleaned lowercase words,
 * split on spaces and underscores, stop-words removed.
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/[\s_]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}

/**
 * Score a single table against the question tokens.
 * Returns a numeric score — higher = more relevant.
 */
function scoreTable(
  table: DatabaseSchema['tables'][number],
  questionTokens: string[],
  expandedTokens: string[][]  // questionTokens[i] expanded
): number {
  let score = 0

  // Split table name into parts (handles underscores and prefixes like "tbl_")
  const tableNameParts = tokenise(table.tableName)
  const tableNameFull = tableNameParts.join(' ')

  for (let i = 0; i < questionTokens.length; i++) {
    const allForms = expandedTokens[i]  // [original token, ...expanded meanings]

    for (const form of allForms) {
      // Exact table name match
      if (tableNameFull === form) { score += 12; break }
      // Table name part exact match
      if (tableNameParts.some(p => p === form)) { score += 8; break }
      // Table name part prefix match (e.g. "order" matches "orders")
      if (tableNameParts.some(p => p.startsWith(form) || form.startsWith(p))) { score += 5; break }
      // Substring in table name
      if (tableNameFull.includes(form)) { score += 3; break }
    }

    // Score column names
    for (const col of table.columns) {
      const colParts = tokenise(col.name)
      const colFull = colParts.join(' ')
      for (const form of allForms) {
        if (colFull === form) { score += 4; break }
        if (colParts.some(p => p === form)) { score += 3; break }
        if (colFull.includes(form)) { score += 1; break }
      }
    }
  }

  // Small boost for tables with a primary key (usually core entities)
  if (table.columns.some((c) => c.isPrimaryKey)) score += 0.5

  return score
}

export function filterSchemaForQuestion(question: string, schema: DatabaseSchema): DatabaseSchema {
  if (schema.tables.length <= MAX_TABLES_UNFILTERED) return schema

  const questionTokens = tokenise(question)
  const expandedTokens = questionTokens.map(expandToken)

  // Score all tables
  const scored = schema.tables.map((table) => ({
    table,
    score: scoreTable(table, questionTokens, expandedTokens),
  }))

  scored.sort((a, b) => b.score - a.score)

  // Take the top-scoring tables
  const topTables = scored.slice(0, MAX_TABLES_IN_PROMPT).map((s) => s.table)
  const topTableNames = new Set(topTables.map((t) => t.tableName))

  // FK cascade: for each selected table, also include tables it references via FK
  // (e.g. if order_lines is selected, include orders_hdr and products_master automatically)
  const cascadedNames = new Set(topTableNames)
  for (const table of topTables) {
    for (const fk of table.foreignKeys ?? []) {
      if (!cascadedNames.has(fk.referencedTable)) {
        // Find and add the referenced table
        const referenced = schema.tables.find((t) => t.tableName === fk.referencedTable)
        if (referenced) {
          cascadedNames.add(fk.referencedTable)
          topTables.push(referenced)
        }
      }
    }
  }

  // Cap at a hard maximum to avoid token overflow
  const MAX_WITH_CASCADE = 20
  return { tables: topTables.slice(0, MAX_WITH_CASCADE) }
}

export function formatSampleRowsForPrompt(
  tables: { tableName: string; rows: Record<string, unknown>[] }[]
): string {
  if (tables.length === 0) return ''

  let result = '\nSAMPLE DATA (real rows from the database — use these to understand actual values, formats, and data quality):\n'

  for (const { tableName, rows } of tables) {
    if (rows.length === 0) {
      result += `\n[${tableName}] — empty table\n`
      continue
    }
    const cols = Object.keys(rows[0])
    result += `\n[${tableName}]\n`
    result += cols.join(' | ') + '\n'
    result += cols.map(() => '---').join(' | ') + '\n'
    for (const row of rows) {
      result += cols.map(c => {
        const val = row[c]
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'object') return JSON.stringify(val).slice(0, 40)
        return String(val).slice(0, 60)
      }).join(' | ') + '\n'
    }
  }

  return result
}

export function formatSchemaForPrompt(schema: DatabaseSchema): string {
  if (!schema.tables || schema.tables.length === 0) {
    return 'No tables available in the database.'
  }

  let description = ''
  for (const table of schema.tables) {
    description += `\nTable: ${table.tableName}\nColumns:\n`
    for (const column of table.columns) {
      const constraints: string[] = []
      if (column.isPrimaryKey) constraints.push('PRIMARY KEY')
      if (!column.nullable) constraints.push('NOT NULL')
      // Show FK relationship inline with the column
      const fk = table.foreignKeys?.find((f) => f.column === column.name)
      if (fk) constraints.push(`FK → ${fk.referencedTable}.${fk.referencedColumn}`)
      const constraintStr = constraints.length > 0 ? ` [${constraints.join(', ')}]` : ''
      description += `  - ${column.name}: ${column.type}${constraintStr}\n`
    }
  }

  // Add a relationship summary section for the AI
  const allFKs = schema.tables.flatMap((t) =>
    (t.foreignKeys ?? []).map((fk) => `  ${t.tableName}.${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}`)
  )
  if (allFKs.length > 0) {
    description += `\nRELATIONSHIPS (use these for JOINs):\n${allFKs.join('\n')}\n`
  }

  return description
}
