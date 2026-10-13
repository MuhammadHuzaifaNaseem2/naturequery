// Supported database types and the metadata the UI and engine share.

export const DB_TYPES = [
  'postgresql',
  'mysql',
  'mariadb',
  'sqlserver',
  'oracle',
  'sqlite',
  'mongodb',
  'clickhouse',
  'snowflake',
  'bigquery',
  'redshift',
  'cockroachdb',
  'neon',
  'supabase',
  'planetscale',
  'turso',
  'dynamodb',
  'firestore',
  'cassandra',
] as const

export type DbType = (typeof DB_TYPES)[number]

/** Query language family, used for validation, editor mode and AI prompts. */
export type Dialect =
  | 'postgresql'
  | 'mysql'
  | 'sqlserver'
  | 'oracle'
  | 'sqlite'
  | 'clickhouse'
  | 'snowflake'
  | 'bigquery'
  | 'cql'
  | 'partiql'
  | 'mongodb'
  | 'firestore'

export type DriverFamily =
  | 'postgres'
  | 'mysql'
  | 'sqlserver'
  | 'oracle'
  | 'sqlite'
  | 'mongodb'
  | 'clickhouse'
  | 'snowflake'
  | 'bigquery'
  | 'dynamodb'
  | 'firestore'
  | 'cassandra'
  | 'libsql'

export type DbCategory = 'relational' | 'warehouse' | 'document' | 'file' | 'serverless'

export interface DbTypeInfo {
  type: DbType
  label: string
  family: DriverFamily
  dialect: Dialect
  category: DbCategory
  defaultPort?: number
  /** Connects over TCP to a host, so SSH tunnels and TLS settings apply. */
  network: boolean
  supportsTls: boolean
  description: string
  /** Short label shown on connection badges. */
  badge: string
}

export const DB_TYPE_INFO: Record<DbType, DbTypeInfo> = {
  postgresql: {
    type: 'postgresql',
    label: 'PostgreSQL',
    family: 'postgres',
    dialect: 'postgresql',
    category: 'relational',
    defaultPort: 5432,
    network: true,
    supportsTls: true,
    description: 'PostgreSQL 10 or later, including Amazon RDS, Azure and Google Cloud SQL.',
    badge: 'PG',
  },
  mysql: {
    type: 'mysql',
    label: 'MySQL',
    family: 'mysql',
    dialect: 'mysql',
    category: 'relational',
    defaultPort: 3306,
    network: true,
    supportsTls: true,
    description: 'MySQL 5.7 or later, including Amazon RDS and Azure Database for MySQL.',
    badge: 'MY',
  },
  mariadb: {
    type: 'mariadb',
    label: 'MariaDB',
    family: 'mysql',
    dialect: 'mysql',
    category: 'relational',
    defaultPort: 3306,
    network: true,
    supportsTls: true,
    description: 'MariaDB 10.3 or later.',
    badge: 'MA',
  },
  sqlserver: {
    type: 'sqlserver',
    label: 'SQL Server',
    family: 'sqlserver',
    dialect: 'sqlserver',
    category: 'relational',
    defaultPort: 1433,
    network: true,
    supportsTls: true,
    description: 'Microsoft SQL Server 2012 or later, SQL Server Express and Azure SQL.',
    badge: 'MS',
  },
  oracle: {
    type: 'oracle',
    label: 'Oracle',
    family: 'oracle',
    dialect: 'oracle',
    category: 'relational',
    defaultPort: 1521,
    network: true,
    supportsTls: false,
    description: 'Oracle Database 12.1 or later. No Oracle Client installation needed.',
    badge: 'OR',
  },
  sqlite: {
    type: 'sqlite',
    label: 'SQLite',
    family: 'sqlite',
    dialect: 'sqlite',
    category: 'file',
    network: false,
    supportsTls: false,
    description: 'A SQLite database file on this computer or a shared drive. Opened read-only.',
    badge: 'SQ',
  },
  mongodb: {
    type: 'mongodb',
    label: 'MongoDB',
    family: 'mongodb',
    dialect: 'mongodb',
    category: 'document',
    defaultPort: 27017,
    network: true,
    supportsTls: true,
    description: 'MongoDB 4.4 or later, including MongoDB Atlas.',
    badge: 'MG',
  },
  clickhouse: {
    type: 'clickhouse',
    label: 'ClickHouse',
    family: 'clickhouse',
    dialect: 'clickhouse',
    category: 'warehouse',
    defaultPort: 8123,
    network: true,
    supportsTls: true,
    description: 'ClickHouse over HTTP or HTTPS, including ClickHouse Cloud.',
    badge: 'CH',
  },
  snowflake: {
    type: 'snowflake',
    label: 'Snowflake',
    family: 'snowflake',
    dialect: 'snowflake',
    category: 'warehouse',
    network: false,
    supportsTls: false,
    description: 'Snowflake data warehouse.',
    badge: 'SF',
  },
  bigquery: {
    type: 'bigquery',
    label: 'BigQuery',
    family: 'bigquery',
    dialect: 'bigquery',
    category: 'warehouse',
    network: false,
    supportsTls: false,
    description: 'Google BigQuery with a service account key.',
    badge: 'BQ',
  },
  redshift: {
    type: 'redshift',
    label: 'Amazon Redshift',
    family: 'postgres',
    dialect: 'postgresql',
    category: 'warehouse',
    defaultPort: 5439,
    network: true,
    supportsTls: true,
    description: 'Amazon Redshift clusters and Redshift Serverless.',
    badge: 'RS',
  },
  cockroachdb: {
    type: 'cockroachdb',
    label: 'CockroachDB',
    family: 'postgres',
    dialect: 'postgresql',
    category: 'relational',
    defaultPort: 26257,
    network: true,
    supportsTls: true,
    description: 'CockroachDB self-hosted or CockroachDB Cloud.',
    badge: 'CR',
  },
  neon: {
    type: 'neon',
    label: 'Neon',
    family: 'postgres',
    dialect: 'postgresql',
    category: 'serverless',
    defaultPort: 5432,
    network: true,
    supportsTls: true,
    description: 'Neon serverless PostgreSQL.',
    badge: 'NE',
  },
  supabase: {
    type: 'supabase',
    label: 'Supabase',
    family: 'postgres',
    dialect: 'postgresql',
    category: 'serverless',
    defaultPort: 5432,
    network: true,
    supportsTls: true,
    description: 'The PostgreSQL database of a Supabase project.',
    badge: 'SB',
  },
  planetscale: {
    type: 'planetscale',
    label: 'PlanetScale',
    family: 'mysql',
    dialect: 'mysql',
    category: 'serverless',
    defaultPort: 3306,
    network: true,
    supportsTls: true,
    description: 'PlanetScale MySQL-compatible databases.',
    badge: 'PS',
  },
  turso: {
    type: 'turso',
    label: 'Turso',
    family: 'libsql',
    dialect: 'sqlite',
    category: 'serverless',
    network: false,
    supportsTls: false,
    description: 'Turso and other libSQL servers.',
    badge: 'TU',
  },
  dynamodb: {
    type: 'dynamodb',
    label: 'Amazon DynamoDB',
    family: 'dynamodb',
    dialect: 'partiql',
    category: 'document',
    network: false,
    supportsTls: false,
    description: 'DynamoDB tables queried with PartiQL.',
    badge: 'DY',
  },
  firestore: {
    type: 'firestore',
    label: 'Cloud Firestore',
    family: 'firestore',
    dialect: 'firestore',
    category: 'document',
    network: false,
    supportsTls: false,
    description: 'Google Cloud Firestore with a service account key.',
    badge: 'FS',
  },
  cassandra: {
    type: 'cassandra',
    label: 'Apache Cassandra',
    family: 'cassandra',
    dialect: 'cql',
    category: 'document',
    defaultPort: 9042,
    network: true,
    supportsTls: true,
    description: 'Apache Cassandra and ScyllaDB.',
    badge: 'CA',
  },
}

/** Driver families included in this build. */
export const AVAILABLE_FAMILIES: DriverFamily[] = [
  'postgres',
  'mysql',
  'sqlserver',
  'oracle',
  'sqlite',
  'mongodb',
  'clickhouse',
  'snowflake',
  'bigquery',
  'dynamodb',
  'firestore',
  'cassandra',
  'libsql',
]

export function isAvailable(type: DbType): boolean {
  return AVAILABLE_FAMILIES.includes(DB_TYPE_INFO[type].family)
}

export function isDbType(value: unknown): value is DbType {
  return typeof value === 'string' && (DB_TYPES as readonly string[]).includes(value)
}

/** True for engines queried with SQL text, as opposed to JSON query specs. */
export function usesSql(type: DbType): boolean {
  const dialect = DB_TYPE_INFO[type].dialect
  return dialect !== 'mongodb' && dialect !== 'firestore'
}
