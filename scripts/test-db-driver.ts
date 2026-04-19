/**
 * Validates a single database driver end-to-end:
 *   1. Connect
 *   2. Fetch schema
 *   3. Run "SELECT 1" (or equivalent)
 *   4. Run LIMIT-wrapped query
 *   5. Close
 *
 * Usage:
 *   npx tsx scripts/test-db-driver.ts <type> <host> <port> <db> <user> <pass> [--ssl]
 *
 * Example:
 *   npx tsx scripts/test-db-driver.ts mariadb localhost 3307 testdb testuser testpass
 *   npx tsx scripts/test-db-driver.ts mongodb localhost 27017 testdb testuser testpass
 */
import { createDriver, type DatabaseType, type DBCredentials } from '../src/lib/db-drivers'

function parseArgs() {
  const argv = process.argv.slice(2)
  if (argv.length < 6) {
    console.error('Usage: test-db-driver <type> <host> <port> <db> <user> <pass> [--ssl]')
    process.exit(1)
  }
  const [type, host, portStr, database, user, password] = argv
  const ssl = argv.includes('--ssl')
  return {
    type: type as DatabaseType,
    host,
    port: parseInt(portStr, 10),
    database,
    user,
    password,
    ssl,
  } satisfies DBCredentials & { type: DatabaseType }
}

function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  return fn().then(
    (res) => {
      console.log(`  ✓ ${label} (${Date.now() - start}ms)`)
      return res
    },
    (err) => {
      console.log(`  ✗ ${label} (${Date.now() - start}ms) — ${err.message}`)
      throw err
    }
  )
}

async function main() {
  const { type, ...creds } = parseArgs()
  console.log(`\n=== Testing ${type} driver ===`)
  console.log(
    `  ${creds.user}@${creds.host}:${creds.port}/${creds.database}${creds.ssl ? ' (ssl)' : ''}`
  )

  const driver = createDriver(creds as DBCredentials, type)
  let passed = 0
  let failed = 0

  try {
    // 1. Schema
    try {
      const schema = await time('fetchSchema', () => driver.fetchSchema())
      const tableCount = schema.tables?.length ?? 0
      console.log(`    → ${tableCount} table(s) found`)
      passed++
    } catch {
      failed++
    }

    // 2. SELECT 1 (adapted per DB)
    try {
      const testQuery = pickTestQuery(type)
      const res = await time(`executeQuery: ${testQuery}`, () => driver.executeQuery(testQuery))
      console.log(`    → returned ${res.rowCount} row(s)`)
      passed++
    } catch {
      failed++
    }

    // 3. LIMIT safety — use a system table that always exists
    try {
      const limitQuery = pickLimitQuery(type)
      if (limitQuery) {
        const res = await time(`executeQuery with LIMIT: ${limitQuery}`, () =>
          driver.executeQuery(limitQuery)
        )
        console.log(`    → returned ${res.rowCount} row(s), truncated=${res.truncated ?? false}`)
        passed++
      }
    } catch {
      failed++
    }
  } finally {
    try {
      await driver.close?.()
      console.log('  ✓ close')
    } catch (err) {
      console.log(`  ⚠ close failed: ${(err as Error).message}`)
    }
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

function pickTestQuery(type: DatabaseType): string {
  switch (type) {
    case 'oracle':
      return 'SELECT 1 FROM DUAL'
    case 'mongodb':
      // Mongo driver expects a JSON string describing the op
      return JSON.stringify({ collection: '__none__', operation: 'find', filter: {}, limit: 1 })
    default:
      return 'SELECT 1'
  }
}

function pickLimitQuery(type: DatabaseType): string | null {
  switch (type) {
    case 'postgresql':
    case 'redshift':
    case 'cockroachdb':
    case 'neon':
      return 'SELECT schemaname, tablename FROM pg_tables LIMIT 5'
    case 'mysql':
    case 'mariadb':
    case 'planetscale':
      return 'SELECT table_schema, table_name FROM information_schema.tables LIMIT 5'
    case 'sqlserver':
      return 'SELECT TOP 5 TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES'
    case 'sqlite':
      return "SELECT name FROM sqlite_master WHERE type='table' LIMIT 5"
    case 'oracle':
      return 'SELECT table_name FROM user_tables WHERE ROWNUM <= 5'
    case 'clickhouse':
      return 'SELECT database, name FROM system.tables LIMIT 5'
    case 'snowflake':
      return 'SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES LIMIT 5'
    case 'bigquery':
      return null // needs dataset context, skip
    case 'mongodb':
      return null // already tested above
    default:
      return null
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
