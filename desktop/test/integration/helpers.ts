import crypto from 'node:crypto'
import { expect } from 'vitest'
import { createRegistry } from '../../src/engine/registry'
import { describeError } from '../../src/engine/errors'
import type {
  ConnectionConfig,
  ConnectionSecrets,
  ErrorCode,
  QueryResult,
} from '../../src/shared/types'

/** Shared helpers for the integration suites. Each suite gets its own engine registry. */
export function createHarness() {
  const registry = createRegistry()

  function connection(
    partial: Partial<ConnectionConfig> & Pick<ConnectionConfig, 'type'>
  ): ConnectionConfig {
    return {
      id: crypto.randomUUID(),
      name: 'integration',
      createdAt: '',
      updatedAt: '',
      ...partial,
    }
  }

  async function run(
    config: ConnectionConfig,
    secrets: ConnectionSecrets,
    text: string,
    options: Partial<{ rowLimit: number; timeoutMs: number; queryId: string }> = {}
  ): Promise<QueryResult> {
    const startedAt = Date.now()
    const result = await registry.query(config, secrets, text, {
      queryId: options.queryId ?? crypto.randomUUID(),
      rowLimit: options.rowLimit ?? 1000,
      timeoutMs: options.timeoutMs ?? 30_000,
    })
    return { ...result, rowCount: result.rows.length, durationMs: Date.now() - startedAt }
  }

  /** Expects a failure and returns the user-facing error the app would show. */
  async function failure(
    pending: Promise<unknown>,
    config: ConnectionConfig,
    phase: 'connect' | 'query' | 'schema',
    extra: { canceled?: boolean; timeoutSeconds?: number } = {}
  ) {
    try {
      await pending
    } catch (error) {
      return describeError(error, {
        type: config.type,
        host: config.host,
        port: config.port,
        database: config.database,
        phase,
        ...extra,
      })
    }
    throw new Error('Expected the operation to fail')
  }

  function expectCode(error: { code: ErrorCode }, code: ErrorCode) {
    expect(error.code, JSON.stringify(error)).toBe(code)
  }

  function tableNames(tables: { qualifiedName: string }[]) {
    return tables.map((table) => table.qualifiedName)
  }

  /** Starts a long query, cancels it after a moment and checks it stops quickly. */
  async function expectCancel(
    config: ConnectionConfig,
    secrets: ConnectionSecrets,
    longQuery: string
  ) {
    const queryId = crypto.randomUUID()
    const startedAt = Date.now()
    // Attach the failure handler right away, so the rejection is never unhandled.
    const outcome = failure(
      run(config, secrets, longQuery, { queryId, timeoutMs: 60_000 }),
      config,
      'query',
      { canceled: true }
    )
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await registry.cancel(queryId)
    const error = await outcome
    expectCode(error, 'CANCELED')
    expect(Date.now() - startedAt).toBeLessThan(10_000)
  }

  return { registry, connection, run, failure, expectCode, tableNames, expectCancel }
}

/** SSH jump host from docker-compose.yml, used to reach databases by service name. */
export const SSH_TUNNEL = {
  enabled: true,
  host: '127.0.0.1',
  port: 52222,
  user: 'tunnel',
  auth: 'password' as const,
}
export const SSH_SECRETS = { sshPassword: 'tunnel_pw' }
