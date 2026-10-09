// Database engine utility process. Runs every driver outside the main
// process, so a slow or crashing database client cannot freeze the window.
import { fail, ok } from '@shared/errors'
import type { EngineMessage, EngineReply, EngineRequest } from '@shared/engine-protocol'
import type { ConnectionConfig, Envelope } from '@shared/types'
import { describeError } from './errors'
import { createRegistry } from './registry'

const registry = createRegistry()
const started = Date.now()
const canceled = new Set<string>()

async function handle(request: EngineRequest): Promise<Envelope<unknown>> {
  switch (request.kind) {
    case 'ping':
      return ok({ pid: process.pid, uptimeMs: Date.now() - started })

    case 'test': {
      const startedAt = Date.now()
      try {
        const result = await registry.test(request.config, request.secrets)
        return ok({ ok: true, latencyMs: Date.now() - startedAt, ...result })
      } catch (error) {
        return fail(describeError(error, { ...contextOf(request.config), phase: 'connect' }))
      }
    }

    case 'schema':
      try {
        const result = await registry.schema(request.config, request.secrets)
        return ok({ ...result, fetchedAt: new Date().toISOString() })
      } catch (error) {
        return fail(describeError(error, { ...contextOf(request.config), phase: 'schema' }))
      }

    case 'query': {
      const startedAt = Date.now()
      try {
        const result = await registry.query(request.config, request.secrets, request.text, {
          queryId: request.queryId,
          rowLimit: request.rowLimit,
          timeoutMs: request.timeoutMs,
        })
        return ok({ ...result, rowCount: result.rows.length, durationMs: Date.now() - startedAt })
      } catch (error) {
        return fail(
          describeError(error, {
            ...contextOf(request.config),
            phase: 'query',
            canceled: canceled.has(request.queryId),
            timeoutSeconds: Math.round(request.timeoutMs / 1000),
          })
        )
      } finally {
        canceled.delete(request.queryId)
      }
    }

    case 'cancel':
      canceled.add(request.queryId)
      try {
        await registry.cancel(request.queryId)
      } catch {
        // Nothing left to cancel; the query may have just finished.
      }
      return ok(undefined)

    case 'release':
      await registry.release(request.connectionId)
      return ok(undefined)
  }
}

function contextOf(config: ConnectionConfig) {
  return { type: config.type, host: config.host, port: config.port, database: config.database }
}

process.parentPort.on('message', async (event) => {
  const message = event.data as EngineMessage
  let result: Envelope<unknown>
  try {
    result = await handle(message.request)
  } catch (error) {
    result = fail({
      code: 'UNKNOWN',
      message: 'The database engine hit an unexpected error.',
      detail: String(error),
    })
  }
  const reply: EngineReply = { id: message.id, result }
  process.parentPort.postMessage(reply)
})

process.on('uncaughtException', (error) => {
  console.error('[engine] uncaught exception', error)
})
process.on('unhandledRejection', (error) => {
  console.error('[engine] unhandled rejection', error)
})

async function shutdown() {
  await registry.closeAll()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
