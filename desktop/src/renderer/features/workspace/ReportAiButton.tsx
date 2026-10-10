import { Flag } from 'lucide-react'
import { IconButton } from '../../components/ui'
import { openDialog, type AiReportDraft } from '../../store/app-store'

/** Inputs to the AI are capped like the service caps them. */
const ASKED_MAX = 2000
const ANSWER_MAX = 20_000

/** Opens the form for reporting a wrong or inappropriate AI answer to the NatureQuery team. */
export function ReportAiButton({ draft, className }: { draft: AiReportDraft; className?: string }) {
  return (
    <IconButton
      label="Report AI answer"
      onClick={() =>
        openDialog({
          kind: 'report-ai',
          draft: {
            kind: draft.kind,
            question: draft.question.slice(0, ASKED_MAX),
            content: draft.content.slice(0, ANSWER_MAX),
          },
        })
      }
      className={className}
    >
      <Flag className="h-3.5 w-3.5" />
    </IconButton>
  )
}
