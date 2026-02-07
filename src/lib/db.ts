import { Pool, PoolConfig } from 'pg'
import { DatabaseConnection, QueryResult } from './types'

/**
 * Create a PostgreSQL connection pool
 */
export function createPool(config: DatabaseConnection): Pool {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }

  return new Pool(poolConfig)
}

/**
 * Test database connection
 */
export async function testConnection(pool: Pool): Promise<boolean> {
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

/**
 * Execute SQL query and return results
 */
export async function executeQuery(
  pool: Pool,
  sql: string
): Promise<QueryResult> {
  const startTime = Date.now()
  
  try {
    const result = await pool.query(sql)
    const executionTime = Date.now() - startTime

    return {
      rows: result.rows,
      fields: result.fields,
      rowCount: result.rowCount || 0,
      executionTime,
    }
  } catch (error) {
    console.error('Query execution failed:', error)
    throw error
  }
}

/**
 * Get database schema information
 */
export async function getDatabaseSchema(pool: Pool): Promise<any> {
  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `
  
  const result = await pool.query(query)
  
  // Group by table
  const schema: Record<string, any[]> = {}
  for (const row of result.rows) {
    if (!schema[row.table_name]) {
      schema[row.table_name] = []
    }
    schema[row.table_name].push({
      column: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
    })
  }
  
  return schema
}
