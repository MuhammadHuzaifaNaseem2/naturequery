import Anthropic from '@anthropic-ai/sdk'
import { NLToSQLRequest, NLToSQLResponse } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

/**
 * Convert natural language to SQL using Claude
 */
export async function convertNLToSQL(
  request: NLToSQLRequest,
  schema?: any
): Promise<NLToSQLResponse> {
  const systemPrompt = `You are an expert SQL query generator. Convert natural language queries into valid PostgreSQL SQL statements.

${schema ? `Database Schema:
${JSON.stringify(schema, null, 2)}` : ''}

Rules:
- Generate only valid PostgreSQL syntax
- Include appropriate WHERE clauses, JOINs, and aggregations as needed
- Use best practices for performance
- Return ONLY the SQL query without explanation unless specifically asked
- Do not include markdown code blocks or formatting
`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: request.naturalLanguage,
        },
      ],
    })

    const sqlQuery = message.content[0].type === 'text' 
      ? message.content[0].text.trim()
      : ''

    // Remove markdown code blocks if present
    const cleanSQL = sqlQuery
      .replace(/```sql\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    return {
      sql: cleanSQL,
      explanation: 'SQL query generated successfully',
      confidence: 0.95,
    }
  } catch (error) {
    console.error('Failed to generate SQL:', error)
    throw new Error('Failed to generate SQL query')
  }
}

/**
 * Explain a SQL query in natural language
 */
export async function explainSQL(sql: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Explain this SQL query in simple terms:\n\n${sql}`,
        },
      ],
    })

    return message.content[0].type === 'text' 
      ? message.content[0].text 
      : 'Unable to explain query'
  } catch (error) {
    console.error('Failed to explain SQL:', error)
    return 'Unable to explain query'
  }
}
