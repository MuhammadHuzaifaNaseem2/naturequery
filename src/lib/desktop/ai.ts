import { z } from 'zod'
import type { NextResponse } from 'next/server'
import { aiChatCompletion } from '@/lib/ai-client'
import { getGroqClient, isRateLimitError, parseRetryDelayMs } from '@/lib/groq-keys'
import { filterSchemaForQuestion } from '@/lib/schema-utils'
import type { DatabaseSchema } from '@/types/database'
import { desktopError } from './http'
import {
  DESKTOP_DIALECTS,
  formatDesktopSchema,
  type ChatMessage,
  type DesktopDialect,
  type DesktopSchemaTable,
} from './prompts'

/** Same model as the website, unless overridden for the desktop app. */
const MODEL = process.env.DESKTOP_AI_MODEL || 'openai/gpt-oss-20b'

const name = z.string().trim().min(1).max(512)

export const schemaTableSchema = z.object({
  name,
  kind: z.enum(['table', 'view', 'collection']).optional(),
  rows: z.number().int().min(0).optional(),
  columns: z
    .array(
      z.object({
        name,
        type: z.string().max(512),
        key: z.boolean().optional(),
        nullable: z.boolean().optional(),
        values: z.array(z.string().max(1000)).max(500).optional(),
      })
    )
    .max(1000),
  references: z
    .array(z.object({ column: name, table: name, tableColumn: name }))
    .max(200)
    .optional(),
})

export const dialectSchema = z.enum(DESKTOP_DIALECTS)
export const desktopSchemaSchema = z.array(schemaTableSchema).max(2000)

export class AiUnavailableError extends Error {}

/** Keeps the tables that matter for the question, so prompts stay small and focused. */
export function relevantSchema(
  question: string,
  tables: DesktopSchemaTable[]
): DesktopSchemaTable[] {
  const asWebSchema: DatabaseSchema = {
    tables: tables.map((table) => ({
      tableName: table.name,
      columns: table.columns.map((column) => ({
        name: column.name,
        type: column.type,
        nullable: column.nullable ?? true,
        defaultValue: null,
        isPrimaryKey: !!column.key,
      })),
      foreignKeys: (table.references ?? []).map((reference) => ({
        column: reference.column,
        referencedTable: reference.table,
        referencedColumn: reference.tableColumn,
      })),
    })),
  }
  const keep = new Set(
    filterSchemaForQuestion(question, asWebSchema).tables.map((t) => t.tableName)
  )
  return tables.filter((table) => keep.has(table.name))
}

export function schemaText(
  question: string,
  tables: DesktopSchemaTable[],
  dialect: DesktopDialect
): string {
  return formatDesktopSchema(relevantSchema(question, tables), dialect)
}

/** Calls the AI provider. Throws AiUnavailableError when no provider is configured. */
export async function complete(
  messages: ChatMessage[],
  options: { maxTokens: number; temperature: number }
): Promise<string> {
  if (!getGroqClient()) throw new AiUnavailableError('AI is not configured on this server.')
  const completion = await aiChatCompletion({
    model: MODEL,
    messages,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
  })
  return completion.choices[0]?.message?.content ?? ''
}

/** Maps AI provider failures to responses the desktop app can show. */
export function aiFailure(error: unknown): NextResponse {
  if (error instanceof AiUnavailableError) {
    return desktopError(503, 'ai_unavailable', 'AI features are not available right now.')
  }
  if (isRateLimitError(error)) {
    const seconds = Math.ceil((parseRetryDelayMs(error) ?? 10_000) / 1000)
    return desktopError(
      503,
      'ai_busy',
      `The AI service is busy. Try again in ${seconds} seconds.`,
      { retryAfter: seconds },
      { 'Retry-After': String(seconds) }
    )
  }
  console.error('[desktop-ai] completion failed:', error)
  return desktopError(502, 'ai_failed', 'The AI service could not answer. Try again.')
}
