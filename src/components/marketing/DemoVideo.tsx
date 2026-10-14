'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'

// The demo on the NatureQuery YouTube channel, October 2026, 1:00 (the 1:22 one from
// May 2026, 0h5kmva3wq0, is unlisted). Shows the website, then the Windows app.
const VIDEO_ID = 'uzhjKArD4c4'
const VIDEO_TITLE = 'NatureQuery: Ask your database in plain English'

// What the video walks through, drawn like the logo: nodes joined by a line.
const STEPS = ['You ask', 'NatureQuery writes', 'The answer']

/**
 * A poster in the site's own style; YouTube's player loads only after the visitor
 * clicks play, through youtube-nocookie.com, so the page stays fast and no YouTube
 * cookies are set until then.
 */
export function DemoVideo() {
  const [playing, setPlaying] = useState(false)

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-mk-rule bg-mk-band shadow-[0_30px_60px_-38px_hsl(var(--mk-ink)/0.45)]"
      style={{ aspectRatio: '16 / 9' }}
    >
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
          title={VIDEO_TITLE}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play the NatureQuery demo video, 1 minute"
          className="group absolute inset-0 grid grid-rows-[auto_1fr] p-5 text-left text-mk-band-ink sm:p-10 lg:p-14"
        >
          <span className="flex w-full items-center justify-between font-nq-mono text-[0.7rem] uppercase tracking-[0.08em] text-mk-band-ink-2">
            <span>NatureQuery demo</span>
            <span className="tabular-nums">1:00</span>
          </span>

          <span className="grid items-center gap-10 md:grid-cols-[1.25fr_0.75fr]">
            {/* The title and the play button */}
            <span className="flex flex-col items-start gap-6 sm:gap-9">
              <span className="hidden max-w-xl text-balance font-nq-serif text-[clamp(1.6rem,3.4vw,3rem)] italic leading-[1.08] tracking-[-0.015em] sm:block">
                &ldquo;Ask your database in plain English.&rdquo;
              </span>
              <span className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mk-band-ink text-mk-band transition-colors group-hover:bg-mk-signal group-focus-visible:bg-mk-signal sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Play className="ml-1 h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden />
                </span>
                <span className="text-[0.9375rem] font-medium">Play the demo</span>
              </span>
            </span>

            {/* The three steps the video shows */}
            <span className="relative hidden flex-col gap-8 md:flex" aria-hidden>
              <span className="absolute bottom-2 left-[7px] top-2 w-px bg-mk-band-rule" />
              {STEPS.map((step, index) => {
                const answer = index === STEPS.length - 1
                return (
                  <span key={step} className="relative flex items-center gap-4 pl-9">
                    <span
                      className={
                        answer
                          ? 'absolute left-0 h-[15px] w-[15px] rounded-full bg-mk-signal'
                          : 'absolute left-0 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-mk-band-ink-2/70 bg-mk-band'
                      }
                    >
                      {!answer && <span className="h-[5px] w-[5px] rounded-full bg-mk-band-ink" />}
                    </span>
                    <span className="font-nq-mono text-[0.72rem] uppercase tracking-[0.08em] text-mk-band-ink-2">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[0.9375rem] text-mk-band-ink">{step}</span>
                  </span>
                )
              })}
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
