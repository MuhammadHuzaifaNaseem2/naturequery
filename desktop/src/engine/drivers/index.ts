import { NqError } from '@shared/errors'
import { DB_TYPE_INFO, type DriverFamily } from '@shared/db-types'
import type { ConnectionConfig } from '@shared/types'
import { createBigQueryDriver } from './bigquery'
import { createCassandraDriver } from './cassandra'
import { createClickHouseDriver } from './clickhouse'
import { createDynamoDbDriver } from './dynamodb'
import { createFirestoreDriver } from './firestore'
import { createLibsqlDriver } from './libsql'
import { createMongoDriver } from './mongodb'
import { createMysqlDriver } from './mysql'
import { createOracleDriver } from './oracle'
import { createPostgresDriver } from './postgres'
import { createSnowflakeDriver } from './snowflake'
import { createSqliteDriver } from './sqlite'
import { createSqlServerDriver } from './sqlserver'
import type { DriverFactory } from './types'

const FACTORIES: Partial<Record<DriverFamily, DriverFactory>> = {
  postgres: createPostgresDriver,
  mysql: createMysqlDriver,
  sqlserver: createSqlServerDriver,
  oracle: createOracleDriver,
  sqlite: createSqliteDriver,
  mongodb: createMongoDriver,
  clickhouse: createClickHouseDriver,
  snowflake: createSnowflakeDriver,
  bigquery: createBigQueryDriver,
  dynamodb: createDynamoDbDriver,
  firestore: createFirestoreDriver,
  cassandra: createCassandraDriver,
  libsql: createLibsqlDriver,
}

export function driverFactoryFor(config: ConnectionConfig): DriverFactory {
  const info = DB_TYPE_INFO[config.type]
  const factory = FACTORIES[info.family]
  if (!factory) {
    throw new NqError(
      'UNSUPPORTED',
      `${info.label} connections are not available in this version yet.`,
      {
        hint: 'Update NatureQuery Desktop to the latest version.',
      }
    )
  }
  return factory
}

export function supportedFamilies(): DriverFamily[] {
  return Object.keys(FACTORIES) as DriverFamily[]
}
