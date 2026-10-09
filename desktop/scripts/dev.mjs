// Development: Vite dev server for the renderer, esbuild watch for Electron
// code, and an Electron process that restarts when main or engine code changes.
import { context } from 'esbuild'
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { desktopRoot, electronTargets } from './electron-targets.mjs'
import { electronEnv } from './launch-env.mjs'

const electronPath = createRequire(import.meta.url)('electron')
const server = await createServer({ configFile: path.join(desktopRoot, 'vite.config.ts') })
await server.listen()
const devUrl = server.resolvedUrls.local[0]

let electron = null
let restarting = false
function startElectron() {
  electron = spawn(electronPath, [desktopRoot, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: electronEnv({ NQ_DEV_SERVER_URL: devUrl }),
  })
  electron.on('exit', () => {
    if (!restarting) shutdown()
  })
}
function restartElectron() {
  if (!electron) return startElectron()
  restarting = true
  electron.once('exit', () => {
    restarting = false
    startElectron()
  })
  electron.kill()
}

const restartOnRebuild = {
  name: 'restart-electron',
  setup(build) {
    let first = true
    build.onEnd((result) => {
      if (result.errors.length) return
      if (first) {
        first = false
        return
      }
      console.log('[dev] Electron code changed, restarting the app')
      restartElectron()
    })
  },
}

const contexts = await Promise.all(
  electronTargets({ production: false }).map((target) =>
    context({ ...target, plugins: [restartOnRebuild] })
  )
)
await Promise.all(contexts.map((ctx) => ctx.rebuild()))
await Promise.all(contexts.map((ctx) => ctx.watch()))
startElectron()

async function shutdown() {
  await Promise.all(contexts.map((ctx) => ctx.dispose()))
  await server.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
