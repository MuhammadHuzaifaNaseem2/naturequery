import { DBCredentials, DatabaseSchema, QueryResultRow } from '@/actions/db'

export interface SavedConnection {
  id: string
  name: string
  credentials: DBCredentials
  schema?: DatabaseSchema
  status: 'active' | 'inactive'
  isDemo?: boolean
}

export interface QueryResults {
  rows: QueryResultRow[]
  fields: string[]
  rowCount: number
  executionTime: number
}
