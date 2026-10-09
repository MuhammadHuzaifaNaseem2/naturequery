import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const desktopRoot = __dirname
const webSrc = path.resolve(desktopRoot, '../src')

// Components shared with the web app import these packages. Resolve every
// import to this project's single copy so React hooks and CodeMirror state
// never see two instances.
const SHARED_PACKAGES = [
  'react',
  'react-dom',
  'recharts',
  'lucide-react',
  'clsx',
  '@codemirror/autocomplete',
  '@codemirror/commands',
  '@codemirror/lang-json',
  '@codemirror/lang-sql',
  '@codemirror/language',
  '@codemirror/lint',
  '@codemirror/search',
  '@codemirror/state',
  '@codemirror/theme-one-dark',
  '@codemirror/view',
  '@lezer/common',
  '@lezer/highlight',
  '@lezer/lr',
]

export default defineConfig({
  root: path.resolve(desktopRoot, 'src/renderer'),
  base: './',
  plugins: [react()],
  css: { postcss: desktopRoot },
  resolve: {
    alias: [
      { find: /^@web\//, replacement: `${webSrc}/` },
      // Internal imports inside the shared web components.
      { find: /^@\//, replacement: `${webSrc}/` },
      { find: /^@shared\//, replacement: `${path.resolve(desktopRoot, 'src/shared')}/` },
      { find: /^@renderer\//, replacement: `${path.resolve(desktopRoot, 'src/renderer')}/` },
    ],
    dedupe: SHARED_PACKAGES,
  },
  build: {
    outDir: path.resolve(desktopRoot, 'dist/renderer'),
    emptyOutDir: true,
    target: 'chrome140',
    sourcemap: true,
    chunkSizeWarningLimit: 2500,
  },
  server: {
    port: 5183,
    strictPort: true,
    fs: { allow: [desktopRoot, webSrc] },
  },
})
