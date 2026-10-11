/**
 * Database types people can connect on the website, in the order the product presents them.
 * Keep this in step with the connect dialog (src/components/SettingsForm.tsx): types marked
 * "soon" there are not listed here.
 */
export const WEB_DATABASES = [
  'PostgreSQL',
  'MySQL',
  'MariaDB',
  'SQL Server',
  'Oracle',
  'SQLite',
  'Amazon Redshift',
  'BigQuery',
  'Snowflake',
  'CockroachDB',
  'ClickHouse',
  'Neon',
  'PlanetScale',
  'MongoDB',
] as const

/** Connected only by NatureQuery Desktop for now. */
export const DESKTOP_ONLY_DATABASES = ['Turso', 'DynamoDB', 'Firestore', 'Cassandra'] as const
