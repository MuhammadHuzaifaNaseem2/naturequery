import { toast } from 'sonner'
import { api, asAppError } from '../lib/nq'
import {
  findTab,
  openDialog,
  persistTabs,
  runTab,
  updateTab,
  useApp,
  type QueryTab,
} from './app-store'

/**
 * Plain-English features: asking questions, fixing failed queries,
 * explaining queries and summarizing results. All of them need a signed-in
 * NatureQuery account; everything else in the app works without one.
 */

const get = useApp.getState

function signedIn(): boolean {
  return get().auth.status === 'signed-in'
}

/** Opens the browser to sign in, with a dialog that explains what happens next. */
export async function startSignIn(): Promise<void> {
  openDialog({ kind: 'sign-in' })
  try {
    await api.auth.signIn()
  } catch (error) {
    const appError = asAppError(error)
    toast.error(appError.message, { description: appError.hint })
  }
}

function lastQuestionOf(tab: QueryTab): string {
  return tab.lastQuestion ?? tab.conversation.at(-1)?.question ?? ''
}

/** Turns the question in the tab into a query and, unless review is on, runs it. */
export async function askTab(id: string): Promise<void> {
  const tab = findTab(id)
  const question = tab?.question.trim()
  if (!tab || !question || tab.assistant.status !== 'idle') return
  if (!signedIn()) {
    void startSignIn()
    return
  }
  updateTab(id, { assistant: { status: 'thinking' } })
  try {
    const result = await api.ai.generate({
      connectionId: tab.connectionId,
      question,
      conversation: tab.conversation,
    })
    if (result.kind !== 'query') {
      updateTab(id, {
        assistant: {
          status: 'idle',
          notice: {
            kind: result.kind === 'clarify' ? 'clarify' : 'refused',
            message: result.message,
          },
        },
      })
      return
    }
    updateTab(id, (current) => ({
      sql: result.sql,
      // Clear the box for a follow-up; the question is kept with the query.
      question: '',
      lastQuestion: question,
      conversation: [...current.conversation, { question, sql: result.sql }].slice(-6),
      assistant: { status: 'idle' },
      explanation: undefined,
      insights: undefined,
      aiChange: undefined,
    }))
    persistTabs()
    if (!get().settings.reviewAiSql) await runTab(id, { source: 'ai', question })
  } catch (error) {
    updateTab(id, { assistant: { status: 'idle', error: asAppError(error) } })
  }
}

/** Starts a new conversation, so the next question is not a follow-up. */
export function newConversation(id: string): void {
  updateTab(id, {
    conversation: [],
    question: '',
    lastQuestion: undefined,
    assistant: { status: 'idle' },
  })
  persistTabs()
}

export function dismissAssistantMessage(id: string): void {
  updateTab(id, { assistant: { status: 'idle' } })
}

/** Asks the AI to correct the query after the database rejected it, then runs the fix. */
export async function fixTab(id: string): Promise<void> {
  const tab = findTab(id)
  if (!tab || tab.status !== 'error' || !tab.error || tab.assistant.status !== 'idle') return
  if (!signedIn()) {
    void startSignIn()
    return
  }
  const failedSql = tab.sql
  // The question only describes the query if the AI wrote it for that question;
  // a query typed by hand is fixed on its own terms.
  const turn = tab.conversation.at(-1)
  const question = turn && turn.sql === failedSql ? turn.question : ''
  updateTab(id, { assistant: { status: 'fixing' } })
  try {
    const result = await api.ai.fix({
      connectionId: tab.connectionId,
      question,
      failedSql,
      errorMessage: [tab.error.message, tab.error.detail].filter(Boolean).join('\n'),
    })
    if (result.kind !== 'query') {
      updateTab(id, {
        assistant: {
          status: 'idle',
          notice: {
            kind: result.kind === 'clarify' ? 'clarify' : 'refused',
            message: result.message,
          },
        },
      })
      return
    }
    updateTab(id, (current) => ({
      sql: result.sql,
      aiChange: { before: failedSql, after: result.sql },
      assistant: { status: 'idle' },
      explanation: undefined,
      insights: undefined,
      // Keep the conversation pointing at the query that works.
      conversation: current.conversation.map((turn, index, all) =>
        index === all.length - 1 && turn.sql === failedSql ? { ...turn, sql: result.sql } : turn
      ),
    }))
    persistTabs()
    await runTab(id, { source: 'ai', question: question || undefined })
  } catch (error) {
    updateTab(id, { assistant: { status: 'idle', error: asAppError(error) } })
  }
}

/** Puts back the query the AI replaced. */
export function undoAiChange(id: string): void {
  const tab = findTab(id)
  if (!tab?.aiChange) return
  updateTab(id, { sql: tab.aiChange.before, aiChange: undefined })
  persistTabs()
}

/** Explains the current query in plain language. */
export async function explainTab(id: string): Promise<void> {
  const tab = findTab(id)
  const sql = tab?.sql.trim()
  if (!tab || !sql || tab.explanation?.status === 'loading') return
  if (!signedIn()) {
    void startSignIn()
    return
  }
  updateTab(id, { explanation: { status: 'loading' } })
  try {
    const { explanation } = await api.ai.explain({ connectionId: tab.connectionId, sql })
    updateTab(id, { explanation: { status: 'ready', text: explanation, forSql: sql } })
  } catch (error) {
    updateTab(id, { explanation: { status: 'error', error: asAppError(error) } })
  }
}

/** Summarizes the result for business readers. */
export async function summarizeTab(id: string): Promise<void> {
  const tab = findTab(id)
  const result = tab?.result
  if (!tab || !result || tab.insights?.status === 'loading') return
  if (!signedIn()) {
    void startSignIn()
    return
  }
  const usedRows = get().settings.shareSampleRowsForCharts
  updateTab(id, { insights: { status: 'loading' } })
  try {
    const insights = await api.ai.insights({
      question: lastQuestionOf(tab),
      sql: result.executedText || tab.sql,
      columns: result.columns.map((column) => column.name),
      rows: usedRows ? result.rows.slice(0, 50) : [],
      rowCount: result.rowCount,
    })
    updateTab(id, { insights: { status: 'ready', ...insights, usedRows } })
  } catch (error) {
    updateTab(id, { insights: { status: 'error', error: asAppError(error) } })
  }
}

export function dismissExplanation(id: string): void {
  updateTab(id, { explanation: undefined })
}

export function dismissInsights(id: string): void {
  updateTab(id, { insights: undefined })
}
