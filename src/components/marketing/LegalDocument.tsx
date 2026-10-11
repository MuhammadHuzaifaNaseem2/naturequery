import { MarketingShell } from './MarketingShell'

export interface LegalSection {
  number: string
  title: string
  content?: string
  subsections?: { title: string; content: string }[]
  list?: (string | { label: string; detail: string })[]
  bullets?: string[]
}

/** A legal page (privacy policy, terms): numbered sections with an index beside them. */
export function LegalDocument({
  current,
  label,
  title,
  intro,
  updated,
  sections,
}: {
  current: string
  label: string
  title: string
  intro: string
  updated: string
  sections: LegalSection[]
}) {
  return (
    <MarketingShell current={current}>
      <section className="mx-auto max-w-[1200px] px-5 pt-14 sm:px-8 sm:pt-24">
        <p className="mk-label">{label}</p>
        <h1 className="mt-5 max-w-4xl text-balance font-nq-serif text-[clamp(2.6rem,5.8vw,4.6rem)] font-normal leading-[1.02] tracking-[-0.03em] text-mk-ink">
          {title}
        </h1>
        <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-mk-ink-2">{intro}</p>
        <p className="mt-6 font-nq-mono text-[0.75rem] uppercase tracking-[0.06em] text-mk-ink-3">
          Last updated {updated}
        </p>
      </section>

      <div className="mx-auto mt-14 grid max-w-[1200px] gap-12 px-5 pb-24 sm:mt-20 sm:px-8 sm:pb-32 lg:grid-cols-[15rem_1fr] lg:gap-16">
        <nav aria-label="Sections" className="hidden lg:block">
          <ol className="sticky top-28 space-y-2.5 border-l border-mk-rule pl-5">
            {sections.map((section) => (
              <li key={section.number}>
                <a
                  href={`#section-${section.number}`}
                  className="group flex gap-3 text-sm leading-snug text-mk-ink-2 hover:text-mk-ink"
                >
                  <span className="font-nq-mono text-[0.72rem] leading-5 text-mk-ink-3 group-hover:text-mk-violet">
                    {section.number}
                  </span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 max-w-[46rem] border-t border-mk-ink/80">
          {sections.map((section) => (
            <section
              key={section.number}
              id={`section-${section.number}`}
              className="scroll-mt-24 border-b border-mk-rule py-10"
            >
              <h2 className="flex items-baseline gap-4 font-nq-serif text-[1.75rem] leading-tight tracking-[-0.015em] text-mk-ink">
                <span className="font-nq-mono text-[0.8rem] tracking-normal text-mk-violet">
                  {section.number}
                </span>
                {section.title}
              </h2>
              <div className="mt-5 space-y-4 text-[1.0625rem] leading-relaxed text-mk-ink-2">
                {section.content && <p>{section.content}</p>}

                {section.subsections?.map((sub) => (
                  <div key={sub.title}>
                    <h3 className="font-semibold text-mk-ink">{sub.title}</h3>
                    <p className="mt-1.5">{sub.content}</p>
                  </div>
                ))}

                {section.list && (
                  <ul className="space-y-2.5">
                    {section.list.map((item) =>
                      typeof item === 'string' ? (
                        <li key={item} className="flex gap-3">
                          <span
                            aria-hidden
                            className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-mk-violet"
                          />
                          {item}
                        </li>
                      ) : (
                        <li
                          key={item.label}
                          className="grid gap-1 border-t border-mk-rule pt-3 sm:grid-cols-[12rem_1fr] sm:gap-6"
                        >
                          <span className="font-medium text-mk-ink">{item.label}</span>
                          <span>{item.detail}</span>
                        </li>
                      )
                    )}
                  </ul>
                )}

                {section.bullets && (
                  <ul className="space-y-2.5">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span
                          aria-hidden
                          className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-mk-violet"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}

          <div className="mt-12 rounded-xl border border-mk-rule bg-mk-surface p-7">
            <h2 className="font-nq-serif text-[1.6rem] leading-tight text-mk-ink">
              Questions about this page?
            </h2>
            <p className="mt-2 leading-relaxed text-mk-ink-2">
              Write to us and a person will answer, including requests about your data.
            </p>
            <a href="mailto:hello@naturequery.app" className="mk-link mt-4 inline-flex">
              hello@naturequery.app
            </a>
          </div>
        </div>
      </div>
    </MarketingShell>
  )
}
