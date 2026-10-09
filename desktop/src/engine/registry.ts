import crypto from 'node:crypto'
import { NqError } from '@shared/errors'
import { DB_TYPE_INFO } from '@shared/db-types'
import type { ConnectionConfig, ConnectionSecrets } from '@shared/types'
import { driverFactoryFor } from './drivers'
import type { Driver } from './drivers/types'
import { openTunnel, type Tunnel } from './ssh'

const IDLE_CLOSE_MS = 5 * 60_000
const CONNECT_TIMEOUT_MS = 20_000

interface Entry {
  fingerprint: string
  driver: Driver
  tunnel?: Tunnel
  lastUsed: number
  busy: number
}

/** Settings that affect how to connect; renaming a connection keeps its pool. */
function fingerprint(config: ConnectionConfig, secrets: ConnectionSecrets): string {
  const {
    name: _name,
    color: _color,
    createdAt: _c,
    updatedAt: _u,
    lastUsedAt: _l,
    ...relevant
  } = config
  return crypto.createHash('sha256').update(JSON.stringify({ relevant, secrets })).digest('hex')
}

async function openDriver(
  config: ConnectionConfig,
  secrets: ConnectionSecrets
): Promise<{ driver: Driver; tunnel?: Tunnel }> {
  const factory = await driverFactoryFor(config)
  let tunnel: Tunnel | undefined
  if (config.ssh?.enabled) {
    if (!DB_TYPE_INFO[config.type].network) {
      throw new NqError(
        'VALIDATION',
        `SSH tunnels are not available for ${DB_TYPE_INFO[config.type].label}.`
      )
    }
    tunnel = await openTunnel(config, secrets, CONNECT_TIMEOUT_MS)
  }
  try {
    const driver = factory(config, secrets, {
      endpoint: tunnel
        ? { host: '127.0.0.1', port: tunnel.localPort, servername: config.host }
        : undefined,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
    })
    return { driver, tunnel }
  } catch (error) {
    await tunnel?.close()
    throw error
  }
}

/** Keeps one driver (connection pool) per saved connection and reuses it. */
export function createRegistry() {
  const entries = new Map<string, Entry>()
  const queries = new Map<string, Driver>()

  async function close(entry: Entry) {
    await entry.driver.close().catch(() => {})
    await entry.tunnel?.close().catch(() => {})
  }

  async function acquire(config: ConnectionConfig, secrets: ConnectionSecrets): Promise<Entry> {
    const print = fingerprint(config, secrets)
    const existing = entries.get(config.id)
    if (existing && existing.fingerprint === print) {
      existing.lastUsed = Date.now()
      return existing
    }
    if (existing) {
      entries.delete(config.id)
      void close(existing)
    }
    const { driver, tunnel } = await openDriver(config, secrets)
    const entry: Entry = { fingerprint: print, driver, tunnel, lastUsed: Date.now(), busy: 0 }
    entries.set(config.id, entry)
    return entry
  }

  async function use<T>(
    config: ConnectionConfig,
    secrets: ConnectionSecrets,
    work: (driver: Driver) => Promise<T>
  ): Promise<T> {
    const entry = await acquire(config, secrets)
    entry.busy++
    try {
      return await work(entry.driver)
    } finally {
      entry.busy--
      entry.lastUsed = Date.now()
    }
  }

  const reaper = setInterval(() => {
    const now = Date.now()
    for (const [id, entry] of entries) {
      if (entry.busy === 0 && now - entry.lastUsed > IDLE_CLOSE_MS) {
        entries.delete(id)
        void close(entry)
      }
    }
  }, 60_000)
  reaper.unref()

  return {
    /** Tests with a fresh, short-lived driver so stale pools never mask problems. */
    async test(config: ConnectionConfig, secrets: ConnectionSecrets) {
      const { driver, tunnel } = await openDriver(config, secrets)
      try {
        return { ...(await driver.test()), sshHostKey: tunnel?.hostKey }
      } finally {
        await driver.close().catch(() => {})
        await tunnel?.close().catch(() => {})
      }
    },

    schema(config: ConnectionConfig, secrets: ConnectionSecrets) {
      return use(config, secrets, (driver) => driver.schema())
    },

    query(
      config: ConnectionConfig,
      secrets: ConnectionSecrets,
      text: string,
      options: { queryId: string; rowLimit: number; timeoutMs: number }
    ) {
      return use(config, secrets, async (driver) => {
        queries.set(options.queryId, driver)
        try {
          return await driver.query(text, options)
        } finally {
          queries.delete(options.queryId)
        }
      })
    },

    async cancel(queryId: string) {
      await queries.get(queryId)?.cancel(queryId)
    },

    async release(connectionId: string) {
      const entry = entries.get(connectionId)
      if (!entry) return
      entries.delete(connectionId)
      await close(entry)
    },

    async closeAll() {
      clearInterval(reaper)
      const all = [...entries.values()]
      entries.clear()
      await Promise.all(all.map(close))
    },
  }
}

export type Registry = ReturnType<typeof createRegistry>
