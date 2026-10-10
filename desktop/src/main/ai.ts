import { DB_TYPE_INFO } from '@shared/db-types'
import type {
  AiReportRequest,
  ExplainRequest,
  ExplainResult,
  FixRequest,
  GenerateRequest,
  GenerateResult,
  InsightsRequest,
  InsightsResult,
  PlanUsage,
  SchemaSnapshot,
} from '@shared/types'
import type { Account } from './account'
import { aiSchema, sampleRows } from './ai-schema'

interface QueryReply {
  query?: string
  clarification?: string
  refused?: string
  plan?: PlanUsage
}

export interface AiDependencies {
  account: Account
  /** The connection's database type. */
  typeOf: (connectionId: string) => keyof typeof DB_TYPE_INFO
  schemaOf: (connectionId: string) => Promise<SchemaSnapshot>
  shareRows: () => boolean
}

function toResult(reply: QueryReply): GenerateResult {
  if (reply.query) return { kind: 'query', sql: reply.query, plan: reply.plan }
  if (reply.clarification) return { kind: 'clarify', message: reply.clarification }
  return {
    kind: 'refused',
    message: reply.refused || 'NatureQuery only reads data, so it cannot do that.',
  }
}

/** AI features, run by the NatureQuery service with the signed-in account. */
export function createAi(deps: AiDependencies) {
  const dialectOf = (connectionId: string) => DB_TYPE_INFO[deps.typeOf(connectionId)].dialect

  return {
    async generate(request: GenerateRequest): Promise<GenerateResult> {
      const schema = await deps.schemaOf(request.connectionId)
      const context = [
        request.question,
        ...(request.conversation ?? []).map((turn) => turn.question),
      ]
      const reply = await deps.account.request<QueryReply>('/api/desktop/ai/generate', {
        question: request.question,
        dialect: dialectOf(request.connectionId),
        schema: aiSchema(schema, context.join(' ')),
        conversation: (request.conversation ?? []).slice(-6).map((turn) => ({
          question: turn.question,
          query: turn.sql,
        })),
      })
      deps.account.updatePlan(reply.plan)
      return toResult(reply)
    },

    async fix(request: FixRequest): Promise<GenerateResult> {
      const schema = await deps.schemaOf(request.connectionId)
      const reply = await deps.account.request<QueryReply>('/api/desktop/ai/fix', {
        question: request.question,
        failedQuery: request.failedSql,
        errorMessage: request.errorMessage.slice(0, 4000),
        dialect: dialectOf(request.connectionId),
        schema: aiSchema(schema, `${request.question} ${request.failedSql}`),
      })
      return toResult(reply)
    },

    async explain(request: ExplainRequest): Promise<ExplainResult> {
      return deps.account.request<ExplainResult>('/api/desktop/ai/explain', {
        query: request.sql,
        dialect: dialectOf(request.connectionId),
      })
    },

    async insights(request: InsightsRequest): Promise<InsightsResult> {
      return deps.account.request<InsightsResult>('/api/desktop/ai/insights', {
        question: request.question,
        query: request.sql,
        columns: request.columns.slice(0, 300),
        // Result rows leave this computer only when the user turned this on.
        rows: deps.shareRows() ? sampleRows(request.rows) : [],
        rowCount: request.rowCount,
      })
    },

    /** Sends a report about an AI answer to the NatureQuery team. */
    async report(request: AiReportRequest): Promise<void> {
      await deps.account.request('/api/desktop/ai/report', request, 20_000)
    },
  }
}
