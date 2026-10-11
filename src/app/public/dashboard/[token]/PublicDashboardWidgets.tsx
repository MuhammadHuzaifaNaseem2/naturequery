'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ResultsChart } from '@/components/ResultsChart'
import type { ChartSnapshot } from '@/lib/chart-snapshot'

interface PublicWidget {
  id: string
  title: string
  question: string
  position: number
  chart: ChartSnapshot | null
  chartAt: string | null
}

interface PublicDashboardWidgetsProps {
  widgets: PublicWidget[]
  chartsShared: boolean
}

export function PublicDashboardWidgets({ widgets, chartsShared }: PublicDashboardWidgetsProps) {
  const latest = chartsShared
    ? widgets.reduce<string | null>(
        (max, widget) => (widget.chartAt && (!max || widget.chartAt > max) ? widget.chartAt : max),
        null
      )
    : null

  // Shown in the reader's own time zone, so it is formatted once the page is in the browser.
  const [latestText, setLatestText] = useState<string | null>(null)
  useEffect(() => {
    if (!latest) return
    setLatestText(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(latest)
      )
    )
  }, [latest])

  return (
    <div>
      {latest && (
        <p className="mb-4 font-nq-mono text-[0.72rem] uppercase tracking-[0.08em] text-mk-ink-3">
          Numbers from <time dateTime={latest}>{latestText ?? latest.slice(0, 10)}</time>
        </p>
      )}
      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-mk-rule bg-mk-rule md:grid-cols-2">
        {widgets.map((widget, index) => (
          <li
            key={widget.id}
            className={clsx(
              'flex min-w-0 flex-col bg-mk-surface p-6',
              // An odd last card takes the whole row instead of leaving a gap beside it.
              index === widgets.length - 1 && widgets.length % 2 === 1 && 'md:col-span-2'
            )}
          >
            <p className="mk-label">
              <span className="text-mk-violet">{String(index + 1).padStart(2, '0')}</span>{' '}
              {widget.title}
            </p>
            {widget.question && (
              <p className="mt-3 font-nq-serif text-[1.35rem] italic leading-snug text-mk-ink">
                &ldquo;{widget.question}&rdquo;
              </p>
            )}
            {chartsShared &&
              (widget.chart ? (
                <div className="mt-5 min-w-0">
                  <ResultsChart
                    rows={widget.chart.rows}
                    fields={widget.chart.fields}
                    compact
                    height={220}
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-mk-ink-3">
                  The numbers for this question have not been shared yet.
                </p>
              ))}
          </li>
        ))}
      </ol>
    </div>
  )
}
