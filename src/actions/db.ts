'use server'

import { createDriver, type DatabaseType } from '@/lib/db-drivers'

export interface DBCredentials {
  host: string
  port: number
  database: string
  user: string
  password: string
  dbType?: DatabaseType
}

export interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

export interface TableSchema {
  tableName: string
  columns: ColumnDefinition[]
}

export interface DatabaseSchema {
  tables: TableSchema[]
}

export interface FetchSchemaResult {
  success: boolean
  data?: DatabaseSchema
  error?: string
}

export interface TestConnectionResult {
  success: boolean
  message?: string
  error?: string
}

export interface QueryResultRow {
  [key: string]: unknown
}

export interface ExecuteSQLResult {
  success: boolean
  data?: {
    rows: QueryResultRow[]
    fields: string[]
    rowCount: number
    executionTime: number
  }
  error?: string
}

/**
 * Test database connection with provided credentials
 */
export async function testConnection(
  credentials: DBCredentials
): Promise<TestConnectionResult> {
  const driver = createDriver(credentials, credentials.dbType)

  try {
    await driver.testConnection()
    await driver.close()
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    await driver.close().catch(() => {})
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

/**
 * Fetch database schema (tables and columns) using provided credentials
 */
export async function fetchSchema(
  credentials: DBCredentials
): Promise<FetchSchemaResult> {
  const driver = createDriver(credentials, credentials.dbType)

  try {
    const tables = await driver.fetchSchema()
    await driver.close()
    return { success: true, data: { tables } }
  } catch (error) {
    await driver.close().catch(() => {})
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch schema',
    }
  }
}

/**
 * Execute a SQL query and return results as an array of objects
 */
export async function executeSQL(
  credentials: DBCredentials,
  sql: string
): Promise<ExecuteSQLResult> {
  const driver = createDriver(credentials, credentials.dbType)
  const startTime = Date.now()

  try {
    const result = await driver.executeQuery(sql)
    const executionTime = Date.now() - startTime
    await driver.close()

    return {
      success: true,
      data: {
        rows: result.rows,
        fields: result.fields,
        rowCount: result.rowCount,
        executionTime,
      },
    }
  } catch (error) {
    await driver.close().catch(() => {})
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed',
    }
  }
}
