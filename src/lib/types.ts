export interface DatabaseConnection {
  id: string
  name: string
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
  status?: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface QueryResult {
  rows: any[]
  fields: Array<{
    name: string
    dataTypeID: number
  }>
  rowCount: number
  executionTime: number
}

export interface NLToSQLRequest {
  naturalLanguage: string
  connectionId: string
  context?: string
}

export interface NLToSQLResponse {
  sql: string
  explanation: string
  confidence: number
}
