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
  'Amazon Redshift',
  'BigQuery',
  'Snowflake',
  'CockroachDB',
  'ClickHouse',
  'Neon',
  'Supabase',
  'PlanetScale',
  'MongoDB',
] as const

/** Connected only by NatureQuery Desktop. SQLite files live on the person's own computer. */
export const DESKTOP_ONLY_DATABASES = [
  'SQLite',
  'Turso',
  'DynamoDB',
  'Firestore',
  'Cassandra',
] as const
