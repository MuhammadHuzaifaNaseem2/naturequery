import { format, type SqlLanguage } from 'sql-formatter'
import { DB_TYPE_INFO, type DbType } from '@shared/db-types'
import type { TableInfo } from '@shared/types'

/** Query that previews the first rows of a table in the right dialect. */
export function previewQuery(type: DbType, table: TableInfo, limit = 100): string {
  const dialect = DB_TYPE_INFO[type].dialect
  switch (dialect) {
    case 'sqlserver':
      return `SELECT TOP ${limit} *\nFROM ${table.qualifiedName};`
    case 'oracle':
      return `SELECT *\nFROM ${table.qualifiedName}\nFETCH FIRST ${limit} ROWS ONLY`
    case 'mongodb':
      return JSON.stringify({ collection: table.name, pipeline: [{ $limit: limit }] }, null, 2)
    case 'firestore':
      return JSON.stringify({ collection: table.name, limit }, null, 2)
    case 'partiql':
      return `SELECT *\nFROM ${table.qualifiedName}`
    default:
      return `SELECT *\nFROM ${table.qualifiedName}\nLIMIT ${limit};`
  }
}

const FORMATTER_LANGUAGE: Partial<Record<DbType, SqlLanguage>> = {
  postgresql: 'postgresql',
  cockroachdb: 'postgresql',
  neon: 'postgresql',
  redshift: 'redshift',
  mysql: 'mysql',
  planetscale: 'mysql',
  mariadb: 'mariadb',
  sqlserver: 'transactsql',
  oracle: 'plsql',
  sqlite: 'sqlite',
  turso: 'sqlite',
  snowflake: 'snowflake',
  bigquery: 'bigquery',
}

/** Formats SQL for readability. Returns the input unchanged if it cannot be parsed. */
export function formatSql(type: DbType, sql: string): string {
  const dialect = DB_TYPE_INFO[type].dialect
  if (dialect === 'mongodb' || dialect === 'firestore') {
    try {
      return JSON.stringify(JSON.parse(sql), null, 2)
    } catch {
      return sql
    }
  }
  try {
    return format(sql, {
      language: FORMATTER_LANGUAGE[type] ?? 'sql',
      keywordCase: 'upper',
      tabWidth: 2,
      linesBetweenQueries: 1,
    })
  } catch {
    return sql
  }
}

/** Editor highlighting mode understood by the shared SQL editor. */
export function editorMode(type: DbType): string {
  switch (DB_TYPE_INFO[type].family) {
    case 'mysql':
      return 'mysql'
    case 'sqlite':
    case 'libsql':
      return 'sqlite'
    case 'sqlserver':
      return 'sqlserver'
    default:
      return 'postgresql'
  }
}
