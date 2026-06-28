'use strict'

// Local database engine for NatureQuery Desktop.
//
// This mirrors the relational drivers in the web app's src/lib/db-drivers.ts.
// It is intentionally a focused subset: the databases businesses most commonly
// run on their own PC or office network (PostgreSQL, MySQL/MariaDB, SQL Server).
// All three use pure-JavaScript packages, so the desktop app installs cleanly
// on any machine without native build tools. More databases get added the same
// way. (Long term these will be consolidated with the web app's drivers.)
//
// Every driver exposes the same shape the web app uses:
//   testConnection(), fetchSchema(), executeQuery(sql), close()

const { validateReadOnly, ensureLimit } = require('./sql-safety.cjs')

const MAX_ROWS = 1000

function isLocal(host) {
  return ['localhost', '127.0.0.1', '::1'].includes(host)
}

// Wrap a driver so every query is checked for safety (read-only) and capped
// to MAX_ROWS before it ever reaches the database. Centralised here so all
// drivers get identical protection.
function withSafety(driver, dbType) {
  const runQuery = driver.executeQuery.bind(driver)
  driver.executeQuery = async (sql) => {
    const check = validateReadOnly(sql)
    if (!check.valid) {
      throw new Error(check.error)
    }
    return runQuery(ensureLimit(sql, MAX_ROWS, dbType))
  }
  return driver
}

// Turn flat { table, column, type, nullable } rows into grouped tables.
function groupColumns(rows, tKey, cKey, typeKey, nullKey) {
  const map = new Map()
  for (const row of rows) {
    const table = row[tKey]
    if (!map.has(table)) map.set(table, { name: table, columns: [] })
    map.get(table).columns.push({
      name: row[cKey],
      type: row[typeKey],
      nullable: String(row[nullKey]).toUpperCase() !== 'NO',
    })
  }
  return Array.from(map.values())
}

// ─── PostgreSQL (also CockroachDB, Neon, Redshift) ──────────────────────
function createPostgresDriver(creds) {
  const { Pool } = require('pg')
  const pool = new Pool({
    host: creds.host,
    port: Number(creds.port) || 5432,
    database: creds.database,
    user: creds.user,
    password: creds.password,
    ssl: isLocal(creds.host) ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
  })
  return {
    async testConnection() {
      const client = await pool.connect()
      try {
        await client.query('SELECT 1')
      } finally {
        client.release()
      }
    },
    async executeQuery(sql) {
      const result = await pool.query(sql)
      const all = result.rows || []
      return {
        rows: all.slice(0, MAX_ROWS),
        fields: (result.fields || []).map((f) => f.name),
        rowCount: result.rowCount,
        truncated: all.length > MAX_ROWS,
      }
    },
    async fetchSchema() {
      const result = await pool.query(
        `SELECT table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`
      )
      return groupColumns(result.rows, 'table_name', 'column_name', 'data_type', 'is_nullable')
    },
    async close() {
      await pool.end()
    },
  }
}

// ─── MySQL / MariaDB (also PlanetScale) ─────────────────────────────────
function createMysqlDriver(creds) {
  let conn = null
  async function getConn() {
    if (!conn) {
      const mysql = require('mysql2/promise')
      conn = await mysql.createConnection({
        host: creds.host,
        port: Number(creds.port) || 3306,
        database: creds.database,
        user: creds.user,
        password: creds.password,
        connectTimeout: 10000,
        ssl: isLocal(creds.host) ? undefined : { rejectUnauthorized: false },
      })
    }
    return conn
  }
  return {
    async testConnection() {
      const c = await getConn()
      await c.query('SELECT 1')
    },
    async executeQuery(sql) {
      const c = await getConn()
      const [rows, fields] = await c.query(sql)
      const all = Array.isArray(rows) ? rows : []
      return {
        rows: all.slice(0, MAX_ROWS),
        fields: (fields || []).map((f) => f.name),
        rowCount: all.length,
        truncated: all.length > MAX_ROWS,
      }
    },
    async fetchSchema() {
      const c = await getConn()
      const [rows] = await c.query(
        `SELECT table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = ?
         ORDER BY table_name, ordinal_position`,
        [creds.database]
      )
      return groupColumns(rows, 'table_name', 'column_name', 'data_type', 'is_nullable')
    },
    async close() {
      if (conn) {
        await conn.end()
        conn = null
      }
    },
  }
}

// ─── Microsoft SQL Server ───────────────────────────────────────────────
function createSqlServerDriver(creds) {
  let pool = null
  async function getPool() {
    if (!pool) {
      const sql = require('mssql')
      pool = await new sql.ConnectionPool({
        server: creds.host,
        port: Number(creds.port) || 1433,
        database: creds.database,
        user: creds.user,
        password: creds.password,
        connectionTimeout: 10000,
        options: {
          encrypt: !isLocal(creds.host),
          trustServerCertificate: true,
        },
      }).connect()
    }
    return pool
  }
  return {
    async testConnection() {
      const p = await getPool()
      await p.request().query('SELECT 1')
    },
    async executeQuery(sql) {
      const p = await getPool()
      const result = await p.request().query(sql)
      const all = result.recordset || []
      const fields = all.length > 0 ? Object.keys(all[0]) : []
      return {
        rows: all.slice(0, MAX_ROWS),
        fields,
        rowCount: all.length,
        truncated: all.length > MAX_ROWS,
      }
    },
    async fetchSchema() {
      const p = await getPool()
      const result = await p.request().query(
        `SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name,
                DATA_TYPE as data_type, IS_NULLABLE as is_nullable
         FROM INFORMATION_SCHEMA.COLUMNS
         ORDER BY TABLE_NAME, ORDINAL_POSITION`
      )
      return groupColumns(
        result.recordset || [],
        'table_name',
        'column_name',
        'data_type',
        'is_nullable'
      )
    },
    async close() {
      if (pool) {
        await pool.close()
        pool = null
      }
    },
  }
}

// ─── Router ─────────────────────────────────────────────────────────────
function createDriver(creds) {
  const type = String(creds.dbType || 'postgresql').toLowerCase()
  let driver
  switch (type) {
    case 'mysql':
    case 'mariadb':
    case 'planetscale':
      driver = createMysqlDriver(creds)
      break
    case 'sqlserver':
    case 'mssql':
      driver = createSqlServerDriver(creds)
      break
    case 'postgresql':
    case 'postgres':
    case 'cockroachdb':
    case 'neon':
    case 'redshift':
      driver = createPostgresDriver(creds)
      break
    default:
      throw new Error(
        `Database type "${type}" is not supported in the desktop app yet.`
      )
  }
  return withSafety(driver, type)
}

module.exports = { createDriver, MAX_ROWS }
