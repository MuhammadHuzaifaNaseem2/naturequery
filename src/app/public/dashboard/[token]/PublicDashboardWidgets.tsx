'use client'

interface PublicWidget {
  id: string
  title: string
  question: string
  position: number
}

interface PublicDashboardWidgetsProps {
  widgets: PublicWidget[]
}

export function PublicDashboardWidgets({ widgets }: PublicDashboardWidgetsProps) {
  return (
    <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-mk-rule bg-mk-rule md:grid-cols-2">
      {widgets.map((widget, index) => (
        <li key={widget.id} className="flex flex-col bg-mk-surface p-6">
          <p className="mk-label">
            <span className="text-mk-violet">{String(index + 1).padStart(2, '0')}</span>{' '}
            {widget.title}
          </p>
          <p className="mt-3 font-nq-serif text-[1.35rem] italic leading-snug text-mk-ink">
            &ldquo;{widget.question}&rdquo;
          </p>
        </li>
      ))}
    </ol>
  )
}
