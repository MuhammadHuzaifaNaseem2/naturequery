import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface StepLabelProps {
  /** Position in the sequence: the question, the SQL, the answer. */
  step: '01' | '02' | '03'
  children: ReactNode
  id?: string
  className?: string
}

/**
 * The same three steps the public site shows: you ask, NatureQuery writes, the answer.
 * The answer's number sits on the marigold highlighter, like answers on the website.
 */
export function StepLabel({ step, children, id, className }: StepLabelProps) {
  const isAnswer = step === '03'
  return (
    <p
      id={id}
      className={clsx(
        'flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground',
        className
      )}
    >
      <span
        className={clsx(
          'tabular-nums',
          isAnswer ? 'rounded-[3px] bg-signal px-1 text-[hsl(252_40%_11%)]' : 'text-primary'
        )}
      >
        {step}
      </span>
      {children}
    </p>
  )
}
