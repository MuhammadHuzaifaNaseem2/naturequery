import { useEffect, useRef } from 'react'
import { ArrowUp, CircleHelp, MessageSquarePlus, ShieldAlert, Sparkles, X } from 'lucide-react'
import { DB_TYPE_INFO } from '@shared/db-types'
import { Button, ErrorNotice, IconButton, Spinner } from '../../components/ui'
import { api } from '../../lib/nq'
import { askTab, dismissAssistantMessage, newConversation } from '../../store/assistant'
import { setTabQuestion, useApp, useConnection, type QueryTab } from '../../store/app-store'

const SAMPLE_QUESTIONS = [
  'Which 5 products earned the most revenue last year?',
  'How many orders did we get each month?',
  'Which customers have not ordered in the last 90 days?',
]

function placeholderFor(connectionId: string, label: string): string {
  if (connectionId === 'sample')
    return `Ask about the sample store, for example: ${SAMPLE_QUESTIONS[0]}`
  return `Ask a question about this ${label} database in plain English`
}

/** Question box shown above the editor in Ask mode. */
export function AskBar({ tab }: { tab: QueryTab }) {
  const auth = useApp((state) => state.auth)
  const connection = useConnection(tab.connectionId)
  const input = useRef<HTMLTextAreaElement>(null)
  const busy = tab.assistant.status !== 'idle'

  useEffect(() => {
    input.current?.focus()
  }, [tab.id])

  // Grow with the text, up to four lines.
  useEffect(() => {
    const element = input.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 96)}px`
  }, [tab.question])

  // The workspace only shows for a signed-in account.
  if (!connection || auth.status !== 'signed-in') return null
  const label = DB_TYPE_INFO[connection.type].label

  const plan = auth.plan
  const remaining =
    plan && plan.queryLimit > 0 ? Math.max(0, plan.queryLimit - plan.queriesUsed) : undefined
  const previous = tab.conversation.at(-1)

  return (
    <div className="shrink-0 space-y-2 border-b border-border/70 bg-primary/[0.03] px-3 py-2.5">
      {previous && (
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className="truncate">
            Follow-up to: <span className="text-foreground/80">{previous.question}</span>
          </span>
          <button
            type="button"
            onClick={() => newConversation(tab.id)}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> New question
          </button>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void askTab(tab.id)
        }}
        className="flex items-end gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
      >
        <Sparkles className="mb-1.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <textarea
          ref={input}
          rows={1}
          value={tab.question}
          onChange={(event) => setTabQuestion(tab.id, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void askTab(tab.id)
            }
          }}
          maxLength={2000}
          aria-label="Question"
          placeholder={
            previous
              ? 'Ask a follow-up, for example: only last month, or split by region'
              : placeholderFor(tab.connectionId, label)
          }
          className="max-h-24 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-[13.5px] leading-snug outline-none placeholder:text-muted-foreground/70"
          spellCheck
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={busy || !tab.question.trim()}
          icon={busy ? <Spinner className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
        >
          {tab.assistant.status === 'thinking' ? 'Thinking…' : 'Ask'}
        </Button>
      </form>

      {tab.assistant.notice && (
        <div
          className="flex items-start gap-2 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px]"
          role="status"
        >
          {tab.assistant.notice.kind === 'clarify' ? (
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          )}
          <p className="flex-1 leading-relaxed">
            {tab.assistant.notice.kind === 'clarify' && (
              <span className="font-medium">Can you be more specific? </span>
            )}
            {tab.assistant.notice.message}
          </p>
          <IconButton
            label="Dismiss"
            onClick={() => dismissAssistantMessage(tab.id)}
            className="h-6 w-6"
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      )}

      {tab.assistant.error && (
        <div className="space-y-2">
          <ErrorNotice error={tab.assistant.error} compact />
          {tab.assistant.error.code === 'PLAN_LIMIT' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => void api.auth.openAccount('/settings/billing')}
            >
              See plans
            </Button>
          )}
        </div>
      )}

      {remaining !== undefined && remaining <= 10 && !tab.assistant.error && (
        <p className="text-[11.5px] text-muted-foreground">
          {remaining === 0
            ? `You have used all ${plan!.queryLimit} AI questions in your ${plan!.planName} plan this month.`
            : `${remaining} AI question${remaining === 1 ? '' : 's'} left in your ${plan!.planName} plan this month.`}{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => void api.auth.openAccount('/settings/billing')}
          >
            Upgrade
          </button>
        </p>
      )}
    </div>
  )
}
