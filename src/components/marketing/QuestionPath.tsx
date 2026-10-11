/**
 * What happens between a question and its answer, drawn in the logo's
 * node-and-line style. The order is the real order of the steps.
 */

const STEPS = [
  {
    title: 'Reads your schema',
    text: 'Table and column names, types and keys. Enough to write the query, and nothing from the rows inside.',
  },
  {
    title: 'Writes the SQL',
    text: "In your database's own dialect, and always shown to you, so you can check it or keep it.",
  },
  {
    title: 'Checks it is read-only',
    text: 'Anything that would insert, update, delete or drop is refused before it reaches your database.',
  },
  {
    title: 'Runs it and answers',
    text: 'A table or chart, a summary in plain English, or an Excel file for whoever asked.',
  },
]

function Node({ last }: { last?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
        last ? 'border-mk-signal bg-mk-signal' : 'border-mk-violet bg-mk-paper'
      }`}
    >
      {!last && <span className="h-1.5 w-1.5 rounded-full bg-mk-violet" />}
    </span>
  )
}

export function QuestionPath() {
  return (
    <ol className="relative grid gap-10 md:grid-cols-4 md:gap-8">
      {/* The line that joins the steps: across on wide screens, down on narrow ones. */}
      <span
        aria-hidden
        className="absolute left-[7px] top-2 bottom-2 w-px bg-mk-rule md:left-2 md:right-2 md:top-[7px] md:bottom-auto md:h-px md:w-auto"
      />
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative flex gap-5 md:block">
          <Node last={index === STEPS.length - 1} />
          <div className="md:mt-6">
            <p className="font-nq-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-mk-violet">
              Step {index + 1}
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.01em] text-mk-ink">
              {step.title}
            </h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-mk-ink-2">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
