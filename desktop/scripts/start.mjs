// Run the production build (dist/) without packaging it.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { desktopRoot } from './electron-targets.mjs'
import { electronEnv } from './launch-env.mjs'

if (!fs.existsSync(path.join(desktopRoot, 'dist/main/index.cjs'))) {
  console.error('No build found. Run "npm run build" first.')
  process.exit(1)
}
const electronPath = createRequire(import.meta.url)('electron')
const child = spawn(electronPath, [desktopRoot, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: electronEnv(),
})
child.on('exit', (code) => process.exit(code ?? 0))
