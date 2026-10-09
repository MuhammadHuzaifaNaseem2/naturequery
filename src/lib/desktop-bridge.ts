import type { DatabaseSchema } from '@/actions/db'
import type { QueryResults, SavedConnection } from '@/app/dashboard/types'

export const DESKTOP_CONNECTION_PREFIX = 'desktop:'

function bridge() {
  if (typeof window === 'undefined' || window.naturequery?.isDesktop !== true) return null
  return window.naturequery.localdb
}

export function isNatureQueryDesktop(): boolean {
  return bridge() !== null
}

export async function openDesktopConnectionManager(): Promise<void> {
  const localdb = bridge()
  if (!localdb) throw new Error('Desktop database bridge is unavailable')
  const result = await localdb.openManager()
  if (!result.ok) throw new Error(result.error || 'Failed to open local database manager')
}

export function isDesktopConnectionId(id: string): boolean {
  return id.startsWith(DESKTOP_CONNECTION_PREFIX)
}

function rawDesktopConnectionId(id: string): string {
  if (!isDesktopConnectionId(id)) throw new Error('Invalid desktop connection id')
  return id.slice(DESKTOP_CONNECTION_PREFIX.length)
}

export async function listDesktopConnections(): Promise<SavedConnection[]> {
  const localdb = bridge()
  if (!localdb) return []

  const connections = await localdb.list()
  return connections.map((connection) => ({
    ...connection,
    id: `${DESKTOP_CONNECTION_PREFIX}${connection.id}`,
    source: 'desktop' as const,
    isActive: true,
    status: 'active' as const,
    teamName: 'On this computer',
  }))
}

export async function fetchDesktopSchema(connectionId: string): Promise<{
  success: boolean
  data?: DatabaseSchema
  error?: string
}> {
  const localdb = bridge()
  if (!localdb) return { success: false, error: 'Desktop database bridge is unavailable' }

  const result = await localdb.schema(rawDesktopConnectionId(connectionId))
  if (!result.ok || !result.schema) {
    return { success: false, error: result.error || 'Failed to load local schema' }
  }

  return {
    success: true,
    data: {
      tables: result.schema.map((table) => ({
        tableName: table.name,
        columns: table.columns.map((column) => ({
          ...column,
          defaultValue: null,
          isPrimaryKey: false,
        })),
      })),
    },
  }
}

export async function executeDesktopSQL(
  connectionId: string,
  sql: string
): Promise<{ success: boolean; data?: QueryResults; error?: string }> {
  const localdb = bridge()
  if (!localdb) return { success: false, error: 'Desktop database bridge is unavailable' }

  const startedAt = performance.now()
  const result = await localdb.query(rawDesktopConnectionId(connectionId), sql)
  if (!result.ok || !result.rows || !result.fields) {
    return { success: false, error: result.error || 'Failed to execute local query' }
  }

  return {
    success: true,
    data: {
      rows: result.rows,
      fields: result.fields,
      rowCount: result.rowCount ?? result.rows.length,
      truncated: result.truncated,
      executionTime: Math.round(performance.now() - startedAt),
    },
  }
}

export async function removeDesktopConnection(
  connectionId: string
): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  const localdb = bridge()
  if (!localdb) return { success: false, error: 'Desktop database bridge is unavailable' }

  const result = await localdb.remove(rawDesktopConnectionId(connectionId))
  if (result.canceled) return { success: false, canceled: true }
  return result.ok ? { success: true } : { success: false, error: result.error }
}
