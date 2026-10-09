import { DB_TYPE_INFO, type DbType } from '@shared/db-types'
import type {
  ConnectionInfo,
  ConnectionInput,
  SecretKey,
  SqlServerSettings,
  SshSettings,
  TlsMode,
} from '@shared/types'

/** Flat, form-friendly model of a connection being created or edited. */
export interface ConnectionDraft {
  id?: string
  type: DbType
  name: string
  host: string
  port: string
  database: string
  user: string
  password: string
  tlsMode: TlsMode
  caPath: string
  sqlserver: SqlServerSettings
  oracleConnectAs: 'service' | 'sid'
  sqlitePath: string
  mongoUseUri: boolean
  mongoUri: string
  mongoAuthSource: string
  clickhouseProtocol: 'http' | 'https'
  snowflakeAccount: string
  snowflakeWarehouse: string
  snowflakeRole: string
  snowflakeSchema: string
  projectId: string
  location: string
  keyFilePath: string
  region: string
  endpoint: string
  secretAccessKey: string
  datacenter: string
  keyspace: string
  tursoUrl: string
  authToken: string
  ssh: SshSettings
  sshPassword: string
  sshKeyPath: string
  sshPassphrase: string
  savedSecrets: SecretKey[]
}

export function emptyDraft(type: DbType): ConnectionDraft {
  const info = DB_TYPE_INFO[type]
  return {
    type,
    name: '',
    host: type === 'neon' || type === 'planetscale' ? '' : 'localhost',
    port: info.defaultPort ? String(info.defaultPort) : '',
    database: '',
    user: '',
    password: '',
    // Managed cloud services always use TLS with a public certificate.
    tlsMode: ['neon', 'planetscale', 'redshift', 'cockroachdb'].includes(type)
      ? 'verify-full'
      : 'prefer',
    caPath: '',
    sqlserver: { auth: 'sql', encrypt: true, trustServerCertificate: true },
    oracleConnectAs: 'service',
    sqlitePath: '',
    mongoUseUri: false,
    mongoUri: '',
    mongoAuthSource: '',
    clickhouseProtocol: 'http',
    snowflakeAccount: '',
    snowflakeWarehouse: '',
    snowflakeRole: '',
    snowflakeSchema: '',
    projectId: '',
    location: '',
    keyFilePath: '',
    region: '',
    endpoint: '',
    secretAccessKey: '',
    datacenter: 'datacenter1',
    keyspace: '',
    tursoUrl: '',
    authToken: '',
    ssh: { enabled: false, host: '', port: 22, user: '', auth: 'password' },
    sshPassword: '',
    sshKeyPath: '',
    sshPassphrase: '',
    savedSecrets: [],
  }
}

export function draftFromConnection(connection: ConnectionInfo): ConnectionDraft {
  const draft = emptyDraft(connection.type)
  return {
    ...draft,
    id: connection.id,
    name: connection.name,
    host: connection.host ?? '',
    port: connection.port ? String(connection.port) : draft.port,
    database: connection.database ?? '',
    user: connection.user ?? '',
    tlsMode: connection.tls?.mode ?? draft.tlsMode,
    caPath: connection.tls?.caPath ?? '',
    sqlserver: connection.sqlserver ?? draft.sqlserver,
    oracleConnectAs: connection.oracle?.connectAs ?? 'service',
    sqlitePath: connection.sqlite?.path ?? '',
    mongoUseUri: connection.mongodb?.useConnectionString ?? false,
    mongoAuthSource: connection.mongodb?.authSource ?? '',
    clickhouseProtocol: connection.clickhouse?.protocol ?? 'http',
    snowflakeAccount: connection.snowflake?.account ?? '',
    snowflakeWarehouse: connection.snowflake?.warehouse ?? '',
    snowflakeRole: connection.snowflake?.role ?? '',
    snowflakeSchema: connection.snowflake?.schema ?? '',
    projectId: connection.bigquery?.projectId ?? connection.firestore?.projectId ?? '',
    location: connection.bigquery?.location ?? '',
    keyFilePath: connection.bigquery?.keyFilePath ?? connection.firestore?.keyFilePath ?? '',
    region: connection.dynamodb?.region ?? '',
    endpoint: connection.dynamodb?.endpoint ?? '',
    datacenter: connection.cassandra?.datacenter ?? draft.datacenter,
    keyspace: connection.cassandra?.keyspace ?? '',
    tursoUrl: connection.turso?.url ?? '',
    ssh: connection.ssh ?? draft.ssh,
    sshKeyPath: connection.ssh?.privateKeyPath ?? '',
    savedSecrets: connection.savedSecrets,
  }
}

function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function suggestName(draft: ConnectionDraft): string {
  const label = DB_TYPE_INFO[draft.type].label
  if (draft.type === 'sqlite') return draft.sqlitePath.split(/[\\/]/).pop() || label
  const where =
    optional(draft.database) ??
    optional(draft.host) ??
    optional(draft.projectId) ??
    optional(draft.snowflakeAccount)
  return where ? `${label} · ${where}` : label
}

/** Builds the save/test request. Empty secret fields keep saved values. */
export function draftToInput(draft: ConnectionDraft): ConnectionInput {
  const info = DB_TYPE_INFO[draft.type]
  const secrets: ConnectionInput['secrets'] = {}
  if (draft.password) secrets.password = draft.password
  if (draft.mongoUri) secrets.connectionString = draft.mongoUri
  if (draft.sshPassword) secrets.sshPassword = draft.sshPassword
  if (draft.sshPassphrase) secrets.sshPassphrase = draft.sshPassphrase
  if (draft.secretAccessKey) secrets.secretAccessKey = draft.secretAccessKey
  if (draft.authToken) secrets.authToken = draft.authToken

  const input: ConnectionInput = {
    id: draft.id,
    name: draft.name.trim() || suggestName(draft),
    type: draft.type,
    secrets,
  }
  const family = info.family
  if (info.network) {
    input.host = optional(draft.host)
    input.port = draft.port.trim() ? Number(draft.port) : info.defaultPort
    input.database = optional(draft.database)
    input.user = optional(draft.user)
  }
  if (info.supportsTls && family !== 'sqlserver') {
    input.tls = {
      mode: draft.tlsMode,
      caPath: draft.tlsMode.startsWith('verify') ? optional(draft.caPath) : undefined,
    }
  }
  switch (family) {
    case 'sqlserver':
      input.sqlserver = {
        ...draft.sqlserver,
        instance: optional(draft.sqlserver.instance ?? ''),
        domain: optional(draft.sqlserver.domain ?? ''),
      }
      break
    case 'oracle':
      input.oracle = { connectAs: draft.oracleConnectAs }
      break
    case 'sqlite':
      input.sqlite = { path: draft.sqlitePath.trim() }
      break
    case 'mongodb':
      input.mongodb = {
        useConnectionString: draft.mongoUseUri,
        authSource: optional(draft.mongoAuthSource),
      }
      break
    case 'clickhouse':
      input.clickhouse = { protocol: draft.clickhouseProtocol }
      break
    case 'snowflake':
      input.snowflake = {
        account: draft.snowflakeAccount.trim(),
        warehouse: optional(draft.snowflakeWarehouse),
        role: optional(draft.snowflakeRole),
        schema: optional(draft.snowflakeSchema),
      }
      input.database = optional(draft.database)
      input.user = optional(draft.user)
      break
    case 'bigquery':
      input.bigquery = {
        projectId: draft.projectId.trim(),
        location: optional(draft.location),
        keyFilePath: optional(draft.keyFilePath),
      }
      if (draft.keyFilePath && !draft.savedSecrets.includes('serviceAccountKey'))
        input.serviceAccountKeyPath = draft.keyFilePath
      break
    case 'firestore':
      input.firestore = {
        projectId: draft.projectId.trim(),
        keyFilePath: optional(draft.keyFilePath),
      }
      if (draft.keyFilePath && !draft.savedSecrets.includes('serviceAccountKey'))
        input.serviceAccountKeyPath = draft.keyFilePath
      break
    case 'dynamodb':
      input.dynamodb = { region: draft.region.trim(), endpoint: optional(draft.endpoint) }
      input.user = optional(draft.user)
      break
    case 'cassandra':
      input.cassandra = { datacenter: draft.datacenter.trim(), keyspace: optional(draft.keyspace) }
      break
    case 'libsql':
      input.turso = { url: draft.tursoUrl.trim() }
      break
  }
  if (info.network && draft.ssh.enabled) {
    input.ssh = { ...draft.ssh, port: Number(draft.ssh.port) || 22 }
    // Re-read the key file when it changed or no key is saved yet.
    const keyChanged =
      draft.sshKeyPath !== draft.ssh.privateKeyPath || !draft.savedSecrets.includes('sshPrivateKey')
    if (draft.ssh.auth === 'key' && draft.sshKeyPath && keyChanged)
      input.sshPrivateKeyPath = draft.sshKeyPath
  } else if (info.network) {
    input.ssh = { ...draft.ssh, enabled: false }
  }
  return input
}

/**
 * Fills a draft from a pasted URL such as
 * postgres://user:pass@db.example.com:5432/sales?sslmode=require
 */
export function applyConnectionUrl(draft: ConnectionDraft, raw: string): ConnectionDraft | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  const typeByScheme: Record<string, DbType> = {
    postgres: 'postgresql',
    postgresql: 'postgresql',
    mysql: 'mysql',
    mariadb: 'mariadb',
    sqlserver: 'sqlserver',
    mssql: 'sqlserver',
  }
  const type = typeByScheme[scheme]
  if (!type) return null
  const next: ConnectionDraft = {
    ...emptyDraft(type),
    id: draft.id,
    name: draft.name,
    savedSecrets: draft.savedSecrets,
  }
  if (DB_TYPE_INFO[draft.type].family === DB_TYPE_INFO[type].family) next.type = draft.type
  next.host = decodeURIComponent(url.hostname.replace(/^\[|\]$/g, ''))
  next.port = url.port || String(DB_TYPE_INFO[type].defaultPort ?? '')
  next.user = decodeURIComponent(url.username)
  next.password = decodeURIComponent(url.password)
  next.database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  const ssl = (
    url.searchParams.get('sslmode') ??
    url.searchParams.get('ssl-mode') ??
    ''
  ).toLowerCase()
  const tlsByParam: Record<string, TlsMode> = {
    disable: 'disable',
    disabled: 'disable',
    prefer: 'prefer',
    preferred: 'prefer',
    require: 'require',
    required: 'require',
    'verify-ca': 'verify-ca',
    verify_ca: 'verify-ca',
    'verify-full': 'verify-full',
    verify_identity: 'verify-full',
  }
  if (tlsByParam[ssl]) next.tlsMode = tlsByParam[ssl]
  return next
}
