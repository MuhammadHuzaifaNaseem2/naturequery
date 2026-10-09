import { utilityProcess, type UtilityProcess } from 'electron'
import type { EngineReply, EngineRequest, EngineResultMap } from '@shared/engine-protocol'
import { fail } from '@shared/errors'
import type { Envelope } from '@shared/types'
import { engineLogger } from './logger'

type RequestOf<K extends EngineRequest['kind']> = Extract<EngineRequest, { kind: K }>

/**
 * Runs the database engine in an Electron utility process. If the engine
 * crashes, pending requests fail with a clear message and the next request
 * starts a fresh engine.
 */
export function createEngineHost(enginePath: string) {
  let child: UtilityProcess | null = null
  let nextId = 1
  let stopping = false
  const pending = new Map<
    number,
    { resolve: (envelope: Envelope<unknown>) => void; timer: NodeJS.Timeout }
  >()

  function start(): UtilityProcess {
    if (child) return child
    const proc = utilityProcess.fork(enginePath, [], {
      serviceName: 'NatureQuery Database Engine',
      stdio: 'pipe',
      // Drivers that build dates in local time (Oracle) then keep stored
      // wall-clock times exactly, with no daylight saving gaps.
      env: { ...process.env, TZ: 'UTC' },
    })
    proc.stdout?.on('data', (chunk) => engineLogger.info(String(chunk).trimEnd()))
    proc.stderr?.on('data', (chunk) => engineLogger.warn(String(chunk).trimEnd()))
    proc.on('message', (reply: EngineReply) => {
      const entry = pending.get(reply.id)
      if (!entry) return
      clearTimeout(entry.timer)
      pending.delete(reply.id)
      entry.resolve(reply.result)
    })
    proc.on('exit', (code) => {
      if (child === proc) child = null
      if (!stopping) engineLogger.error(`Database engine exited with code ${code}`)
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.resolve(
          fail({
            code: 'ENGINE_CRASHED',
            message: 'The database engine stopped unexpectedly.',
            hint: 'Try again. If it keeps happening, restart NatureQuery and send the log file to support.',
          })
        )
      }
      pending.clear()
    })
    child = proc
    return proc
  }

  function request<K extends EngineRequest['kind']>(
    message: RequestOf<K>,
    timeoutMs: number
  ): Promise<Envelope<EngineResultMap[K]>> {
    const proc = start()
    const id = nextId++
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        resolve(
          fail({
            code: 'TIMEOUT',
            message: 'The database did not respond in time.',
            hint: 'Check your network or VPN connection, then try again.',
          })
        )
      }, timeoutMs)
      pending.set(id, { resolve: resolve as (envelope: Envelope<unknown>) => void, timer })
      proc.postMessage({ id, request: message })
    })
  }

  return {
    request,
    stop() {
      stopping = true
      child?.kill()
      child = null
    },
  }
}

export type EngineHost = ReturnType<typeof createEngineHost>
