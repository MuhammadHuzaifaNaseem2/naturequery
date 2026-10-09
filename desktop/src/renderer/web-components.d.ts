// Components shared with the web app (../src/components). Vite resolves the
// real files; these declarations keep the desktop type-check independent of
// the web app's build configuration. Keep the props in sync with the web
// sources when they change.

declare module '@web/components/ResultsTable' {
  import type { ComponentType } from 'react'
  const ResultsTable: ComponentType<{
    rows: Record<string, unknown>[]
    fields: string[]
    rowCount: number
    executionTime: number
  }>
  export default ResultsTable
}

declare module '@web/components/ResultsChart' {
  import type { ComponentType } from 'react'
  export const ResultsChart: ComponentType<{
    rows: Record<string, unknown>[]
    fields: string[]
    compact?: boolean
    height?: number | string
    recommendation?: {
      type: 'bar' | 'line' | 'pie' | 'area' | 'scatter'
      xAxis: string
      yAxis: string[]
      title: string
      description?: string
    }
  }>
}

declare module '@web/components/SQLEditor' {
  import type { ComponentType } from 'react'
  export const SQLEditor: ComponentType<{
    value: string
    onChange: (value: string) => void
    onExecute?: () => void
    schema?: {
      tables: {
        tableName: string
        columns: {
          name: string
          type: string
          nullable: boolean
          defaultValue: string | null
          isPrimaryKey: boolean
        }[]
      }[]
    }
    dbType?: string
    isDark?: boolean
    placeholder?: string
    readOnly?: boolean
    height?: string
    className?: string
  }>
}
