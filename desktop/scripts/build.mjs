// Production build: Electron bundles with esbuild, renderer with Vite.
import { build } from 'esbuild'
import { build as viteBuild } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { desktopRoot, electronTargets } from './electron-targets.mjs'

const started = Date.now()
fs.rmSync(path.join(desktopRoot, 'dist'), { recursive: true, force: true })

for (const target of electronTargets({ production: true })) await build(target)
await viteBuild({ configFile: path.join(desktopRoot, 'vite.config.ts'), logLevel: 'warn' })

const sample = path.join(desktopRoot, 'resources/sample/acme-store.db')
if (!fs.existsSync(sample)) {
  console.error('Missing sample database. Run "npm run sample-db" first.')
  process.exit(1)
}
console.log(`Built NatureQuery Desktop in ${((Date.now() - started) / 1000).toFixed(1)}s`)
