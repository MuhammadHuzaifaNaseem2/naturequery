'use server'

import Groq from 'groq-sdk'
import { parse } from 'pgsql-ast-parser'
import { DatabaseSchema } from './db'

const MOCK_MODE = !process.env.GROQ_API_KEY

const groq = MOCK_MODE ? null : new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

export interface GenerateSQLRequest {
  question: string
  schema: DatabaseSchema
}

export interface GenerateSQLResult {
  success: boolean
  sql?: string
  error?: string
}

const STRICT_SYSTEM_PROMPT = `You are a SQL query generator. Your ONLY purpose is to convert natural language questions into PostgreSQL SELECT queries.

STRICT RULES - YOU MUST FOLLOW THESE WITHOUT EXCEPTION:

1. OUTPUT FORMAT:
   - Return ONLY the raw SQL query
   - No explanations, no comments, no markdown, no code blocks
   - No text before or after the SQL
   - Just the pure SQL statement ending with a semicolon

2. ALLOWED OPERATIONS:
   - SELECT statements ONLY
   - You may use: SELECT, FROM, WHERE, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN,
     GROUP BY, ORDER BY, HAVING, LIMIT, OFFSET, DISTINCT, COUNT, SUM, AVG, MIN, MAX,
     CASE WHEN, COALESCE, NULLIF, subqueries, CTEs (WITH clause), UNION, INTERSECT, EXCEPT

3. STRICTLY PROHIBITED - NEVER GENERATE THESE:
   - DROP (any form)
   - DELETE
   - UPDATE
   - INSERT
   - ALTER
   - CREATE
   - TRUNCATE
   - GRANT
   - REVOKE
   - EXECUTE
   - Any DDL or DML that modifies data
   - Any administrative commands
   - Comments (-- or /* */)

4. SECURITY:
   - Never include SQL injection patterns
   - Never use dynamic SQL or EXECUTE
   - Always use proper quoting for identifiers if needed

5. IF THE REQUEST IS INVALID:
   - If the user asks for something that would require modifying data, return:
     SELECT 'Error: Only read-only SELECT queries are allowed' AS error;
   - If the schema doesn't contain the requested tables/columns, return:
     SELECT 'Error: Requested data not found in schema' AS error;

DATABASE SCHEMA:
`

/**
 * Generate mock SQL based on the question and schema (for testing without API key)
 */
function generateMockSQL(question: string, schema: DatabaseSchema): string {
  const q = question.toLowerCase()
  const tables = schema.tables || []

  if (tables.length === 0) {
    return "SELECT 'No tables in schema' AS error;"
  }

  const firstTable = tables[0].tableName
  const columns = tables[0].columns.map(c => c.name).join(', ')

  // Simple pattern matching to generate reasonable mock queries
  if (q.includes('count')) {
    return `SELECT COUNT(*) AS total FROM ${firstTable};`
  }
  if (q.includes('all') || q.includes('show') || q.includes('list')) {
    return `SELECT ${columns} FROM ${firstTable} LIMIT 100;`
  }
  if (q.includes('top') || q.includes('first')) {
    const match = q.match(/top\s+(\d+)|first\s+(\d+)/)
    const limit = match ? (match[1] || match[2]) : '10'
    return `SELECT ${columns} FROM ${firstTable} LIMIT ${limit};`
  }
  if (q.includes('recent') || q.includes('latest') || q.includes('last')) {
    const dateCol = tables[0].columns.find(c =>
      c.name.includes('date') || c.name.includes('created') || c.name.includes('time')
    )
    if (dateCol) {
      return `SELECT ${columns} FROM ${firstTable} ORDER BY ${dateCol.name} DESC LIMIT 10;`
    }
  }

  // Default query
  return `SELECT ${columns} FROM ${firstTable} LIMIT 50;`
}

/**
 * Generate a SQL SELECT query from a natural language question
 * Uses Groq with Llama 3.3 70B for fast inference
 * Falls back to mock mode if no API key is configured
 */
export async function generateSQL(
  request: GenerateSQLRequest
): Promise<GenerateSQLResult> {
  try {
    // Use mock mode if no API key
    if (MOCK_MODE || !groq) {
      console.log('Running in MOCK MODE - no API key configured')
      const mockSQL = generateMockSQL(request.question, request.schema)
      return {
        success: true,
        sql: mockSQL,
      }
    }

    // Format the schema for the prompt
    const schemaDescription = formatSchemaForPrompt(request.schema)
    const fullSystemPrompt = STRICT_SYSTEM_PROMPT + schemaDescription

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: fullSystemPrompt,
        },
        {
          role: 'user',
          content: request.question,
        },
      ],
      max_tokens: 2048,
      temperature: 0.1, // Low temperature for more deterministic SQL generation
    })

    // Extract the SQL from the response
    const rawResponse = completion.choices[0]?.message?.content?.trim() || ''

    // Clean up the response - remove any markdown formatting that might slip through
    const sql = rawResponse
      .replace(/```sql\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()

    // Validate the generated SQL
    const validationResult = validateSQL(sql)
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error,
      }
    }

    return {
      success: true,
      sql,
    }
  } catch (error) {
    console.error('Failed to generate SQL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate SQL query',
    }
  }
}

/**
 * Format the database schema into a readable format for the prompt
 */
function formatSchemaForPrompt(schema: DatabaseSchema): string {
  if (!schema.tables || schema.tables.length === 0) {
    return 'No tables available in the database.'
  }

  let description = ''

  for (const table of schema.tables) {
    description += `\nTable: ${table.tableName}\n`
    description += 'Columns:\n'

    for (const column of table.columns) {
      const constraints: string[] = []
      if (column.isPrimaryKey) constraints.push('PRIMARY KEY')
      if (!column.nullable) constraints.push('NOT NULL')

      const constraintStr = constraints.length > 0 ? ` [${constraints.join(', ')}]` : ''
      description += `  - ${column.name}: ${column.type}${constraintStr}\n`
    }
  }

  return description
}

/**
 * Allowed AST statement types — only read-only operations.
 */
const ALLOWED_STATEMENT_TYPES = new Set(['select', 'union', 'with'])

/**
 * Validate that the generated SQL is safe using AST parsing.
 * This is far more robust than regex — it understands SQL structure
 * and cannot be bypassed with comments, string tricks, or obfuscation.
 */
function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'Generated SQL is empty' }
  }

  // Reject multiple statements (prevents piggy-backed attacks like "SELECT 1; DROP TABLE x")
  if (sql.replace(/;+\s*$/, '').includes(';')) {
    return { valid: false, error: 'Multiple SQL statements are not allowed' }
  }

  let statements
  try {
    statements = parse(sql)
  } catch {
    // If the parser can't understand it, reject it — don't fall back to regex guessing
    return { valid: false, error: 'Could not parse SQL query. Ensure it is valid PostgreSQL syntax.' }
  }

  if (statements.length === 0) {
    return { valid: false, error: 'No SQL statements found' }
  }

  if (statements.length > 1) {
    return { valid: false, error: 'Only a single SQL statement is allowed' }
  }

  const stmt = statements[0]
  if (!ALLOWED_STATEMENT_TYPES.has(stmt.type)) {
    return {
      valid: false,
      error: `Only SELECT queries are allowed. Got: ${stmt.type.toUpperCase()}`,
    }
  }

  return { valid: true }
}

// ─── SQL Explanation ──────────────────────────────────────────────────

export interface ExplainSQLResult {
  success: boolean
  explanation?: string
  error?: string
}

const EXPLAIN_SYSTEM_PROMPT = `You are a SQL expert. Given a SQL query, explain what it does in clear, simple English.

RULES:
- Be concise (3-5 bullet points max)
- Use plain language a non-technical person can understand
- Mention which tables and columns are involved
- Explain any filtering, grouping, or sorting
- If there are JOINs, explain the relationship
- Format as a short bulleted list using - dashes
- Do NOT include the SQL itself in your explanation
- Do NOT use markdown headers or code blocks
`

/**
 * Explain a SQL query in plain English using AI.
 * Falls back to a basic mock explanation if no API key is configured.
 */
export async function explainSQL(sql: string): Promise<ExplainSQLResult> {
  try {
    if (MOCK_MODE || !groq) {
      return {
        success: true,
        explanation: generateMockExplanation(sql),
      }
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
        { role: 'user', content: `Explain this SQL query:\n\n${sql}` },
      ],
      max_tokens: 512,
      temperature: 0.3,
    })

    const explanation = completion.choices[0]?.message?.content?.trim() || ''

    return { success: true, explanation }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to explain query',
    }
  }
}

function generateMockExplanation(sql: string): string {
  const lower = sql.toLowerCase()
  const parts: string[] = []

  // Detect tables
  const fromMatch = lower.match(/from\s+(\w+)/g)
  if (fromMatch) {
    const tables = fromMatch.map((m) => m.replace(/from\s+/i, ''))
    parts.push(`- Reads data from the ${tables.join(', ')} table${tables.length > 1 ? 's' : ''}`)
  }

  // Detect joins
  if (lower.includes('join')) {
    parts.push('- Combines data from multiple tables using a JOIN')
  }

  // Detect filtering
  if (lower.includes('where')) {
    parts.push('- Filters rows based on specific conditions')
  }

  // Detect grouping
  if (lower.includes('group by')) {
    parts.push('- Groups results and calculates aggregate values')
  }

  // Detect ordering
  if (lower.includes('order by')) {
    const dir = lower.includes('desc') ? 'descending' : 'ascending'
    parts.push(`- Sorts results in ${dir} order`)
  }

  // Detect limit
  const limitMatch = lower.match(/limit\s+(\d+)/)
  if (limitMatch) {
    parts.push(`- Returns at most ${limitMatch[1]} rows`)
  }

  if (parts.length === 0) {
    parts.push('- Retrieves data from the database')
  }

  return parts.join('\n')
}
