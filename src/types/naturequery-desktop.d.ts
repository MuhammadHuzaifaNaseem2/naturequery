import type { QueryResultRow } from '@/actions/db'

interface DesktopConnectionMetadata {
  id: string
  name: string
  dbType: string
  host: string
  port: number
  database: string
  user: string
}

interface DesktopSchemaColumn {
  name: string
  type: string
  nullable: boolean
}

interface DesktopSchemaTable {
  name: string
  columns: DesktopSchemaColumn[]
}

interface DesktopResult<T extends object = object> {
  ok: boolean
  error?: string
  value?: T
}

interface NatureQueryDesktopBridge {
  isDesktop: true
  platform: string
  localdb: {
    openManager: () => Promise<{ ok: boolean; error?: string }>
    list: () => Promise<DesktopConnectionMetadata[]>
    remove: (id: string) => Promise<{ ok: boolean; canceled?: boolean; error?: string }>
    test: (id: string) => Promise<{ ok: boolean; error?: string }>
    schema: (id: string) => Promise<{ ok: boolean; schema?: DesktopSchemaTable[]; error?: string }>
    query: (
      id: string,
      sql: string
    ) => Promise<{
      ok: boolean
      rows?: QueryResultRow[]
      fields?: string[]
      rowCount?: number
      truncated?: boolean
      error?: string
    }>
  }
}

declare global {
  interface Window {
    naturequery?: NatureQueryDesktopBridge
  }
}

export {}
