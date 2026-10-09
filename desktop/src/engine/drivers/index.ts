import { NqError } from '@shared/errors'
import { DB_TYPE_INFO, type DriverFamily } from '@shared/db-types'
import type { ConnectionConfig } from '@shared/types'
import type { DriverFactory } from './types'

/**
 * Drivers load on first use, so the engine starts quickly and only pulls in
 * the database libraries (some of them large cloud SDKs) a person needs.
 */
const LOADERS: Partial<Record<DriverFamily, () => Promise<DriverFactory>>> = {
  postgres: () => import('./postgres').then((m) => m.createPostgresDriver),
  mysql: () => import('./mysql').then((m) => m.createMysqlDriver),
  sqlserver: () => import('./sqlserver').then((m) => m.createSqlServerDriver),
  oracle: () => import('./oracle').then((m) => m.createOracleDriver),
  sqlite: () => import('./sqlite').then((m) => m.createSqliteDriver),
  mongodb: () => import('./mongodb').then((m) => m.createMongoDriver),
  clickhouse: () => import('./clickhouse').then((m) => m.createClickHouseDriver),
  snowflake: () => import('./snowflake').then((m) => m.createSnowflakeDriver),
  bigquery: () => import('./bigquery').then((m) => m.createBigQueryDriver),
  dynamodb: () => import('./dynamodb').then((m) => m.createDynamoDbDriver),
  firestore: () => import('./firestore').then((m) => m.createFirestoreDriver),
  cassandra: () => import('./cassandra').then((m) => m.createCassandraDriver),
  libsql: () => import('./libsql').then((m) => m.createLibsqlDriver),
}

export async function driverFactoryFor(config: ConnectionConfig): Promise<DriverFactory> {
  const info = DB_TYPE_INFO[config.type]
  const load = LOADERS[info.family]
  if (!load) {
    throw new NqError(
      'UNSUPPORTED',
      `${info.label} connections are not available in this version yet.`,
      {
        hint: 'Update NatureQuery Desktop to the latest version.',
      }
    )
  }
  return load()
}

export function supportedFamilies(): DriverFamily[] {
  return Object.keys(LOADERS) as DriverFamily[]
}
