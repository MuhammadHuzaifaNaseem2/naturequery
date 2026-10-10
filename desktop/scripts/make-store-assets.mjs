// Runs scripts/store-assets.cjs in Electron, which makes the Microsoft Store
// tile images in build/appx/ from build/icon.png.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { desktopRoot } from './electron-targets.mjs'
import { electronEnv } from './launch-env.mjs'

const electronPath = createRequire(import.meta.url)('electron')
const result = spawnSync(electronPath, [path.join(desktopRoot, 'scripts', 'store-assets.cjs')], {
  stdio: 'inherit',
  env: electronEnv(),
})
process.exit(result.status ?? 1)
