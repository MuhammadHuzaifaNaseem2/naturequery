import localFont from 'next/font/local'

/**
 * The public site's three voices, served from this site (the files and their
 * SIL Open Font License notices are in ./fonts): Newsreader for what people
 * ask, IBM Plex Mono for what the database speaks, Schibsted Grotesk for the
 * interface. Only pages that use them load them.
 */
const serif = localFont({
  src: [
    { path: './fonts/newsreader.woff2', weight: '200 800', style: 'normal' },
    { path: './fonts/newsreader-italic.woff2', weight: '200 800', style: 'italic' },
  ],
  variable: '--font-serif',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
})

const mono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'Cascadia Code', 'monospace'],
})

const sans = localFont({
  src: [{ path: './fonts/schibsted-grotesk.woff2', weight: '400 900', style: 'normal' }],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
})

/** Classes that define the brand font variables on an element. */
export const brandFonts = `${serif.variable} ${mono.variable} ${sans.variable}`
