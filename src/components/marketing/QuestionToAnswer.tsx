import { Check } from 'lucide-react'

/**
 * The home page's centerpiece: one real question, the SQL NatureQuery writes
 * for it, and the rows it returns. Query and results come from the built-in
 * sample store (orders from 2026, as of the end of September).
 */

const QUESTION = 'Which 5 customers spent the most this year?'

const SQL = `SELECT c.name, c.country,
       SUM(o.total_amount) AS total_spent
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status IN ('completed', 'shipped')
  AND o.order_date >= '2026-01-01'
GROUP BY c.id, c.name, c.country
ORDER BY total_spent DESC
LIMIT 5;`

const ROWS = [
  { name: 'Lucia Lopez', country: 'Canada', spent: 17647.2 },
  { name: 'Lucia Kowalski', country: 'Australia', spent: 14454.9 },
  { name: 'Ruby Muller', country: 'Australia', spent: 13912.2 },
  { name: 'Liam Muller', country: 'United Arab Emirates', spent: 11923.2 },
  { name: 'Ava Tanaka', country: 'United Arab Emirates', spent: 11862.9 },
]

const KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'JOIN',
  'ON',
  'WHERE',
  'IN',
  'AND',
  'GROUP',
  'BY',
  'ORDER',
  'DESC',
  'LIMIT',
  'AS',
  'SUM',
])

function SqlLine({ line }: { line: string }) {
  const tokens = line.match(/'[^']*'|[A-Za-z_]+|\d+|\s+|./g) ?? []
  return (
    <>
      {tokens.map((token, index) => {
        if (KEYWORDS.has(token))
          return (
            <span key={index} className="text-mk-violet">
              {token}
            </span>
          )
        if (token.startsWith("'"))
          return (
            <span key={index} className="text-mk-signal-ink">
              {token}
            </span>
          )
        if (/^\d+$/.test(token))
          return (
            <span key={index} className="text-mk-signal-ink">
              {token}
            </span>
          )
        return <span key={index}>{token}</span>
      })}
    </>
  )
}

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Stage({
  step,
  label,
  children,
  className = '',
}: {
  step: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <div className="mk-label flex items-center gap-2 border-b border-mk-rule px-5 py-3">
        <span className="text-mk-violet">{step}</span>
        {label}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5">{children}</div>
    </div>
  )
}

export function QuestionToAnswer() {
  const max = ROWS[0].spent
  return (
    <figure className="overflow-hidden rounded-xl border border-mk-rule bg-mk-surface shadow-[0_1px_0_hsl(var(--mk-rule)),0_30px_60px_-36px_hsl(var(--mk-ink)/0.35)]">
      <div className="grid divide-y divide-mk-rule lg:grid-cols-[1.12fr_0.88fr] lg:divide-x lg:divide-y-0">
        <div className="grid min-w-0 divide-y divide-mk-rule">
          <Stage step="01" label="You ask">
            <p className="font-nq-serif text-[clamp(1.45rem,2.3vw,1.85rem)] italic leading-[1.2] tracking-[-0.01em] text-mk-ink">
              &ldquo;{QUESTION}&rdquo;
            </p>
            <p className="mt-3 text-sm text-mk-ink-3">
              Asked of NatureQuery&apos;s sample store: 3,120 orders placed this year.
            </p>
          </Stage>

          <Stage step="02" label="NatureQuery writes" className="bg-mk-sunken/60">
            <pre className="overflow-x-auto font-nq-mono text-[0.7rem] leading-[1.7] sm:text-[0.8rem] text-mk-ink [font-variant-ligatures:none]">
              <code>
                {SQL.split('\n').map((line, index) => (
                  <div key={index}>
                    <SqlLine line={line} />
                  </div>
                ))}
              </code>
            </pre>
            <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 font-nq-mono text-[0.72rem] text-mk-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-mk-violet" aria-hidden />
                Read-only, checked before it runs
              </span>
            </p>
          </Stage>
        </div>

        <Stage step="03" label="You get the answer">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Top five customers by spending in 2026</caption>
            <thead>
              <tr className="mk-label">
                <th scope="col" className="pb-2 font-medium">
                  Customer
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Spent
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, index) => (
                <tr key={row.name} className="border-t border-mk-rule align-top">
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium text-mk-ink">{row.name}</span>
                    <span className="block text-xs text-mk-ink-3">{row.country}</span>
                    <span
                      aria-hidden
                      className="mt-1.5 block h-[3px] rounded-full bg-mk-violet/70"
                      style={{ width: `${Math.round((row.spent / max) * 100)}%` }}
                    />
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right font-nq-mono text-[0.8rem] tabular-nums text-mk-ink">
                    {index === 0 ? (
                      <span className="mk-highlight mk-highlight-sweep">${money(row.spent)}</span>
                    ) : (
                      `$${money(row.spent)}`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-auto pt-4 text-sm text-mk-ink-3">
            As a table, a chart, a summary or an Excel file.
          </p>
        </Stage>
      </div>
    </figure>
  )
}
