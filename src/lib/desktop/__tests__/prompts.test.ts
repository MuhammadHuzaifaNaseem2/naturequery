// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildFixMessages,
  buildGenerateMessages,
  formatDesktopSchema,
  parseInsightsReply,
  parseQueryReply,
  UnusableReplyError,
  type DesktopSchemaTable,
} from '../prompts'

const schema: DesktopSchemaTable[] = [
  {
    name: 'sales.customers',
    rows: 51,
    columns: [
      { name: 'id', type: 'integer', key: true, nullable: false },
      { name: 'city', type: 'text' },
    ],
  },
  {
    name: '"Order Lines"',
    kind: 'view',
    columns: [{ name: 'customer_id', type: 'integer', nullable: false }],
    references: [{ column: 'customer_id', table: 'sales.customers', tableColumn: 'id' }],
  },
]

describe('desktop prompts', () => {
  it('describes the schema with exact names and relationships', () => {
    const text = formatDesktopSchema(schema, 'postgresql')
    expect(text).toContain('Table sales.customers (about 51 rows)')
    expect(text).toContain('  id: integer [key]')
    expect(text).toContain('View "Order Lines"')
    expect(text).toContain('  customer_id: integer [not null]')
    expect(text).toContain('"Order Lines".customer_id -> sales.customers.id')
    expect(formatDesktopSchema(schema, 'mongodb')).toContain('Collection sales.customers')
  })

  it('writes rules for the database dialect', () => {
    const sqlServer = buildGenerateMessages({
      dialect: 'sqlserver',
      question: 'top customers',
      schemaText: '',
    })
    expect(sqlServer[0].content).toContain('Microsoft SQL Server')
    expect(sqlServer[0].content).toContain('Never use LIMIT')
    const oracle = buildGenerateMessages({ dialect: 'oracle', question: 'x', schemaText: '' })
    expect(oracle[0].content).toContain('FETCH FIRST n ROWS ONLY')
    const dynamo = buildGenerateMessages({ dialect: 'partiql', question: 'x', schemaText: '' })
    expect(dynamo[0].content).toContain('no JOINs, GROUP BY')
    const mongo = buildGenerateMessages({ dialect: 'mongodb', question: 'x', schemaText: '' })
    expect(mongo[0].content).toContain('"pipeline"')
    expect(mongo[0].content).not.toContain('-- comment')
  })

  it('keeps recent conversation turns', () => {
    const messages = buildGenerateMessages({
      dialect: 'postgresql',
      question: 'only Lahore',
      schemaText: '',
      conversation: [
        {
          question: 'customers by city',
          query: 'SELECT city, count(*) FROM sales.customers GROUP BY city',
        },
      ],
    })
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(messages[0].content).toContain('refining earlier questions')
  })

  it('says what failed when fixing a query', () => {
    const [, user] = buildFixMessages({
      dialect: 'mysql',
      question: '',
      failedQuery: 'SELECT nme FROM t',
      errorMessage: "Unknown column 'nme'",
      schemaText: '',
    })
    expect(user.content).toContain('wrote this query by hand')
    expect(user.content).toContain("Unknown column 'nme'")
  })
})

describe('reading model replies', () => {
  it('extracts queries from plain text and code fences', () => {
    expect(parseQueryReply('SELECT 1', 'postgresql')).toEqual({ kind: 'query', text: 'SELECT 1' })
    expect(parseQueryReply('```sql\nSELECT TOP (5) * FROM t\n```', 'sqlserver')).toEqual({
      kind: 'query',
      text: 'SELECT TOP (5) * FROM t',
    })
    expect(parseQueryReply('<think>hmm</think>SELECT 2', 'sqlite')).toEqual({
      kind: 'query',
      text: 'SELECT 2',
    })
  })

  it('recognizes clarifying questions and refusals', () => {
    expect(parseQueryReply('CLARIFY: Which year do you mean?', 'postgresql')).toEqual({
      kind: 'clarify',
      message: 'Which year do you mean?',
    })
    expect(parseQueryReply('REFUSE: Deleting data is not allowed.', 'mongodb')).toEqual({
      kind: 'refuse',
      message: 'Deleting data is not allowed.',
    })
    expect(
      parseQueryReply("SELECT 'I need more context: Which table?' AS message;", 'postgresql')
    ).toEqual({ kind: 'clarify', message: 'Which table?' })
  })

  it('returns JSON queries pretty-printed and rejects broken JSON', () => {
    const reply = 'Here you go: {"collection":"orders","pipeline":[{"$limit":5}]}'
    expect(parseQueryReply(reply, 'mongodb')).toEqual({
      kind: 'query',
      text: '{\n  "collection": "orders",\n  "pipeline": [\n    {\n      "$limit": 5\n    }\n  ]\n}',
    })
    expect(() => parseQueryReply('{"collection": "orders",', 'firestore')).toThrow(
      UnusableReplyError
    )
    expect(() => parseQueryReply('   ', 'postgresql')).toThrow(UnusableReplyError)
  })

  it('reads insights as JSON, or falls back to text', () => {
    expect(parseInsightsReply('{"summary":"Sales grew.","highlights":["Up 12%",3]}')).toEqual({
      summary: 'Sales grew.',
      highlights: ['Up 12%'],
    })
    expect(parseInsightsReply('Sales grew a lot.')).toEqual({
      summary: 'Sales grew a lot.',
      highlights: [],
    })
  })

  it('repairs summaries with broken JSON instead of showing the raw reply', () => {
    // A real reply: the highlights list is never closed.
    const missingBracket =
      '{"summary":"The query returns the top three customers by total spending.","highlights":["Result contains three rows","Customers are ranked by total_spent in descending order","Only orders with status \'completed\' or \'paid\' are included","The data is grouped by customer ID and name"}'
    expect(parseInsightsReply(missingBracket)).toEqual({
      summary: 'The query returns the top three customers by total spending.',
      highlights: [
        'Result contains three rows',
        'Customers are ranked by total_spent in descending order',
        "Only orders with status 'completed' or 'paid' are included",
        'The data is grouped by customer ID and name',
      ],
    })
    expect(
      parseInsightsReply('```json\n{"summary": "Up 12%.", "highlights": ["North leads",],}\n```')
    ).toEqual({ summary: 'Up 12%.', highlights: ['North leads'] })
    // Cut off before the end.
    expect(parseInsightsReply('{"summary": "Up 12%.", "highlights": ["North leads", "So')).toEqual({
      summary: 'Up 12%.',
      highlights: ['North leads', 'So'],
    })
    // Extra closing brackets after the object.
    expect(parseInsightsReply('{"summary": "Up 12%.", "highlights": ["North"] }}]')).toEqual({
      summary: 'Up 12%.',
      highlights: ['North'],
    })
    // Missing commas cannot be repaired, but the fields are still picked out.
    expect(
      parseInsightsReply('{"summary": "Two \\"top\\" regions." "highlights": ["North" "South"]}')
    ).toEqual({ summary: 'Two "top" regions.', highlights: ['North', 'South'] })
  })

  it('reads bulleted text summaries and rejects replies without a summary', () => {
    expect(parseInsightsReply('Sales grew.\n- North leads\n* South fell\n2. West flat')).toEqual({
      summary: 'Sales grew.',
      highlights: ['North leads', 'South fell', 'West flat'],
    })
    expect(() => parseInsightsReply('{"highlights": ["North"]}')).toThrow(UnusableReplyError)
    expect(() => parseInsightsReply('  ')).toThrow(UnusableReplyError)
  })
})
