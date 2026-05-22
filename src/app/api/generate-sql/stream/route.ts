/**
 * SSE Chain-of-Thought SQL Generation Stream
 *
 * Streams the AI's reasoning process token-by-token before delivering the
 * final SQL. Client receives two event types:
 *
 *   event: thought   â€” CoT reasoning tokens (before <sql> tag)
 *   event: sql       â€” final validated SQL (once </sql> is detected)
 *   event: error     â€” recoverable error with a message
 *   event: done      â€” stream complete, carries { queryId } for HITL feedback
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
// System prompt builder â€” DB-aware + messy data hardened
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

  const limitSyntax =
    dbType === 'sqlserver' ? 'TOP 100 in SELECT clause' : 'LIMIT 100 at end of query'

  return `You are an expert data analyst and ${dialect} engineer specializing in handling real-world messy databases.

When given a question, a database schema, and SAMPLE DATA, you MUST:

1. STUDY THE SAMPLE DATA FIRST â€” before writing any SQL:
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
   - For date columns stored as text: NEVER try to cast them directly. Use the row's primary key (integer ID) as a proxy for ordering by "latest" â€” it is always reliable.
   - Never assume a column is clean â€” check the sample data

4. STRING COMPARISONS (CRITICAL) â€” this is the #1 cause of empty results:
   - YOU WILL BE PENALIZED IF YOU DO NOT FOLLOW THIS: NEVER use regular '=' for strings!
   - Real databases use UPPER ('ACTIVE'), lower ('active'), or Mixed ('Active').
   - YOU MUST ALWAYS, ALWAYS use LOWER(column) = LOWER('value') or ILIKE for ALL string comparisons.
   - Example WRONG: party_type = 'Customer'
   - Example RIGHT: LOWER(party_type) = 'customer'
   - Even if the sample data implies correct casing, YOU MUST USE LOWER() to catch mixed-case rows!

5. JOIN strategy & Logic â€” Critical for accuracy:
   - ALWAYS use LEFT JOIN by default unless specifically filtering.
   - If a user asks for "overdue", "active", "pending", etc. â€” ALWAYS look for a status/flag column AND a date column. Do not just use dates, and do not just use statuses. Combine them (e.g. LOWER(status) != 'paid' AND due_dt < CURRENT_DATE).

6. Ordering “last N” or “latest” records:
   - NEVER ORDER BY a date column that is stored as VARCHAR/TEXT â€” it will sort alphabetically, not chronologically.
   - Instead, ORDER BY the table's integer primary key DESC (e.g. ORDER BY ord_id DESC, ORDER BY id DESC). Integer PKs are auto-increment and reliably reflect insertion order.

7. AGGREGATION (CRITICAL) â€” when users ask for summary statistics, you MUST use the correct aggregate function:
   - “average” / “mean” / “avg” â†' use AVG(...) in the SELECT. A single aggregate expression returns ONE row — do NOT add LIMIT.
   - “total” / “sum” â†' use SUM(...)
   - “count” / “how many” â†' use COUNT(*) or COUNT(col)
   - “maximum” / “highest” / “most” â†' use MAX(...)
   - “minimum” / “lowest” / “least” â†' use MIN(...)
   - “per X” / “by X” / “breakdown by X” â†' use GROUP BY X with the aggregate
   - NEVER alias a raw column as “average_X” or “total_X” without wrapping it in AVG() or SUM(). A column name is not an aggregate function.
   - Aggregated queries (those with GROUP BY or a single aggregate) do NOT need LIMIT unless the user asks for “top N”.

8. TIME-DIFFERENCE QUERIES (CRITICAL) â€” when the user asks for "time between X and Y", "duration", "delivery time", "how long does it take", etc:
   - You need TWO DIFFERENT date/timestamp columns (e.g. ordered_at and delivered_at, or created_at and completed_at).
   - NEVER subtract a column from itself (e.g. AVG(order_date - order_date)) â€” that always equals zero and is nonsensical.
   - BEFORE generating SQL: scan the schema for two distinct datetime columns that represent the start and end of the period in question.
   - If only ONE relevant date column exists in the schema, DO NOT fabricate the second one. Instead, return an explanation in your reasoning that the requested calculation is impossible with the available schema and emit a single-column query that approximates the request (e.g. just show order_date) rather than a meaningless subtraction.

9. COLUMN-TABLE BINDING (CRITICAL) â€” the #1 cause of "column does not exist" errors:
   - Every column you reference MUST exist on the EXACT table alias you attach it to.
   - Example: if the schema shows order_date only on the "orders" table, you may write o.order_date (where o = orders) but NEVER oi.order_date (where oi = order_items) even if it seems logical.
   - When in doubt, JOIN to the table that actually owns the column instead of guessing.

10. Output your final SQL wrapped in <sql></sql> tags.

CRITICAL RULES:
- Use ${dialect} syntax ONLY â€” not other SQL dialects
- SELECT statements ONLY â€” no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE
- Use ${limitSyntax} for open-ended queries without aggregation
- Use table aliases for readability
- ALWAYS give every computed expression a meaningful AS alias (e.g. AS on_time_pct, AS avg_days). Never leave a computed column without an alias — PostgreSQL will show it as "?column?" which is confusing.
- NEVER reference a column that does not exist in the schema
- NEVER invent or assume table names â€” ONLY use table names listed in DATABASE SCHEMA below.
- ALWAYS USE LOWER(col) = LOWER('val') FOR EVERY STRING COMPARISON â€” NEVER USE = WITHOUT LOWER!
- Interpret business terms robustly (e.g., "overdue" means date passed AND status not paid).
- Always generate PostgreSQL-compatible SQL only. Never use MySQL syntax such as SHOW TABLES, SHOW DATABASES, or DESCRIBE table. Instead use information_schema equivalents, for example: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
- Never generate multiple SQL statements in a single response. Always return exactly one SQL query. If the user's question requires data from multiple tables, use UNION ALL, subqueries, or JOINs within a single statement.

Output format:
[Step-by-step reasoning â€” what the sample data reveals, which tables and columns to use, how to handle data quality issues]

<sql>
[Your final ${dialect} SELECT query]
</sql>

DATABASE SCHEMA:
${schemaDesc}
${sampleRowsDesc}`
}

// ---------------------------------------------------------------------------
// Psql meta-command normalizer — converts \dt, SHOW TABLES, etc. to valid SQL
// ---------------------------------------------------------------------------

function normalizePsqlMetaCommands(sql: string): string {
  const t = sql.trim().replace(/;?\s*$/, '')
  if (/^\\dt$/i.test(t) || /^SHOW\s+TABLES$/i.test(t) || /^SHOW\s+DATABASES$/i.test(t)) {
    return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  }
  if (/^\\l$/i.test(t)) {
    return 'SELECT datname AS database_name FROM pg_database ORDER BY datname'
  }
  const describeMatch = t.match(/^(?:\\d|DESCRIBE)\s+(\w+)$/i)
  if (describeMatch) {
    return `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${describeMatch[1]}' AND table_schema = 'public' ORDER BY ordinal_position`
  }
  return sql
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function makeSSEMessage(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// ---------------------------------------------------------------------------
// SQL extractor â€” parse <sql>...</sql> from AI response
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
    model: 'llama-3.1-8b-instant',
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
    return new Response('Invalid JSON body â€” question and connectionId required', { status: 400 })
  }

  const MAX_QUESTION_LENGTH = 2000
  if (question.length > MAX_QUESTION_LENGTH) {
    return new Response(
      JSON.stringify({
        error: `Question too long (${question.length} chars). Maximum is ${MAX_QUESTION_LENGTH} characters.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const userTeams = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  })
  const teamIds = userTeams.map((t) => t.teamId)
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
      // 1. Decrypt credentials & get driver (always â€” needed for sample rows)
      let decryptedPassword: string
      try {
        decryptedPassword = decrypt(conn.password)
      } catch {
        await send('error', {
          message:
            'Could not decrypt connection credentials. Please delete and re-add this connection.',
        })
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

      // 2. Fetch schema â€” Redis cache first
      let schema: DatabaseSchema | null = await getCachedSchema<DatabaseSchema>(connectionId)
      if (!schema) {
        const tables = await driver.fetchSchema()
        schema = { tables }
        setCachedSchema(connectionId, schema).catch(() => {})
      }

      // 3. Filter schema to relevant tables
      const contextTerms = conversationContext?.map((t) => t.question).join(' ') ?? ''
      const filteredSchema = filterSchemaForQuestion(question + ' ' + contextTerms, schema)
      const schemaDescription = formatSchemaForPrompt(filteredSchema)

      // 4. Fetch sample rows (3 per relevant table) â€” covers ALL filtered tables, not just first 8
      const sampleRows: { tableName: string; rows: Record<string, unknown>[] }[] = []
      await Promise.all(
        filteredSchema.tables.map(async (table) => {
          try {
            const result = await driver.executeQuery(`SELECT * FROM ${table.tableName} LIMIT 3`, 3)
            sampleRows.push({
              tableName: table.tableName,
              rows: result.rows as Record<string, unknown>[],
            })
          } catch {
            // Table may have access restrictions â€” skip silently
            sampleRows.push({ tableName: table.tableName, rows: [] })
          }
        })
      )
      const sampleRowsDescription = formatSampleRowsForPrompt(sampleRows)

      // 5. Build DB-aware, messy-data-hardened system prompt
      const baseSystemPrompt = buildSystemPrompt(
        conn.dbType,
        schemaDescription,
        sampleRowsDescription
      )
      const hasContext = conversationContext && conversationContext.length > 0
      const systemPrompt = hasContext
        ? baseSystemPrompt +
          '\n\nCONVERSATION MODE: The user is refining a previous query. If they say "filter", "sort", "add", "change", "now", "break down", etc., MODIFY the most recent SQL â€” do not start from scratch.\n'
        : baseSystemPrompt

      // 6a. Intent short-circuit: handle common meta-queries directly, no AI needed
      const isShowTables =
        /\b(show|list|display|get|see|what|find)\b.{0,30}\btables?\b/i.test(question) ||
        /\btables?\b.{0,20}\b(database|db|exist|available|have)\b/i.test(question)
      const isRowCount =
        /\b(how many|count|number of)\b.{0,20}\brows?\b.{0,20}\b(each|every|all|per)\b/i.test(
          question
        ) || /\brows?\b.{0,20}\b(in each|per|for each)\b.{0,20}\btables?\b/i.test(question)

      if (isShowTables) {
        await send('thought', {
          token: 'Detected table listing intent — querying information_schema directly.\n',
        })
        const sql = `SELECT table_name, table_type\nFROM information_schema.tables\nWHERE table_schema = 'public'\nORDER BY table_name`
        const feedback = await prisma.queryFeedback
          .create({
            data: {
              userId,
              question,
              generatedSql: sql,
              chainOfThought: '',
              connectionId,
              rating: 0,
            },
            select: { id: true },
          })
          .catch(() => ({ id: 'intent' }))
        await send('sql', { sql })
        await send('done', { queryId: feedback.id })
        return
      }

      if (isRowCount && filteredSchema.tables.length > 0) {
        await send('thought', {
          token: 'Detected row-count intent — building UNION ALL query from schema.\n',
        })
        const sql = filteredSchema.tables
          .map(
            (t) =>
              `SELECT '${t.tableName}' AS table_name, COUNT(*) AS row_count FROM ${t.tableName}`
          )
          .join('\nUNION ALL\n')
        const feedback = await prisma.queryFeedback
          .create({
            data: {
              userId,
              question,
              generatedSql: sql,
              chainOfThought: '',
              connectionId,
              rating: 0,
            },
            select: { id: true },
          })
          .catch(() => ({ id: 'intent' }))
        await send('sql', { sql })
        await send('done', { queryId: feedback.id })
        return
      }

      // 6. Get Groq client from key pool â€” mock mode if no keys configured
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
              await send('thought', { token: '\nâ³ Switching AI provider key, retrying...\n' })
              continue
            }
          }
          throw streamErr
        }
      }

      if (!streamSuccess) {
        await send('error', {
          message: 'All AI keys are temporarily rate-limited. Please try again in a minute.',
        })
        return
      }

      let finalSQL = normalizePsqlMetaCommands(sqlContent || extractSQL(chainOfThought))

      // 9. Validate SQL safety — with smart retry for recoverable cases
      let validation = validateSQLSafety(finalSQL)
      if (!validation.valid) {
        const isMultiStatement =
          !!validation.error?.includes('Multiple SQL statements') ||
          !!validation.error?.includes('single SQL statement')
        const isPsqlMetaOrMysql =
          /^\s*\\/.test(finalSQL) ||
          /^\s*(SHOW\s+TABLES|SHOW\s+DATABASES|DESCRIBE\s+\w)/i.test(finalSQL)

        if (isMultiStatement || isPsqlMetaOrMysql) {
          await send('thought', {
            token: isMultiStatement
              ? '\n\nMultiple statements detected — rewriting as a single UNION ALL query...\n'
              : '\n\nDetected a meta-command or MySQL syntax — rewriting with information_schema...\n',
          })

          const fixInstruction = isMultiStatement
            ? `Your previous SQL contained multiple statements separated by semicolons. You MUST return exactly ONE SQL query.\n\nFor row counts across multiple tables, use UNION ALL:\n\nSELECT 'customers' AS table_name, COUNT(*) AS row_count FROM customers\nUNION ALL\nSELECT 'orders', COUNT(*) FROM orders\n\nRewrite as a single query and output it in <sql></sql> tags.`
            : `Your previous response used a psql meta-command (\\dt, \\l, \\d) or MySQL-style command (SHOW TABLES, DESCRIBE). These do not work in a SQL editor.\n\nFor PostgreSQL, use information_schema instead:\n- List all tables: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\n- List columns: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mytable' AND table_schema = 'public'\n\nRewrite using standard SQL and output it in <sql></sql> tags.`

          const fixMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(1),
            { role: 'assistant', content: `<sql>\n${finalSQL}\n</sql>` },
            { role: 'user', content: fixInstruction },
          ]

          try {
            const fix = await groq.chat.completions.create({
              model: 'llama-3.1-8b-instant',
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
                finalSQL = fixedSQL
                validation = { valid: true }
                await send('thought', { token: '✅ SQL rewritten successfully.\n' })
              }
            }
          } catch {
            // retry failed — fall through to error below
          }
        }

        if (!validation.valid) {
          await send('error', {
            message: validation.error ?? 'Generated SQL failed safety validation',
          })
          return
        }
      }

      // 10. Auto-retry: execute to validate â€” handles both SQL errors AND empty results
      let correctedSQL = finalSQL
      let testResult: { rows: unknown[] } | null = null
      try {
        testResult = await driver.executeQuery(finalSQL, 5)
      } catch (execError: unknown) {
        const errMsg = execError instanceof Error ? execError.message : String(execError)
        await send('thought', {
          token: `\n\nâš ï¸ SQL had an error: "${errMsg}" â€” fixing automatically...\n`,
        })

        const isPsqlOrMysqlError =
          /\\dt|\\l\\b|\\c\b|\\d\b|use \\|psql meta|SHOW TABLES|information_schema/i.test(errMsg)

        const fixContent = isPsqlOrMysqlError
          ? `The SQL you generated uses a psql meta-command or MySQL-style command that does not work in a SQL editor. NEVER use \\dt, \\l, \\c, \\d, SHOW TABLES, or DESCRIBE.\n\nFor PostgreSQL, use information_schema instead:\n\nTo list all tables:\nSELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name\n\nTo describe a table's columns:\nSELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'your_table' AND table_schema = 'public'\n\nOutput only the corrected SQL in <sql></sql> tags.`
          : `The SQL above failed with this error:\n\n${errMsg}\n\nAvailable tables in this database: ${filteredSchema.tables.map((t) => t.tableName).join(', ')}\n\nPlease fix the SQL. Common causes:\n- WRONG TABLE NAME: you referenced a table that does not exist. Only use table names from the list above. Find the correct table by looking at its columns and sample data.\n- Wrong column name (check the schema and sample data carefully)\n- Wrong data type cast\n- Syntax error for this database dialect\n- Missing table alias\n\nOutput only the corrected SQL in <sql></sql> tags.`

        const fixMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
          ...messages.slice(1),
          { role: 'assistant', content: `<sql>\n${finalSQL}\n</sql>` },
          { role: 'user', content: fixContent },
        ]

        try {
          const fix = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
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
              await send('thought', { token: 'âœ… SQL fixed successfully.\n' })
            }
          }
        } catch {
          // Retry failed â€” emit original SQL, let user see the error
        }
      }

      // Zero-row retry: if query ran but returned nothing, ask AI to reconsider
      if (testResult && testResult.rows.length === 0) {
        await send('thought', {
          token: `\n\nðŸ” Query returned 0 rows â€” reconsidering JOIN strategy and filters...\n`,
        })

        const zeroRowMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
          ...messages.slice(1),
          { role: 'assistant', content: `<sql>\n${finalSQL}\n</sql>` },
          {
            role: 'user',
            content: `The SQL above executed successfully but returned 0 rows. This is a query logic problem â€” the data exists in the database.

Diagnose systematically â€” check EVERY one of these before rewriting:

1. STRING CASE MISMATCH (most common cause): Your WHERE clause may use the wrong case.
   - PostgreSQL string comparisons are case-sensitive: 'Customer' â‰  'CUSTOMER' â‰  'customer'
   - Fix: use LOWER(column) = LOWER('value') for EVERY string equality check in WHERE
   - Check the SAMPLE DATA â€” it shows the exact case stored in the database
   - Wrong: WHERE status = 'Active'  |  Right: WHERE LOWER(status) = 'active'
   - Wrong: WHERE party_type = 'Customer'  |  Right: WHERE LOWER(party_type) = 'customer'

2. INNER JOIN filtering out rows: Any INNER JOIN with a missing match silently removes rows.
   - Switch ALL JOINs to LEFT JOIN unless you are 100% certain both sides have data.

3. Overly strict WHERE clause: Date casts on VARCHAR columns, numeric comparisons on text, etc.
   - Check every filter condition against the sample data.

4. Wrong join column: Joining on a column that doesn't actually link the tables.

Available tables: ${filteredSchema.tables.map((t) => t.tableName).join(', ')}

Fix the issue and output only the corrected SQL in <sql></sql> tags.`,
          },
        ]

        try {
          const zeroFix = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
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
              await send('thought', { token: 'âœ… Query rebuilt with corrected JOIN strategy.\n' })
            }
          }
        } catch {
          // Zero-row retry failed â€” emit original
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
        } catch {
          /* keep raw */
        }
      } else if (raw.startsWith('429')) {
        friendly =
          'Groq API rate limit reached (external service). Please wait a moment and try again.'
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
