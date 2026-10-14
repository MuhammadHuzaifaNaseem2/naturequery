import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = "NatureQuery: your database speaks SQL. You don't have to."
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// The public site's identity (the .mk tokens in globals.css), as hex for the image
// renderer: violet ink on violet-tinted paper, marigold marking the answer.
const PAPER = '#F6F5FA'
const INK = '#151127'
const INK_2 = '#504C61'
const RULE = '#D9D7E5'
const VIOLET = '#5336D3'
const MARIGOLD_SOFT = '#FDE7AF'

// The site's three typefaces as TrueType files (the renderer cannot read WOFF2);
// licenses in ../fonts. Read at build time, when this image is generated.
const asset = (...path: string[]) => readFile(join(process.cwd(), ...path))

export default async function Image() {
  const [serif, serifItalic, mono, sans, sansSemibold, logo] = await Promise.all([
    asset('src/app/fonts/og/newsreader-400.ttf'),
    asset('src/app/fonts/og/newsreader-400-italic.ttf'),
    asset('src/app/fonts/og/ibm-plex-mono-500.ttf'),
    asset('src/app/fonts/og/schibsted-grotesk-400.ttf'),
    asset('src/app/fonts/og/schibsted-grotesk-600.ttf'),
    asset('public/naturequery-icon.svg'),
  ])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px 80px 54px',
        background: PAPER,
        color: INK,
        fontFamily: 'Schibsted Grotesk',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG, not a page */}
        <img
          src={`data:image/svg+xml;base64,${logo.toString('base64')}`}
          alt=""
          width={52}
          height={52}
        />
        <span style={{ marginLeft: 16, fontSize: 34, fontWeight: 600, letterSpacing: '-0.01em' }}>
          NatureQuery
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Newsreader',
          fontSize: 92,
          lineHeight: 1.04,
          letterSpacing: '-0.03em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span>Your database speaks</span>
          {/* The renderer lines the two fonts up by their boxes; lift the mono word
              onto the serif baseline, as the browser does on the home page. */}
          <span
            style={{
              position: 'relative',
              top: -17,
              marginLeft: 22,
              fontFamily: 'IBM Plex Mono',
              fontSize: 74,
              color: VIOLET,
              letterSpacing: '-0.05em',
            }}
          >
            SQL
          </span>
          <span>.</span>
        </div>
        <div style={{ display: 'flex', fontStyle: 'italic', color: INK_2 }}>
          You don&rsquo;t have to.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 26,
          borderTop: `2px solid ${RULE}`,
          fontSize: 27,
          color: INK_2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>Ask in plain English. Get read-only SQL and</span>
          <span
            style={{
              marginLeft: 9,
              padding: '1px 9px',
              borderRadius: 4,
              background: MARIGOLD_SOFT,
              color: INK,
            }}
          >
            the answer.
          </span>
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 25, color: VIOLET }}>
          naturequery.app
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Newsreader', data: serif, weight: 400, style: 'normal' },
        { name: 'Newsreader', data: serifItalic, weight: 400, style: 'italic' },
        { name: 'IBM Plex Mono', data: mono, weight: 500, style: 'normal' },
        { name: 'Schibsted Grotesk', data: sans, weight: 400, style: 'normal' },
        { name: 'Schibsted Grotesk', data: sansSemibold, weight: 600, style: 'normal' },
      ],
    }
  )
}
