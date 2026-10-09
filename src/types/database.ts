// Database schema and result shapes shared by the web app and NatureQuery Desktop.
// Keep this file free of runtime imports so client bundles never pull in server code.

export interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

export interface ForeignKey {
  column: string
  referencedTable: string
  referencedColumn: string
}

export interface TableSchema {
  tableName: string
  columns: ColumnDefinition[]
  foreignKeys?: ForeignKey[]
}

export interface DatabaseSchema {
  tables: TableSchema[]
}

export interface QueryResultRow {
  [key: string]: unknown
}
