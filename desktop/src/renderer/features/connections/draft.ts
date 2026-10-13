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
  snowflakeAuth: 'password' | 'keypair'
  privateKeyPath: string
  privateKeyPassphrase: string
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
  /** Key files already read and saved, so unchanged paths are not read again. */
  savedFiles: { serviceAccount?: string; privateKey?: string }
}

export function emptyDraft(type: DbType): ConnectionDraft {
  const info = DB_TYPE_INFO[type]
  return {
    type,
    name: '',
    // Cloud services have their own address fields; only servers default to this computer.
    host:
      !info.network || type === 'neon' || type === 'supabase' || type === 'planetscale'
        ? ''
        : 'localhost',
    port: info.defaultPort ? String(info.defaultPort) : '',
    database: '',
    user: '',
    password: '',
    // Managed cloud services always use TLS with a certificate NatureQuery can check
    // (Supabase's own authority is built in, see engine/tls.ts).
    tlsMode: ['neon', 'supabase', 'planetscale', 'redshift', 'cockroachdb'].includes(type)
      ? 'verify-full'
      : // These cannot fall back from TLS to plain, so there is no "prefer".
        type === 'mongodb' || type === 'cassandra'
        ? 'disable'
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
    snowflakeAuth: 'password',
    privateKeyPath: '',
    privateKeyPassphrase: '',
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
    savedFiles: {},
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
    snowflakeAuth: connection.snowflake?.auth ?? 'password',
    privateKeyPath: connection.snowflake?.privateKeyPath ?? '',
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
    savedFiles: {
      serviceAccount: connection.savedSecrets.includes('serviceAccountKey')
        ? (connection.bigquery?.keyFilePath ?? connection.firestore?.keyFilePath)
        : undefined,
      privateKey: connection.savedSecrets.includes('privateKey')
        ? connection.snowflake?.privateKeyPath
        : undefined,
    },
  }
}

function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url.trim()).hostname || undefined
  } catch {
    return undefined
  }
}

export function suggestName(draft: ConnectionDraft): string {
  const info = DB_TYPE_INFO[draft.type]
  if (draft.type === 'sqlite') return draft.sqlitePath.split(/[\\/]/).pop() || info.label
  let where: string | undefined
  switch (info.family) {
    case 'snowflake':
      where = optional(draft.database) ?? optional(draft.snowflakeAccount)
      break
    case 'bigquery':
    case 'firestore':
      where = optional(draft.projectId)
      break
    case 'dynamodb':
      where = optional(draft.region)
      break
    case 'libsql':
      where = hostOf(draft.tursoUrl)
      break
    case 'mongodb':
      where =
        optional(draft.database) ??
        (draft.mongoUseUri ? hostOf(draft.mongoUri) : optional(draft.host))
      break
    case 'cassandra':
      where = optional(draft.keyspace) ?? optional(draft.host)
      break
    default:
      where = optional(draft.database) ?? optional(draft.host)
  }
  return where ? `${info.label} · ${where}` : info.label
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
  if (draft.privateKeyPassphrase) secrets.privateKeyPassphrase = draft.privateKeyPassphrase
  const serviceAccountChanged =
    !!draft.keyFilePath.trim() && draft.keyFilePath.trim() !== draft.savedFiles.serviceAccount

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
        authSource: draft.mongoUseUri ? undefined : optional(draft.mongoAuthSource),
      }
      if (draft.mongoUseUri) {
        // The connection string holds the address and credentials.
        input.host = undefined
        input.port = undefined
        input.user = undefined
        input.tls = undefined
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
        auth: draft.snowflakeAuth,
        privateKeyPath:
          draft.snowflakeAuth === 'keypair' ? optional(draft.privateKeyPath) : undefined,
      }
      input.database = optional(draft.database)
      input.user = optional(draft.user)
      if (
        draft.snowflakeAuth === 'keypair' &&
        draft.privateKeyPath.trim() &&
        draft.privateKeyPath.trim() !== draft.savedFiles.privateKey
      ) {
        input.privateKeyPath = draft.privateKeyPath.trim()
      }
      break
    case 'bigquery':
      input.bigquery = {
        projectId: draft.projectId.trim(),
        location: optional(draft.location),
        keyFilePath: optional(draft.keyFilePath),
      }
      if (serviceAccountChanged) input.serviceAccountKeyPath = draft.keyFilePath.trim()
      break
    case 'firestore':
      input.firestore = {
        projectId: draft.projectId.trim(),
        keyFilePath: optional(draft.keyFilePath),
      }
      // The Firestore database ID; empty means "(default)".
      input.database = optional(draft.database)
      if (serviceAccountChanged) input.serviceAccountKeyPath = draft.keyFilePath.trim()
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
  const sshAvailable = info.network && !(family === 'mongodb' && draft.mongoUseUri)
  if (sshAvailable && draft.ssh.enabled) {
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

/** Placeholders that providers put where the password goes, e.g. [YOUR-PASSWORD] or <password>. */
const PASSWORD_PLACEHOLDER = /^[[<]\s*(?:your[-_ ]?)?password\s*[\]>]$/i

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
  const schemeType = typeByScheme[scheme]
  if (!schemeType) return null
  // A URL for the same kind of server keeps the chosen type (Neon, Supabase...) and
  // that type's defaults, such as its connection security.
  const type =
    DB_TYPE_INFO[draft.type].family === DB_TYPE_INFO[schemeType].family ? draft.type : schemeType
  const next: ConnectionDraft = {
    ...emptyDraft(type),
    id: draft.id,
    name: draft.name,
    savedSecrets: draft.savedSecrets,
  }
  next.host = decodeURIComponent(url.hostname.replace(/^\[|\]$/g, ''))
  next.port = url.port || String(DB_TYPE_INFO[type].defaultPort ?? '')
  next.user = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  // Supabase copies the string with [YOUR-PASSWORD] in place of the password.
  next.password = PASSWORD_PLACEHOLDER.test(password) ? '' : password
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
