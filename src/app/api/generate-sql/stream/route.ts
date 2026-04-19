/**
 * SSE Chain-of-Thought SQL Generation Stream
 *
 * Streams the AI's reasoning process token-by-token before delivering the
 * final SQL. Client receives two event types:
 *
 *   event: thought   — CoT reasoning tokens (before <sql> tag)
 *   event: sql       — final validated SQL (once </sql> is detected)
 *   event: error     — recoverable error with a message
 *   event: done      — stream complete, carries { queryId } for HITL feedback
 *
 * Messy data fixes:
 *   1. Sample rows (3 per table) are sent to the AI so it understands actual
 *      values, NULL patterns, mixed types, and cryptic column names.
 *   2. System prompt instructs the AI to handle NULL, type casting, TRIM, etc.
 *   3. Auto-retry: if the generated SQL fails to execute, the error is fed back
 *      to the AI which fixes and re-emits corrected SQL automatically.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { type DatabaseType } from '@/lib/db-drivers'
import { getOrCreateDriver } from '@/lib/driver-pool'
import {
  filterSchemaForQuestion,
  formatSchemaForPrompt,
  formatSampleRowsForPrompt,
} from '@/lib/schema-utils'
import { validateSQLSafety } from '@/lib/sql-validator'
import { getCachedSchema, setCachedSchema } from '@/lib/query-cache'
import { checkPlanLimits } from '@/lib/plan-limits'
import { DatabaseSchema } from '@/actions/db'
import Groq from 'groq-sdk'
import { getGroqClient, markKeyExhausted, isRateLimitError } from '@/lib/groq-keys'

// ---------------------------------------------------------------------------
// System prompt builder — DB-aware + messy data hardened
// ---------------------------------------------------------------------------

function buildSystemPrompt(dbType: string, schemaDesc: string, sampleRowsDesc: string): string {
  const dialect = ['mysql', 'mariadb', 'planetscale'].includes(dbType)
    ? 'MySQL'
    : dbType === 'sqlite'
    ? 'SQLite'
    : dbType === 'sqlserver'
    ? 'SQL Server (T-SQL)'
    : dbType === 'snowflake'
    ? 'Snowflake SQL'
    : dbType === 'bigquery'
    ? 'BigQuery SQL'
    : 'PostgreSQL'

  const castFn = ['mysql', 'mariadb', 'planetscale', 'sqlite'].includes(dbType)
    ? 'CAST(col AS DECIMAL) or CAST(col AS UNSIGNED)'
    : dbType === 'sqlserver'
    ? 'TRY_CAST(col AS FLOAT)'
    : 'CAST(col AS NUMERIC) or col::NUMERIC'

  const limitSyntax = dbType === 'sqlserver'
    ? 'TOP 100 in SELECT clause'
    : 'LIMIT 100 at end of query'

  return `You are an expert data analyst and ${dialect} engineer specializing in handling real-world messy databases.

When given a question, a database schema, and SAMPLE DATA, you MUST:

1. STUDY THE SAMPLE DATA FIRST — before writing any SQL:
   - Identify what each column actually contains (the column name may be cryptic like "col1" or "flag")
   - Spot NULL values, empty strings, mixed formats, inconsistent casing
   - Understand the real data types (e.g. a VARCHAR column storing numbers as "1,200" or "PKR 500")
   - Note date formats (e.g. "2024-01-15", "15/01/2024", "Jan 15 2024")

2. Think step by step:
   a. Identify which tables contain the relevant data based on BOTH column names AND sample values
   b. Check the RELATIONSHIPS section for foreign keys to use in JOINs
   c. Plan how to handle messy data (NULLs, mixed types, whitespace, inconsistent values)
   d. Verify every column you reference exists on the correct table

3. Write DEFENSIVE SQL that handles messy data:
   - Use COALESCE(col, 0) or COALESCE(col, '') for NULL values in calculations/display
   - Use TRIM(col) for columns that may have leading/trailing whitespace
   - Use ${castFn} when a text column stores numbers
   - Use IS NOT NULL / IS NULL filters when NULLs would skew results
   - For date columns stored as text: NEVER try to cast them directly. Use the row's primary key (integer ID) as a proxy for ordering by "latest" — it is always reliable.
   - Never assume a column is clean — check the sample data

4. STRING COMPARISONS (CRITICAL) — this is the #1 cause of empty results:
   - YOU WILL BE PENALIZED IF YOU DO NOT FOLLOW THIS: NEVER use regular '=' for strings!
   - Real databases use UPPER ('ACTIVE'), lower ('active'), or Mixed ('Active').
   - YOU MUST ALWAYS, ALWAYS use LOWER(column) = LOWER('value') or ILIKE for ALL string comparisons.
   - Example WRONG: party_type = 'Customer'
   - Example RIGHT: LOWER(party_type) = 'customer'
   - Even if the sample data implies correct casing, YOU MUST USE LOWER() to catch mixed-case rows!

5. JOIN strategy & Logic — Critical for accuracy:
   - ALWAYS use LEFT JOIN by default unless specifically filtering.
   - If a user asks for "overdue", "active", "pending", etc. — ALWAYS look for a status/flag column AND a date column. Do not just use dates, and do not just use statuses. Combine them (e.g. LOWER(status) != 'paid' AND due_dt < CURRENT_DATE).

6. Ordering "last N" or "latest" records:
   - NEVER ORDER BY a date column that is stored as VARCHAR/TEXT — it will sort alphabetically, not chronologically.
   - Instead, ORDER BY the table's integer primary key DESC (e.g. ORDER BY ord_id DESC, ORDER BY id DESC). Integer PKs are auto-increment and reliably reflect insertion order.

7. Output your final SQL wrapped in <sql></sql> tags.

CRITICAL RULES:
- Use ${dialect} syntax ONLY — not other SQL dialects
- SELECT statements ONLY — no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE
- Use ${limitSyntax} for open-ended queries without aggregation
- Use table aliases for readability
- NEVER reference a column that does not exist in the schema
- NEVER invent or assume table names — ONLY use table names listed in DATABASE SCHEMA below.
- ALWAYS USE LOWER(col) = LOWER('val') FOR EVERY STRING COMPARISON — NEVER USE = WITHOUT LOWER!
- Interpret business terms robustly (e.g., "overdue" means date passed AND status not paid).

Output format:
[Step-by-step reasoning — what the sample data reveals, which tables and columns to use, how to handle data quality issues]

<sql>
[Your final ${dialect} SELECT query]
</sql>

DATABASE SCHEMA:
${schemaDesc}
${sampleRowsDesc}`
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function makeSSEMessage(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  )
}

// ---------------------------------------------------------------------------
// SQL extractor — parse <sql>...</sql> from AI response
// ---------------------------------------------------------------------------

function extractSQL(text: string): string {
  const match = text.match(/<sql>([\s\S]*?)<\/sql>/i)
  if (match) return match[1].trim()
  // Fallback: if no tags, return trimmed text
  return text.trim()
}

// ---------------------------------------------------------------------------
// Stream AI response and collect full text (for retry calls)
// ---------------------------------------------------------------------------

async function streamGroqResponse(
  groq: Groq,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  send: (event: string, data: unknown) => Promise<void>,
  emitThoughts: boolean
): Promise<{ chainOfThought: string; sqlContent: string }> {
  const groqStream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    stream: true,
    messages,
    max_tokens: 2048,
    temperature: 0.1,
  })

  type Phase = 'thinking' | 'collecting' | 'done'
  let phase: Phase = 'thinking'
  let buffer = ''
  let chainOfThought = ''
  let sqlContent = ''
  const SQL_OPEN = '<sql>'
  const SQL_CLOSE = '</sql>'

  for await (const chunk of groqStream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (!token) continue
    buffer += token

    if (phase === 'thinking') {
      const openIdx = buffer.indexOf(SQL_OPEN)
      if (openIdx !== -1) {
        const remainingThought = buffer.slice(0, openIdx)
        if (remainingThought) {
          chainOfThought += remainingThought
          if (emitThoughts) await send('thought', { token: remainingThought })
        }
        phase = 'collecting'
        buffer = buffer.slice(openIdx + SQL_OPEN.length)
      } else {
        const safeLength = buffer.length - SQL_OPEN.length
        if (safeLength > 0) {
          const safe = buffer.slice(0, safeLength)
          chainOfThought += safe
          if (emitThoughts) await send('thought', { token: safe })
          buffer = buffer.slice(safeLength)
        }
      }
    } else if (phase === 'collecting') {
      const closeIdx = buffer.indexOf(SQL_CLOSE)
      if (closeIdx !== -1) {
        sqlContent += buffer.slice(0, closeIdx)
        phase = 'done'
        break
      }
      const safeLength = buffer.length - SQL_CLOSE.length
      if (safeLength > 0) {
        sqlContent += buffer.slice(0, safeLength)
        buffer = buffer.slice(safeLength)
      }
    }
  }

  // Fallbacks
  if (phase === 'thinking' && buffer.trim()) sqlContent = buffer.trim()
  else if (phase === 'collecting') sqlContent += buffer

  return { chainOfThought, sqlContent: sqlContent.trim() }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }
  const userId = session.user.id

  const quotaCheck = await checkPlanLimits(userId, 'QUERY')
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: `Query limit reached (${quotaCheck.current}/${quotaCheck.limit} this month). Upgrade your plan for more queries.`,
        limitReached: true,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let question: string
  let connectionId: string
  let conversationContext: { question: string; sql: string; rowCount?: number }[] | undefined
  try {
    const body = await request.json()
    question = (body.question as string)?.trim()
    connectionId = body.connectionId as string
    if (Array.isArray(body.conversationContext)) {
      conversationContext = body.conversationContext.slice(-5)
    }
    if (!question || !connectionId) throw new Error('missing fields')
  } catch {
    return new Response('Invalid JSON body — question and connectionId required', { status: 400 })
  }

  const MAX_QUESTION_LENGTH = 2000
  if (question.length > MAX_QUESTION_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Question too long (${question.length} chars). Maximum is ${MAX_QUESTION_LENGTH} characters.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const userTeams = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } })
  const teamIds = userTeams.map(t => t.teamId)
  const conn = await prisma.databaseConnection.findFirst({
    where: {
      id: connectionId,
      OR: [{ userId }, { teamId: { in: teamIds } }],
    },
  })
  if (!conn) {
    return new Response('Connection not found', { status: 404 })
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const send = (event: string, data: unknown) =>
    writer.write(makeSSEMessage(event, data)).catch(() => {})

  ;(async () => {
    try {
      // 1. Decrypt credentials & get driver (always — needed for sample rows)
      let decryptedPassword: string
      try {
        decryptedPassword = decrypt(conn.password)
      } catch {
        await send('error', { message: 'Could not decrypt connection credentials. Please delete and re-add this connection.' })
        return
      }

      const credentials = {
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.user,
        password: decryptedPassword,
        dbType: conn.dbType as DatabaseType,
      }
      const driver = getOrCreateDriver(credentials, credentials.dbType)

      // 2. Fetch schema — Redis cache first
      let schema: DatabaseSchema | null = await getCachedSchema<DatabaseSchema>(connectionId)
      if (!schema) {
        const tables = await driver.fetchSchema()
        schema = { tables }
        setCachedSchema(connectionId, schema).catch(() => {})
      }

      // 3. Filter schema to relevant tables
      const contextTerms = conversationContext?.map(t => t.question).join(' ') ?? ''
      const filteredSchema = filterSchemaForQuestion(question + ' ' + contextTerms, schema)
      const schemaDescription = formatSchemaForPrompt(filteredSchema)

      // 4. Fetch sample rows (3 per relevant table) — covers ALL filtered tables, not just first 8
      const sampleRows: { tableName: string; rows: Record<string, unknown>[] }[] = []
      await Promise.all(
        filteredSchema.tables.map(async (table) => {
          try {
            const result = await driver.executeQuery(
              `SELECT * FROM ${table.tableName} LIMIT 3`,
              3
            )
            sampleRows.push({ tableName: table.tableName, rows: result.rows as Record<string, unknown>[] })
          } catch {
            // Table may have access restrictions — skip silently
            sampleRows.push({ tableName: table.tableName, rows: [] })
          }
        })
      )
      const sampleRowsDescription = formatSampleRowsForPrompt(sampleRows)

      // 5. Build DB-aware, messy-data-hardened system prompt
      const baseSystemPrompt = buildSystemPrompt(conn.dbType, schemaDescription, sampleRowsDescription)
      const hasContext = conversationContext && conversationContext.length > 0
      const systemPrompt = hasContext
        ? baseSystemPrompt + '\n\nCONVERSATION MODE: The user is refining a previous query. If they say "filter", "sort", "add", "change", "now", "break down", etc., MODIFY the most recent SQL — do not start from scratch.\n'
        : baseSystemPrompt

      // 6. Get Groq client from key pool — mock mode if no keys configured
      const groqEntry = getGroqClient()
      if (!groqEntry) {
        await streamMockResponse(question, filteredSchema, userId, send)
        return
      }
      let groq = groqEntry.client
      let currentApiKey = groqEntry.apiKey

      // 7. Build messages with conversation history
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ]
      if (hasContext) {
        for (const turn of conversationContext!) {
          messages.push({ role: 'user', content: turn.question })
          messages.push({ role: 'assistant', content: `<sql>\n${turn.sql}\n</sql>` })
        }
      }
      messages.push({ role: 'user', content: question })

      // 8. Stream from Groq (with key rotation on 429)
      let chainOfThought = ''
      let sqlContent = ''
      let streamSuccess = false

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await streamGroqResponse(groq, messages, send, attempt === 0)
          chainOfThought = result.chainOfThought
          sqlContent = result.sqlContent
          streamSuccess = true
          break
        } catch (streamErr) {
          if (isRateLimitError(streamErr)) {
            markKeyExhausted(currentApiKey)
            const nextEntry = getGroqClient()
            if (nextEntry && nextEntry.apiKey !== currentApiKey) {
              groq = nextEntry.client
              currentApiKey = nextEntry.apiKey
              await send('thought', { token: '\n⏳ Switching AI provider key, retrying...\n' })
              continue
            }
          }
          throw streamErr
        }
      }

      if (!streamSuccess) {
        await send('error', { message: 'All AI keys are temporarily rate-limited. Please try again in a minute.' })
        return
      }

      let finalSQL = sqlContent || extractSQL(chainOfThought)

      // 9. Validate SQL safety (AST-based)
      const validation = validateSQLSafety(finalSQL)
      if (!validation.valid) {
        await send('error', { message: validation.error ?? 'Generated SQL failed safety validation' })
        return
      }

      // 10. Auto-retry: execute to validate — handles both SQL errors AND empty results
      let correctedSQL = finalSQL
      let testResult: { rows: unknown[] } | null = null
      try {
        testResult = await driver.executeQuery(finalSQL, 5)
      } catch (execError: unknown) {
        const errMsg = execError instanceof Error ? execError.message : String(execError)
        await send('thought', { token: `\n\n⚠️ SQL had an error: "${errMsg}" — fixing automatically...\n` })

        const fixMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
          ...messages.slice(1),
          { role: 'assistant', content: `<sql>\n${finalSQL}\n</sql>` },
          {
            role: 'user',
            content: `The SQL above failed with this error:\n\n${errMsg}\n\nAvailable tables in this database: ${filteredSchema.tables.map(t => t.tableName).join(', ')}\n\nPlease fix the SQL. Common causes:\n- WRONG TABLE NAME: you referenced a table that does not exist. Only use table names from the list above. Find the correct table by looking at its columns and sample data.\n- Wrong column name (check the schema and sample data carefully)\n- Wrong data type cast\n- Syntax error for this database dialect\n- Missing table alias\n\nOutput only the corrected SQL in <sql></sql> tags.`,
          },
        ]

        try {
          const fix = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            stream: false,
            messages: fixMessages,
            max_tokens: 1024,
            temperature: 0.05,
          })
          const fixedText = fix.choices[0]?.message?.content ?? ''
          const fixedSQL = extractSQL(fixedText)

          if (fixedSQL && fixedSQL !== finalSQL) {
            const fixValidation = validateSQLSafety(fixedSQL)
            if (fixValidation.valid) {
              correctedSQL = fixedSQL
              await send('thought', { token: '✅ SQL fixed successfully.\n' })
            }
          }
        } catch {
          // Retry failed — emit original SQL, let user see the error
        }
      }

      // Zero-row retry: if query ran but returned nothing, ask AI to reconsider
      if (testResult && testResult.rows.length === 0) {
        await send('thought', { token: `\n\n🔍 Query returned 0 rows — reconsidering JOIN strategy and filters...\n` })

        const zeroRowMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
          ...messages.slice(1),
          { role: 'assistant', content: `<sql>\n${finalSQL}\n</sql>` },
          {
            role: 'user',
            content: `The SQL above executed successfully but returned 0 rows. This is a query logic problem — the data exists in the database.

Diagnose systematically — check EVERY one of these before rewriting:

1. STRING CASE MISMATCH (most common cause): Your WHERE clause may use the wrong case.
   - PostgreSQL string comparisons are case-sensitive: 'Customer' ≠ 'CUSTOMER' ≠ 'customer'
   - Fix: use LOWER(column) = LOWER('value') for EVERY string equality check in WHERE
   - Check the SAMPLE DATA — it shows the exact case stored in the database
   - Wrong: WHERE status = 'Active'  |  Right: WHERE LOWER(status) = 'active'
   - Wrong: WHERE party_type = 'Customer'  |  Right: WHERE LOWER(party_type) = 'customer'

2. INNER JOIN filtering out rows: Any INNER JOIN with a missing match silently removes rows.
   - Switch ALL JOINs to LEFT JOIN unless you are 100% certain both sides have data.

3. Overly strict WHERE clause: Date casts on VARCHAR columns, numeric comparisons on text, etc.
   - Check every filter condition against the sample data.

4. Wrong join column: Joining on a column that doesn't actually link the tables.

Available tables: ${filteredSchema.tables.map(t => t.tableName).join(', ')}

Fix the issue and output only the corrected SQL in <sql></sql> tags.`,
          },
        ]

        try {
          const zeroFix = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            stream: false,
            messages: zeroRowMessages,
            max_tokens: 1024,
            temperature: 0.05,
          })
          const fixedText = zeroFix.choices[0]?.message?.content ?? ''
          const fixedSQL = extractSQL(fixedText)

          if (fixedSQL && fixedSQL !== finalSQL) {
            const fixValidation = validateSQLSafety(fixedSQL)
            if (fixValidation.valid) {
              correctedSQL = fixedSQL
              await send('thought', { token: '✅ Query rebuilt with corrected JOIN strategy.\n' })
            }
          }
        } catch {
          // Zero-row retry failed — emit original
        }
      }

      // 11. Persist for HITL feedback
      const feedback = await prisma.queryFeedback.create({
        data: {
          userId,
          question,
          generatedSql: correctedSQL,
          chainOfThought,
          connectionId,
          rating: 0,
        },
        select: { id: true },
      })

      await send('sql', { sql: correctedSQL })
      await send('done', { queryId: feedback.id })
    } catch (error) {
      console.error('[SSE stream] generation error:', error)
      const raw = error instanceof Error ? error.message : 'SQL generation failed'
      // Parse Groq rate-limit / API errors into friendly messages
      let friendly = raw
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const body = JSON.parse(jsonMatch[0])
          const code = body?.error?.code as string | undefined
          const inner = body?.error?.message as string | undefined
          if (code === 'rate_limit_exceeded' || inner?.includes('Rate limit')) {
            const retryMatch = inner?.match(/try again in ([\d.]+[a-z]+)/)
            friendly = `Groq API rate limit reached (external service).${retryMatch ? ` Try again in ${retryMatch[1]}.` : ' Please wait a moment and try again.'}`
          } else if (inner) {
            friendly = inner
          }
        } catch { /* keep raw */ }
      } else if (raw.startsWith('429')) {
        friendly = 'Groq API rate limit reached (external service). Please wait a moment and try again.'
      } else if (raw.startsWith('503') || raw.startsWith('502')) {
        friendly = 'AI service temporarily unavailable. Please try again.'
      }
      await send('error', { message: friendly })
    } finally {
      await writer.close().catch(() => {})
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ---------------------------------------------------------------------------
// Mock streaming (dev / no API key)
// ---------------------------------------------------------------------------

async function streamMockResponse(
  question: string,
  schema: { tables: { tableName: string; columns: { name: string }[] }[] },
  userId: string,
  send: (event: string, data: unknown) => Promise<void>
) {
  const firstTable = schema.tables[0]?.tableName ?? 'items'
  const cols = schema.tables[0]?.columns.slice(0, 3).map((c) => c.name) ?? ['id', 'name']

  const thoughts = [
    `Looking at the schema, I can see the ${firstTable} table is relevant here. `,
    `The question asks about "${question.slice(0, 40)}..." `,
    `I'll select the key columns and apply appropriate filtering. `,
    `Using LIMIT 100 as a safe default to avoid large result sets.`,
  ]

  for (const thought of thoughts) {
    await send('thought', { token: thought })
    await new Promise((r) => setTimeout(r, 120))
  }

  const mockSQL = `SELECT ${cols.join(', ')} FROM ${firstTable} LIMIT 100;`

  const feedback = await prisma.queryFeedback
    .create({
      data: {
        userId,
        question,
        generatedSql: mockSQL,
        chainOfThought: thoughts.join(''),
        rating: 0,
      },
      select: { id: true },
    })
    .catch(() => ({ id: 'mock' }))

  await send('sql', { sql: mockSQL })
  await send('done', { queryId: feedback.id })
}
