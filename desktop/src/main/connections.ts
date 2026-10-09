import fs from 'node:fs'
import crypto from 'node:crypto'
import { DB_TYPE_INFO, isDbType, type DbType } from '@shared/db-types'
import { NqError } from '@shared/errors'
import {
  SECRET_KEYS,
  type ConnectionConfig,
  type ConnectionInfo,
  type ConnectionSecrets,
  type SecretKey,
} from '@shared/types'
import { readJsonFile, writeJsonFile } from './json-file'
import type { SealedSecret, SecretBox } from './secure-store'
import type { ValidConnectionInput } from './validation'

interface StoredConnection extends ConnectionConfig {
  secrets?: Partial<Record<SecretKey, SealedSecret>>
}

interface ConnectionsFile {
  version: 1
  connections: StoredConnection[]
}

/** Shape written by desktop releases 0.1 to 0.2. */
interface LegacyRecord {
  id: string
  name?: string
  dbType: string
  host: string
  port: number | string
  database: string
  user: string
  tls?: 'auto' | 'verify'
  password?: SealedSecret
}

const MAX_KEY_FILE_BYTES = 64 * 1024
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isLoopbackHost(host: string | undefined): boolean {
  return !!host && LOOPBACK.has(host.trim().toLowerCase())
}

export interface ConnectionStoreOptions {
  file: string
  legacyFile?: string
  box: SecretBox
  readKeyFile?: (path: string) => string
  now?: () => Date
}

export function createConnectionStore(options: ConnectionStoreOptions) {
  const { file, box } = options
  const now = options.now ?? (() => new Date())
  const readKeyFile =
    options.readKeyFile ??
    ((path: string) => {
      const stat = fs.statSync(path)
      if (stat.size > MAX_KEY_FILE_BYTES) {
        throw new NqError('VALIDATION', 'That file is too large to be a key or certificate.')
      }
      return fs.readFileSync(path, 'utf8')
    })

  function load(): ConnectionsFile {
    const data = readJsonFile<ConnectionsFile>(file, { version: 1, connections: [] }, 'connections')
    if (!data || data.version !== 1 || !Array.isArray(data.connections)) {
      throw new NqError('UNKNOWN', 'Your connections file is from an unknown version.', {
        hint: 'Update NatureQuery Desktop to the latest version.',
      })
    }
    return data
  }

  function persist(data: ConnectionsFile): void {
    writeJsonFile(file, data)
  }

  function toInfo(stored: StoredConnection): ConnectionInfo {
    const { secrets, ...config } = stored
    return {
      ...config,
      savedSecrets: SECRET_KEYS.filter((key) => !!secrets?.[key]),
    }
  }

  function find(data: ConnectionsFile, id: string): StoredConnection {
    const stored = data.connections.find((connection) => connection.id === id)
    if (!stored) {
      throw new NqError('NOT_FOUND', 'This connection no longer exists.', {
        hint: 'It may have been removed in another window. Choose another connection.',
      })
    }
    return stored
  }

  function openSecrets(stored: StoredConnection): ConnectionSecrets {
    const result: ConnectionSecrets = {}
    for (const key of SECRET_KEYS) {
      const sealed = stored.secrets?.[key]
      if (sealed) result[key] = box.open(sealed)
    }
    return result
  }

  /** Builds the stored record and the plain secrets used to test or save. */
  function prepare(
    input: ValidConnectionInput,
    existing: StoredConnection | undefined
  ): { config: ConnectionConfig; secrets: ConnectionSecrets } {
    const timestamp = now().toISOString()
    const {
      secrets: incoming = {},
      clearSecrets = [],
      sshPrivateKeyPath,
      serviceAccountKeyPath,
      privateKeyPath,
      id,
      ...fields
    } = input

    const secrets: ConnectionSecrets = existing ? openSecrets(existing) : {}
    for (const key of clearSecrets) delete secrets[key]
    for (const key of SECRET_KEYS) {
      const value = incoming[key]
      if (value !== undefined && value !== '') secrets[key] = value
    }

    const config: ConnectionConfig = {
      ...stripEmptySections(fields),
      id: existing?.id ?? id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastUsedAt: existing?.lastUsedAt,
    }

    if (config.ssh?.enabled && config.ssh.auth === 'key' && sshPrivateKeyPath) {
      secrets.sshPrivateKey = readKeyFile(sshPrivateKeyPath)
      config.ssh.privateKeyPath = sshPrivateKeyPath
    }
    if (config.snowflake?.auth === 'keypair' && privateKeyPath) {
      secrets.privateKey = readKeyFile(privateKeyPath)
      config.snowflake.privateKeyPath = privateKeyPath
    }
    if (serviceAccountKeyPath) {
      const key = readKeyFile(serviceAccountKeyPath)
      const parsed = parseServiceAccount(key)
      secrets.serviceAccountKey = key
      if (config.bigquery) {
        config.bigquery.keyFilePath = serviceAccountKeyPath
        config.bigquery.projectId ||= parsed.project_id ?? ''
      }
      if (config.firestore) {
        config.firestore.keyFilePath = serviceAccountKeyPath
        config.firestore.projectId ||= parsed.project_id ?? ''
      }
    }
    if (config.tls?.caPath && config.tls.mode !== 'disable') {
      secrets.caCertificate = readKeyFile(config.tls.caPath)
    } else if (config.tls && !config.tls.caPath) {
      delete secrets.caCertificate
    }

    assertComplete(config, secrets)
    return { config, secrets }
  }

  function seal(secrets: ConnectionSecrets): StoredConnection['secrets'] {
    const sealed: Partial<Record<SecretKey, SealedSecret>> = {}
    for (const key of SECRET_KEYS) {
      const value = secrets[key]
      if (value) sealed[key] = box.seal(value)
    }
    return sealed
  }

  return {
    list(): ConnectionInfo[] {
      return load()
        .connections.map(toInfo)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    },

    get(id: string): ConnectionInfo {
      return toInfo(find(load(), id))
    },

    /** Config plus decrypted secrets, for the database engine only. */
    resolve(id: string): { config: ConnectionConfig; secrets: ConnectionSecrets } {
      const stored = find(load(), id)
      const { secrets: _sealed, ...config } = stored
      return { config, secrets: openSecrets(stored) }
    },

    /** Resolves an unsaved form for "Test connection", reusing saved secrets. */
    preview(input: ValidConnectionInput): { config: ConnectionConfig; secrets: ConnectionSecrets } {
      const data = load()
      const existing = input.id ? data.connections.find((c) => c.id === input.id) : undefined
      return prepare(input, existing)
    },

    save(input: ValidConnectionInput): ConnectionInfo {
      const data = load()
      const existing = input.id ? find(data, input.id) : undefined
      const { config, secrets } = prepare(input, existing)
      const stored: StoredConnection = { ...config, secrets: seal(secrets) }
      const index = data.connections.findIndex((connection) => connection.id === stored.id)
      if (index >= 0) data.connections[index] = stored
      else data.connections.push(stored)
      persist(data)
      return toInfo(stored)
    },

    remove(id: string): void {
      const data = load()
      find(data, id)
      data.connections = data.connections.filter((connection) => connection.id !== id)
      persist(data)
    },

    duplicate(id: string): ConnectionInfo {
      const data = load()
      const source = find(data, id)
      const timestamp = now().toISOString()
      const copy: StoredConnection = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        name: `${source.name} (copy)`.slice(0, 120),
        createdAt: timestamp,
        updatedAt: timestamp,
        lastUsedAt: undefined,
      }
      data.connections.push(copy)
      persist(data)
      return toInfo(copy)
    },

    touch(id: string): void {
      const data = load()
      const stored = data.connections.find((connection) => connection.id === id)
      if (!stored) return
      stored.lastUsedAt = now().toISOString()
      persist(data)
    },

    /**
     * Imports connections saved by desktop 0.1 to 0.2. Their sealed passwords
     * are moved as-is, and the old file is kept as a backup.
     */
    migrateLegacy(): number {
      const legacyFile = options.legacyFile
      if (!legacyFile || !fs.existsSync(legacyFile)) return 0
      const records = readJsonFile<LegacyRecord[]>(legacyFile, [], 'previous connections')
      if (!Array.isArray(records)) return 0
      const data = load()
      const known = new Set(data.connections.map((connection) => connection.id))
      const timestamp = now().toISOString()
      let migrated = 0
      for (const record of records) {
        if (!record?.id || known.has(record.id) || !isDbType(record.dbType)) continue
        const type = record.dbType as DbType
        const local = isLoopbackHost(record.host)
        const verified = record.tls === 'verify' || !local
        const connection: StoredConnection = {
          id: record.id,
          name: record.name || `${DB_TYPE_INFO[type].label} · ${record.database}`,
          type,
          host: record.host,
          port: Number(record.port) || DB_TYPE_INFO[type].defaultPort,
          database: record.database,
          user: record.user,
          tls: { mode: verified ? 'verify-full' : 'disable' },
          sqlserver:
            type === 'sqlserver'
              ? { auth: 'sql', encrypt: verified, trustServerCertificate: !verified }
              : undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
          secrets: record.password ? { password: record.password } : undefined,
        }
        data.connections.push(connection)
        migrated++
      }
      persist(data)
      fs.renameSync(legacyFile, `${legacyFile}.v0-backup`)
      return migrated
    },
  }
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>

function stripEmptySections<T extends Record<string, unknown>>(fields: T): T {
  const result = { ...fields }
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) delete result[key]
  }
  return result
}

function parseServiceAccount(text: string): { project_id?: string; client_email?: string } {
  try {
    const parsed = JSON.parse(text)
    if (!parsed?.client_email || !parsed?.private_key) throw new Error('missing fields')
    return parsed
  } catch {
    throw new NqError('VALIDATION', 'That file is not a Google service account key.', {
      hint: 'In Google Cloud Console, open IAM, then Service accounts, and create a JSON key.',
    })
  }
}

/** Checks the fields each database type needs before testing or saving. */
export function assertComplete(config: ConnectionConfig, secrets: ConnectionSecrets): void {
  const info = DB_TYPE_INFO[config.type]
  const need = (condition: unknown, message: string, hint?: string) => {
    if (!condition) throw new NqError('VALIDATION', message, { hint })
  }

  switch (info.family) {
    case 'postgres':
    case 'mysql':
      need(config.host, 'Enter the server host name or IP address.')
      need(config.user, 'Enter the database user name.')
      break
    case 'sqlserver':
      need(config.host, 'Enter the server name or IP address.')
      need(config.user, 'Enter the user name.')
      need(secrets.password, 'Enter the password for this account.')
      if (config.sqlserver?.auth === 'windows') {
        need(
          config.sqlserver.domain || config.user?.includes('\\'),
          'Enter the Windows domain, or a user name like DOMAIN\\user.'
        )
      }
      break
    case 'oracle':
      need(config.host, 'Enter the server host name or IP address.')
      need(config.database, 'Enter the service name or SID.')
      need(config.user, 'Enter the database user name.')
      need(secrets.password, 'Enter the password for this account.')
      break
    case 'sqlite':
      need(config.sqlite?.path, 'Choose a SQLite database file.')
      need(
        config.sqlite && fs.existsSync(config.sqlite.path),
        'That database file could not be found.',
        'Check that the file still exists and that any network drive is connected.'
      )
      break
    case 'mongodb':
      if (config.mongodb?.useConnectionString) {
        need(secrets.connectionString, 'Paste the MongoDB connection string.')
        need(
          /^mongodb(\+srv)?:\/\//i.test(secrets.connectionString ?? ''),
          'The connection string must start with mongodb:// or mongodb+srv://.'
        )
      } else {
        need(config.host, 'Enter the server host name or IP address.')
      }
      break
    case 'clickhouse':
      need(config.host, 'Enter the server host name.')
      break
    case 'snowflake':
      need(
        config.snowflake?.account,
        'Enter your Snowflake account identifier.',
        'It looks like myorg-myaccount.'
      )
      need(config.user, 'Enter the Snowflake user name.')
      if (config.snowflake?.auth === 'keypair') {
        need(secrets.privateKey, 'Choose the private key file (.p8).')
        need(
          /-----BEGIN (ENCRYPTED )?PRIVATE KEY-----/.test(secrets.privateKey ?? ''),
          'That file is not a private key in PEM format.',
          'Snowflake key pair sign-in uses a .p8 file that starts with -----BEGIN PRIVATE KEY-----.'
        )
      } else {
        need(secrets.password, 'Enter the password or a programmatic access token.')
      }
      break
    case 'bigquery':
      need(config.bigquery?.projectId, 'Enter the Google Cloud project ID.')
      need(secrets.serviceAccountKey, 'Choose the service account key file (JSON).')
      break
    case 'firestore':
      need(config.firestore?.projectId, 'Enter the Google Cloud project ID.')
      need(secrets.serviceAccountKey, 'Choose the service account key file (JSON).')
      break
    case 'dynamodb':
      need(config.dynamodb?.region, 'Enter the AWS region, for example us-east-1.')
      need(config.user, 'Enter the AWS access key ID.')
      need(secrets.secretAccessKey, 'Enter the AWS secret access key.')
      break
    case 'cassandra':
      need(config.host, 'Enter one or more contact points, separated by commas.')
      need(
        config.cassandra?.datacenter,
        'Enter the local data center name.',
        'Run "nodetool status" to find it, for example datacenter1.'
      )
      break
    case 'libsql':
      need(config.turso?.url, 'Enter the database URL, for example libsql://my-db.turso.io.')
      break
  }

  if (config.ssh?.enabled) {
    need(info.network, `SSH tunnels are not available for ${info.label}.`)
    need(config.ssh.host, 'Enter the SSH server host name.')
    need(config.ssh.user, 'Enter the SSH user name.')
    if (config.ssh.auth === 'key') need(secrets.sshPrivateKey, 'Choose your SSH private key file.')
    else need(secrets.sshPassword, 'Enter the SSH password.')
  }
}
