import { NqError } from '@shared/errors'
import { DB_TYPE_INFO, type DriverFamily } from '@shared/db-types'
import type { ConnectionConfig } from '@shared/types'
import { createPostgresDriver } from './postgres'
import { createMysqlDriver } from './mysql'
import { createSqlServerDriver } from './sqlserver'
import { createSqliteDriver } from './sqlite'
import type { DriverFactory } from './types'

const FACTORIES: Partial<Record<DriverFamily, DriverFactory>> = {
  postgres: createPostgresDriver,
  mysql: createMysqlDriver,
  sqlserver: createSqlServerDriver,
  sqlite: createSqliteDriver,
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
