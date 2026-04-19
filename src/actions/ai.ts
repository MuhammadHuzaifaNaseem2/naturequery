'use server'

import { DatabaseSchema } from './db'
import { auth } from '@/lib/auth'
import { filterSchemaForQuestion, formatSchemaForPrompt } from '@/lib/schema-utils'
import { validateSQLSafety } from '@/lib/sql-validator'
import type { DatabaseType } from '@/lib/db-drivers'
import { getGroqClient as getGroqEntry, withKeyRotation } from '@/lib/groq-keys'

/**
 * Converts a raw Groq SDK / API error into a user-friendly string.
 * The Groq SDK throws errors whose .message is the raw HTTP response body,
 * e.g. `429 {"error":{"message":"Rate limit reached...","code":"rate_limit_exceeded"}}`.
 */
function parseGroqError(error: unknown): string {
  if (!(error instanceof Error)) return 'AI service error. Please try again.'

  const msg = error.message

  // Try to extract structured JSON from the message body
  const jsonMatch = msg.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const body = JSON.parse(jsonMatch[0])
      const inner = body?.error?.message as string | undefined
      const code = body?.error?.code as string | undefined

      if (
        code === 'rate_limit_exceeded' ||
        inner?.includes('rate_limit') ||
        inner?.includes('Rate limit')
      ) {
        const retryMatch = inner?.match(/try again in ([\d.]+[ms]+)/)
        const retryHint = retryMatch
          ? ` Try again in ${retryMatch[1]}.`
          : ' Please wait a moment and try again.'
        return `Groq API rate limit reached (external service).${retryHint}`
      }
      if (code === 'model_not_found' || inner?.includes('model not found')) {
        return 'AI model temporarily unavailable. Please try again.'
      }
      if (inner) return inner
    } catch {
      // JSON parse failed — fall through
    }
  }

  // Status-code prefixed messages like "429 ..." or "503 ..."
  if (msg.startsWith('429'))
    return 'Groq API rate limit reached (external service). Please wait a moment and try again.'
  if (msg.startsWith('503') || msg.startsWith('502'))
    return 'AI service temporarily unavailable. Please try again.'
  if (msg.startsWith('401')) return 'AI service authentication failed. Please contact support.'

  return msg || 'AI service error. Please try again.'
}

export interface ConversationTurn {
  question: string
  sql: string
  rowCount?: number
}

export interface GenerateSQLRequest {
  question: string
  schema: DatabaseSchema
  conversationContext?: ConversationTurn[]
  dbType?: string
}

export interface GenerateSQLResult {
  success: boolean
  sql?: string
  error?: string
}

export interface FixSQLRequest {
  failedSql: string
  errorMessage: string
  schema: DatabaseSchema
  question: string
}

const STRICT_SYSTEM_PROMPT = `You are a SQL query generator. Your ONLY purpose is to convert natural language questions into PostgreSQL SELECT queries.

STRICT RULES:

1. OUTPUT: Return ONLY the raw SQL query. No explanations, no markdown, no code blocks. Just pure SQL ending with a semicolon.

2. ALLOWED: SELECT statements ONLY — JOINs, GROUP BY, ORDER BY, HAVING, LIMIT, OFFSET, DISTINCT, aggregates (COUNT, SUM, AVG, MIN, MAX), CASE WHEN, CTEs, subqueries, UNION/INTERSECT/EXCEPT.

3. PROHIBITED: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXECUTE, comments.

4. JOINS — CRITICAL:
   - ALWAYS check the RELATIONSHIPS section at the bottom of the schema for foreign keys.
   - When a question references data from multiple tables (e.g. "orders by city"), you MUST JOIN the tables using the foreign key relationships.
   - Example: if orders.customer_id → customers.id and the user asks about city, JOIN orders with customers.
   - NEVER reference a column on a table that doesn't have it — check the column list.
   - Prefer explicit JOIN ... ON syntax over implicit WHERE joins.

5. COLUMN AWARENESS:
   - Before writing the query, mentally verify EVERY column you reference actually exists on that table.
   - If a column like "city" exists on the customers table but NOT on orders, you must JOIN to customers.

6. BEST PRACTICES:
   - Use table aliases (o for orders, c for customers, etc.)
   - Add LIMIT 100 for open-ended queries without aggregation
   - Use COALESCE for nullable aggregations

7. IF INVALID: Return SELECT 'Error: ...' AS error;

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

  // Find relevant columns
  const firstTable = tables[0].tableName
  const columns = tables[0].columns
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ')

  if (q.includes('error') || q.includes('500') || q.includes('broken')) {
    return 'SELECT * FROM this_table_does_not_exist_to_force_an_error;'
  }
  if (q.includes('count')) {
    return `SELECT COUNT(*) AS total FROM ${firstTable};`
  }
  if (q.includes('all') || q.includes('show') || q.includes('list')) {
    return `SELECT ${columns} FROM ${firstTable} LIMIT 100;`
  }
  if (q.includes('top') || q.includes('first')) {
    const match = q.match(/top\s+(\d+)|first\s+(\d+)/)
    const limit = match ? match[1] || match[2] : '10'
    return `SELECT ${columns} FROM ${firstTable} LIMIT ${limit};`
  }
  if (q.includes('recent') || q.includes('latest') || q.includes('last')) {
    const dateCol = tables[0].columns.find(
      (c) => c.name.includes('date') || c.name.includes('created') || c.name.includes('time')
    )
    if (dateCol) {
      return `SELECT ${columns} FROM ${firstTable} ORDER BY ${dateCol.name} DESC LIMIT 10;`
    }
  }

  // Default query
  return `SELECT ${columns} FROM ${firstTable} LIMIT 50;`
}

/**
 * Core SQL generation logic — no auth check.
 * Used by both the server action (with NextAuth) and the API route (with API key).
 */
export async function generateSQLFromSchema(
  question: string,
  schema: DatabaseSchema,
  conversationContext?: ConversationTurn[],
  dbType?: string
): Promise<GenerateSQLResult> {
  const MAX_QUESTION_LENGTH = 2000
  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      success: false,
      error: `Question too long (${question.length} chars). Maximum is ${MAX_QUESTION_LENGTH} characters.`,
    }
  }

  try {
    if (!getGroqEntry()) {
      console.log('Running in MOCK MODE - no API key configured')
      const mockSQL = generateMockSQL(question, schema)
      return { success: true, sql: mockSQL }
    }

    const contextTerms = conversationContext?.map((t) => t.question).join(' ') ?? ''
    const filteredSchema = filterSchemaForQuestion(question + ' ' + contextTerms, schema)
    const schemaDescription = formatSchemaForPrompt(filteredSchema)

    const hasContext = conversationContext && conversationContext.length > 0

    let basePrompt = STRICT_SYSTEM_PROMPT
    if (dbType === 'mongodb') {
      basePrompt = `You are a MongoDB pipeline generator. Your ONLY purpose is to convert natural language questions into MongoDB aggregation pipelines.

STRICT RULES:
1. OUTPUT: Return ONLY a raw JSON object string. No markdown, no \`\`\`json, no explanations.
2. FORMAT MUST BE EXACTLY: {"collection": "target_collection_name", "pipeline": [{ "$match": ... }]}
3. Use the schema to identify the right collection and fields.
4. If a query requires filtering, grouping, sorting, etc., put it in the "pipeline" array.

DATABASE SCHEMA:
`
    }

    const systemPrompt = hasContext
      ? basePrompt +
        `\nCONVERSATION MODE: The user is refining a previous query. Use the conversation history to understand context. MODIFY the most recent pipeline/query — do not start from scratch.\n\n` +
        schemaDescription
      : basePrompt + schemaDescription

    // Build messages array with conversation history
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (hasContext) {
      for (const turn of conversationContext!) {
        messages.push({ role: 'user', content: turn.question })
        messages.push({ role: 'assistant', content: turn.sql })
      }
    }

    messages.push({ role: 'user', content: question })

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 2048,
        temperature: 0.1,
      })
    )

    const rawResponse = completion.choices[0]?.message?.content?.trim() || ''
    const sql = rawResponse
      .replace(/```sql\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()

    const validationResult = validateSQLSafety(sql, dbType as DatabaseType)
    if (!validationResult.valid) {
      return { success: false, error: validationResult.error }
    }

    if (sql.toLowerCase().includes("select 'error:")) {
      return {
        success: false,
        error: sql
          .replace(/select \'error: /i, '')
          .replace(/\' as error;/i, '')
          .trim(),
      }
    }

    return { success: true, sql }
  } catch (error) {
    console.error('Failed to generate SQL:', error)
    return {
      success: false,
      error: parseGroqError(error),
    }
  }
}

/**
 * Generate a SQL SELECT query from a natural language question (authenticated server action).
 * Uses Groq with Llama 3.3 70B for fast inference.
 * Falls back to mock mode if no API key is configured.
 *
 * Note: quota is checked/recorded at execution time in executeSQLByConnection,
 * not here — so generation never double-counts.
 */
export async function generateSQL(request: GenerateSQLRequest): Promise<GenerateSQLResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  return generateSQLFromSchema(
    request.question,
    request.schema,
    request.conversationContext,
    request.dbType
  )
}

/**
 * Fix a failed SQL query using the error message
 */
export async function fixSQLFromSchema(
  failedSql: string,
  errorMessage: string,
  question: string,
  schema: DatabaseSchema
): Promise<GenerateSQLResult> {
  try {
    if (!getGroqEntry()) {
      const mockSQL = generateMockSQL(question + ' try again', schema)
      return { success: true, sql: mockSQL }
    }

    const filteredSchema = filterSchemaForQuestion(question, schema)
    const schemaDescription = formatSchemaForPrompt(filteredSchema)
    let prompt = ''

    if (failedSql) {
      prompt = `You are a PostgreSQL expert. The user wanted to answer this question:
"${question}"

The following SQL query failed with this error:
ERROR: ${errorMessage}

FAILED SQL:
\`\`\`sql
${failedSql}
\`\`\`

DATABASE SCHEMA:
${schemaDescription}

Fix the query. RESPOND ONLY WITH THE RAW CORRECTED SQL. No explanations or markdown.`
    } else {
      prompt = `You are a PostgreSQL expert. The user wanted to answer this question:
"${question}"

But your previous attempt to generate SQL failed with this error:
${errorMessage}

DATABASE SCHEMA:
${schemaDescription}

Look at the schema again and try to answer the user's question. If the exact data does not exist, write the closest possible valid query. RESPOND ONLY WITH THE RAW SQL. No explanations or markdown.`
    }

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        temperature: 0.1,
      })
    )

    const rawResponse = completion.choices[0]?.message?.content?.trim() || ''
    const sql = rawResponse
      .replace(/```sql\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()

    const validationResult = validateSQLSafety(sql)
    if (!validationResult.valid) {
      if (sql.toLowerCase().includes("select 'error:")) {
        return {
          success: false,
          error: sql
            .replace(/select \'error: /i, '')
            .replace(/\' as error;/i, '')
            .trim(),
        }
      }
      return { success: false, error: validationResult.error }
    }

    return { success: true, sql }
  } catch (error) {
    console.error('Failed to fix SQL:', error)
    return {
      success: false,
      error: parseGroqError(error),
    }
  }
}

/**
 * Server action to fix failed SQL
 */
export async function fixSQL(request: FixSQLRequest): Promise<GenerateSQLResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  return fixSQLFromSchema(request.failedSql, request.errorMessage, request.question, request.schema)
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
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    if (!getGroqEntry()) {
      return { success: true, explanation: 'This is a mock explanation because no API key is set.' }
    }

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
          { role: 'user', content: `Explain this SQL query:\n\n${sql}` },
        ],
        max_tokens: 512,
        temperature: 0.3,
      })
    )

    const explanation = completion.choices[0]?.message?.content?.trim() || ''

    return { success: true, explanation }
  } catch (error) {
    return {
      success: false,
      error: parseGroqError(error),
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

// ─── AI Natural Language Filter Refinement ──────────────────────────

export interface RefineFilterResult {
  success: boolean
  sql?: string
  filterLabel?: string
  error?: string
}

const REFINE_SYSTEM_PROMPT = `You are a SQL expert. The user has an existing SQL query and wants to apply a natural language filter/modification to it.

RULES:
1. Take the existing SQL and modify it to apply the user's filter request.
2. Common requests: "only show X", "filter by Y", "sort by Z", "group by W", "break down by month", "top 10", "above/below threshold", etc.
3. Preserve the original query structure — add WHERE clauses, modify ORDER BY, add GROUP BY, etc. Do NOT rewrite from scratch.
4. If the filter is about removing a previous filter, simplify the query accordingly.
5. Return ONLY raw SQL. No markdown, no code blocks, no explanations.
6. Also return a SHORT label (3-6 words) describing the filter for display as a pill/chip (e.g., "Orders > $500", "Grouped by month", "Top 10 only").

OUTPUT FORMAT (strict JSON, no markdown):
{
  "sql": "SELECT ...",
  "label": "Short filter label"
}
`

export async function refineQueryWithFilter(
  currentSql: string,
  filterRequest: string,
  schema: DatabaseSchema
): Promise<RefineFilterResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    if (!getGroqEntry()) {
      return { success: true, sql: currentSql, filterLabel: filterRequest.slice(0, 30) }
    }

    const filteredSchema = filterSchemaForQuestion(filterRequest, schema)
    const schemaDescription = formatSchemaForPrompt(filteredSchema)

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: REFINE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `CURRENT SQL:\n${currentSql}\n\nDATABASE SCHEMA:\n${schemaDescription}\n\nFILTER REQUEST: "${filterRequest}"`,
          },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      })
    )

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const jsonStr = raw
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()

    try {
      const parsed = JSON.parse(jsonStr)
      const sql = (parsed.sql || '')
        .replace(/```sql\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()

      const validationResult = validateSQLSafety(sql)
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error }
      }

      return { success: true, sql, filterLabel: parsed.label || filterRequest.slice(0, 30) }
    } catch {
      // If JSON parse fails, try to extract raw SQL
      const sql = jsonStr
        .replace(/```sql\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()
      return { success: true, sql, filterLabel: filterRequest.slice(0, 30) }
    }
  } catch (error) {
    return {
      success: false,
      error: parseGroqError(error),
    }
  }
}

// ─── AI SQL Clause Explanation ──────────────────────────────────────

export interface ExplainClauseResult {
  success: boolean
  explanation?: string
  error?: string
}

const CLAUSE_EXPLAIN_PROMPT = `You are a SQL teacher. The user has selected a specific part of a SQL query and wants to understand what it does.

RULES:
- Explain ONLY the highlighted clause, not the entire query
- Use plain, simple English a non-technical person can understand
- Keep it to 1-3 sentences maximum
- If it's a JOIN, explain what tables are being connected and why
- If it's a WHERE, explain what's being filtered
- If it's an aggregate function, explain what's being calculated
- Do NOT include SQL in your response
- Do NOT use markdown
`

export async function explainSQLClause(
  fullSql: string,
  selectedClause: string
): Promise<ExplainClauseResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    if (!getGroqEntry()) {
      return {
        success: true,
        explanation: `This clause "${selectedClause}" is part of the query logic.`,
      }
    }

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: CLAUSE_EXPLAIN_PROMPT },
          {
            role: 'user',
            content: `Full SQL query:\n${fullSql}\n\nSelected/highlighted clause:\n${selectedClause}\n\nExplain what this specific part does:`,
          },
        ],
        max_tokens: 256,
        temperature: 0.3,
      })
    )

    const explanation = completion.choices[0]?.message?.content?.trim() || ''
    return { success: true, explanation }
  } catch (error) {
    return {
      success: false,
      error: parseGroqError(error),
    }
  }
}

// ─── Query Performance Analysis ─────────────────────────────────────

export interface PerformanceTip {
  type: 'index' | 'optimization' | 'warning' | 'info'
  title: string
  description: string
}

export interface QueryPerformanceResult {
  success: boolean
  data?: {
    tips: PerformanceTip[]
    complexity: 'simple' | 'moderate' | 'complex'
    estimatedCost: string
  }
  error?: string
}

const PERFORMANCE_SYSTEM_PROMPT = `You are a database performance expert. Analyze the given SQL query and database schema to provide optimization tips.

RULES:
- Return exactly 2-5 actionable tips
- Focus on: missing indexes, inefficient patterns, N+1 risks, full table scans, unnecessary columns
- Each tip has: type (index|optimization|warning|info), title (5-10 words), description (1-2 sentences)
- Rate complexity as: simple (single table, no joins), moderate (1-2 joins or subquery), complex (3+ joins, CTEs, window functions)
- Estimate relative cost as: "Low", "Medium", "High", or "Very High"

OUTPUT FORMAT (strict JSON, no markdown):
{
  "tips": [
    { "type": "index", "title": "...", "description": "..." }
  ],
  "complexity": "simple",
  "estimatedCost": "Low"
}
`

export async function analyzeQueryPerformance(
  sql: string,
  schema: DatabaseSchema,
  executionTimeMs?: number,
  rowCount?: number
): Promise<QueryPerformanceResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    if (!getGroqEntry()) {
      return {
        success: true,
        data: {
          tips: [
            {
              type: 'info',
              title: 'Query looks reasonable',
              description: 'No major performance issues detected in mock mode.',
            },
          ],
          complexity: 'simple',
          estimatedCost: 'Low',
        },
      }
    }

    const schemaDescription = formatSchemaForPrompt(schema)

    const contextLines = [`SQL QUERY:\n${sql}`, `\nDATABASE SCHEMA:\n${schemaDescription}`]
    if (executionTimeMs !== undefined)
      contextLines.push(`\nActual execution time: ${executionTimeMs}ms`)
    if (rowCount !== undefined) contextLines.push(`Rows returned: ${rowCount}`)

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: PERFORMANCE_SYSTEM_PROMPT },
          { role: 'user', content: contextLines.join('\n') },
        ],
        max_tokens: 1024,
        temperature: 0.2,
      })
    )

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const jsonStr = raw
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()
    const parsed = JSON.parse(jsonStr)

    return {
      success: true,
      data: {
        tips: parsed.tips || [],
        complexity: parsed.complexity || 'simple',
        estimatedCost: parsed.estimatedCost || 'Unknown',
      },
    }
  } catch (error) {
    return {
      success: false,
      error: parseGroqError(error),
    }
  }
}

// ─── AI Schema Discovery ("What Can I Ask?") ────────────────────────

export interface SchemaDiscoveryResult {
  success: boolean
  data?: {
    summary: string
    suggestions: string[]
  }
  error?: string
}

const DISCOVERY_SYSTEM_PROMPT = `You are a data analyst assistant. Given a database schema, provide:

1. A ONE-SENTENCE summary of what this database is about (e.g., "This is an e-commerce database with customers, orders, and products.")
2. Exactly 6 natural language questions a business user would want to ask this database. Questions should:
   - Be diverse (mix of counts, trends, rankings, comparisons)
   - Reference actual table/column names from the schema
   - Be answerable with a single SQL query
   - Progress from simple to complex

OUTPUT FORMAT (strict JSON, no markdown):
{
  "summary": "One sentence describing the database",
  "suggestions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5",
    "Question 6"
  ]
}
`

export async function discoverSchema(schema: DatabaseSchema): Promise<SchemaDiscoveryResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!schema.tables || schema.tables.length === 0) {
    return { success: false, error: 'No tables found in schema' }
  }

  try {
    if (!getGroqEntry()) {
      // Mock mode — generate suggestions from table names
      const tables = schema.tables.slice(0, 10)
      const tableNames = tables.map((t) => t.tableName)
      return {
        success: true,
        data: {
          summary: `This database has ${schema.tables.length} tables including ${tableNames.slice(0, 3).join(', ')}.`,
          suggestions: [
            `How many records are in ${tableNames[0]}?`,
            `Show me the 10 most recent entries in ${tableNames[0]}`,
            tableNames[1]
              ? `What are the top 10 ${tableNames[1]} by count?`
              : `List all columns in ${tableNames[0]}`,
            tableNames[1]
              ? `Show me a breakdown of ${tableNames[0]} grouped by month`
              : `Count records per day in ${tableNames[0]}`,
            tableNames[2]
              ? `Which ${tableNames[2]} have the highest total amount?`
              : `Show unique values in ${tableNames[0]}`,
            `What trends can I see in ${tableNames[0]} over the last 30 days?`,
          ],
        },
      }
    }

    const schemaDescription = formatSchemaForPrompt(schema)

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: DISCOVERY_SYSTEM_PROMPT },
          { role: 'user', content: `DATABASE SCHEMA:\n${schemaDescription}` },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      })
    )

    const raw = completion.choices[0]?.message?.content?.trim() || ''

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonStr = raw
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()
    const parsed = JSON.parse(jsonStr)

    if (!parsed.summary || !Array.isArray(parsed.suggestions)) {
      throw new Error('Invalid response format')
    }

    return {
      success: true,
      data: {
        summary: parsed.summary,
        suggestions: parsed.suggestions.slice(0, 8),
      },
    }
  } catch (error) {
    console.error('Schema discovery failed:', error)
    // Fallback to table-based suggestions
    const tables = schema.tables.slice(0, 6)
    return {
      success: true,
      data: {
        summary: `This database has ${schema.tables.length} table${schema.tables.length !== 1 ? 's' : ''}.`,
        suggestions: tables.map((t) => `How many records are in ${t.tableName}?`),
      },
    }
  }
}

// ─── AI Chart Recommendation ──────────────────────────────────────

export interface RecommendChartRequest {
  question: string
  sql: string
  fields: string[]
  sampleRows: any[]
}

const CHART_RECOMMEND_SYSTEM_PROMPT = `You are a data visualization expert. Your task is to analyze a user's natural language question, the SQL query generated to answer it, and the structure of the resulting data to recommend the single most effective chart.

RULES:
1. Choose from: 'bar', 'line', 'pie', 'area', 'scatter'.
2. Selection logic:
   - Use 'line' or 'area' for time-series data (e.g., sales over months, daily active users).
   - Use 'bar' for categorical comparisons (e.g., top 10 products, revenue by category).
   - Use 'pie' for part-to-whole relationships (e.g., market share, percentage breakdown of 5-10 categories max).
   - Use 'scatter' only if comparing two numeric variables against each other.
3. Axis Mapping:
   - Identify the best 'xAxis' column (usually the label or time dimension).
   - Identify 1-3 'yAxis' columns (must be numeric values).
4. Title & Description:
   - Generate a professional 'title' for the chart.
   - Generate a short 'description' (1 quote-like sentence) explaining why this chart is insightful.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "type": "bar | line | pie | area | scatter",
  "xAxis": "column_name",
  "yAxis": ["numeric_col_1", "numeric_col_2"],
  "title": "Chart Title",
  "description": "Insightful sentence about the data."
}
`

import { ChartRecommendation } from '@/app/dashboard/types'

export async function recommendChart(
  request: RecommendChartRequest
): Promise<{ success: boolean; recommendation?: ChartRecommendation; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    if (!getGroqEntry()) {
      // Mock recommendation logic
      const numericFields = request.fields.filter((f) => {
        const val = request.sampleRows[0]?.[f]
        return typeof val === 'number' || typeof val === 'bigint'
      })
      const categoricalFields = request.fields.filter((f) => !numericFields.includes(f))

      return {
        success: true,
        recommendation: {
          type: 'bar',
          xAxis: categoricalFields[0] || request.fields[0],
          yAxis: numericFields.slice(0, 1),
          title: 'Data Visualization',
          description: 'A bar chart is recommended to compare values across categories.',
        },
      }
    }

    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: CHART_RECOMMEND_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `QUESTION: "${request.question}"\nSQL: \`${request.sql}\`\nFIELDS: ${request.fields.join(', ')}\nDATA SAMPLE (First 3 rows): ${JSON.stringify(request.sampleRows.slice(0, 3))}`,
          },
        ],
        max_tokens: 512,
        temperature: 0.1,
      })
    )

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const jsonStr = raw
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()
    const parsed = JSON.parse(jsonStr)

    return {
      success: true,
      recommendation: parsed,
    }
  } catch (error) {
    console.error('Chart recommendation failed:', error)
    return { success: false, error: 'Failed to generate chart recommendation' }
  }
}
