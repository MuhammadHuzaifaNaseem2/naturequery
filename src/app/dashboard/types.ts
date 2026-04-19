import { DatabaseSchema, QueryResultRow } from '@/actions/db'

export interface SavedConnection {
  id: string
  name: string
  host: string
  port: number
  database: string
  user: string
  dbType: string
  isActive: boolean
  schema?: DatabaseSchema
  status: 'active' | 'inactive'
  isDemo?: boolean
  teamId?: string | null
  teamName?: string
}

export interface ChartRecommendation {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter'
  xAxis: string
  yAxis: string[]
  title: string
  description?: string
}

export interface QueryResults {
  rows: QueryResultRow[]
  fields: string[]
  rowCount: number
  executionTime: number
  truncated?: boolean
  chartRecommendation?: ChartRecommendation
}
