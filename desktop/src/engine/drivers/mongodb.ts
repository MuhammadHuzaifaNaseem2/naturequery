import { BSON, MongoClient, type Document, type MongoClientOptions } from 'mongodb'
import { NqError } from '@shared/errors'
import { DB_TYPE_INFO } from '@shared/db-types'
import { resolveTls } from '../tls'
import { APP_NAME, shortVersion } from './shared'
import { documentsToTable, inferFields } from './documents'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const WRITE_STAGES = new Set(['$out', '$merge'])
// Operators that run JavaScript on the server.
const SERVER_CODE = new Set(['$where', '$function', '$accumulator'])
const SAMPLE_SIZE = 50

export interface MongoQuerySpec {
  collection: string
  pipeline?: Document[]
  filter?: Document
  projection?: Document
  sort?: Document
  limit?: number
}

function fail(message: string, hint?: string): never {
  throw new NqError('VALIDATION', message, { hint })
}

function scan(value: unknown, depth = 0): void {
  if (depth > 40 || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) scan(item, depth + 1)
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (WRITE_STAGES.has(key))
      fail(`${key} writes data, so it is not allowed.`, 'NatureQuery only runs read-only queries.')
    if (SERVER_CODE.has(key)) fail(`${key} runs code on the database server, so it is not allowed.`)
    scan(child, depth + 1)
  }
}

/**
 * Parses and checks a query written as JSON (Extended JSON is accepted, so
 * {"$date": "2026-01-01"} and {"$oid": "..."} work).
 */
export function parseMongoQuery(text: string): MongoQuerySpec {
  let spec: MongoQuerySpec
  try {
    spec = BSON.EJSON.parse(text, { relaxed: true }) as MongoQuerySpec
  } catch (error) {
    fail(
      'MongoDB queries are written as JSON, and this is not valid JSON.',
      `${(error as Error).message}. Example: { "collection": "orders", "pipeline": [{ "$limit": 10 }] }`
    )
  }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    fail(
      'Write the query as a JSON object with a "collection".',
      'Example: { "collection": "orders", "filter": { "status": "paid" } }'
    )
  }
  if (typeof spec.collection !== 'string' || !spec.collection.trim()) {
    fail('Say which collection to query, for example "collection": "orders".')
  }
  if (spec.pipeline !== undefined && !Array.isArray(spec.pipeline))
    fail('"pipeline" must be a list of stages.')
  for (const key of Object.keys(spec)) {
    if (!['collection', 'pipeline', 'filter', 'projection', 'sort', 'limit'].includes(key)) {
      fail(
        `"${key}" is not a supported query field.`,
        'Use collection with either pipeline, or filter, projection, sort and limit.'
      )
    }
  }
  scan(spec)
  return spec
}

export const createMongoDriver: DriverFactory = (config, secrets, context) => {
  let client: MongoClient | null = null
  let clientReady: Promise<MongoClient> | null = null
  const running = new Map<string, AbortController>()

  function uri(): string {
    if (config.mongodb?.useConnectionString && secrets.connectionString)
      return secrets.connectionString
    const host = context.endpoint?.host ?? config.host ?? 'localhost'
    const port = context.endpoint?.port ?? config.port ?? DB_TYPE_INFO.mongodb.defaultPort
    const auth = config.user
      ? `${encodeURIComponent(config.user)}:${encodeURIComponent(secrets.password ?? '')}@`
      : ''
    return `mongodb://${auth}${host}:${port}/`
  }

  function databaseName(): string {
    if (config.database) return config.database
    try {
      const path = new URL(uri()).pathname.replace(/^\//, '')
      if (path) return decodeURIComponent(path)
    } catch {
      // Fall through to the default.
    }
    return 'test'
  }

  async function getClient(): Promise<MongoClient> {
    if (client) return client
    if (!clientReady) {
      const options: MongoClientOptions = {
        appName: APP_NAME,
        serverSelectionTimeoutMS: context.connectTimeoutMs,
        connectTimeoutMS: context.connectTimeoutMs,
        maxPoolSize: 4,
        readPreference: 'primaryPreferred',
      }
      if (!config.mongodb?.useConnectionString) {
        if (config.user) options.authSource = config.mongodb?.authSource || 'admin'
        const tls = resolveTls(config, secrets, config.host)
        // MongoDB cannot fall back from TLS to plain, so "prefer" means plain.
        if (tls.options && tls.mode !== 'prefer') {
          options.tls = true
          options.tlsAllowInvalidCertificates = !tls.options.rejectUnauthorized
          options.tlsAllowInvalidHostnames = tls.mode !== 'verify-full'
          if (tls.options.ca) options.ca = tls.options.ca
        }
        if (context.endpoint) options.directConnection = true
      }
      clientReady = MongoClient.connect(uri(), options).then((connected) => {
        client = connected
        return connected
      })
      clientReady.catch(() => {
        clientReady = null
      })
    }
    return clientReady
  }

  const driver: Driver = {
    async test() {
      const connected = await getClient()
      const info = await connected.db(databaseName()).command({ buildInfo: 1 })
      return { serverVersion: shortVersion(`MongoDB ${info.version}`) }
    },

    async schema() {
      const db = (await getClient()).db(databaseName())
      const collections = (await db.listCollections({}, { nameOnly: false }).toArray())
        .filter((collection) => !collection.name.startsWith('system.'))
        .slice(0, SCHEMA_TABLE_LIMIT)
      const tables = await Promise.all(
        collections.map(async (collection) => {
          const isView = collection.type === 'view'
          const samples = await db
            .collection(collection.name)
            .aggregate([{ $sample: { size: SAMPLE_SIZE } }], { maxTimeMS: 15_000 })
            .toArray()
            .catch(() => [] as Document[])
          const rowEstimate = isView
            ? undefined
            : await db
                .collection(collection.name)
                .estimatedDocumentCount()
                .catch(() => undefined)
          return {
            name: collection.name,
            kind: (isView ? 'view' : 'collection') as 'view' | 'collection',
            columns: inferFields(samples, ['_id']),
            foreignKeys: [],
            qualifiedName: collection.name,
            rowEstimate,
          }
        })
      )
      return { tables, truncated: collections.length >= SCHEMA_TABLE_LIMIT }
    },

    async query(text, options) {
      const spec = parseMongoQuery(text)
      const collection = (await getClient()).db(databaseName()).collection(spec.collection)
      const controller = new AbortController()
      running.set(options.queryId, controller)
      const limit = options.rowLimit + 1
      try {
        let documents: Document[]
        if (spec.pipeline) {
          documents = await collection
            .aggregate([...spec.pipeline, { $limit: limit }], {
              maxTimeMS: options.timeoutMs,
              signal: controller.signal,
            })
            .toArray()
        } else {
          documents = await collection
            .find(spec.filter ?? {}, {
              projection: spec.projection,
              sort: spec.sort,
              limit: Math.min(spec.limit ?? limit, limit),
              maxTimeMS: options.timeoutMs,
              signal: controller.signal,
            })
            .toArray()
        }
        const truncated = documents.length > options.rowLimit
        if (truncated) documents.length = options.rowLimit
        const table = documentsToTable(documents as Record<string, unknown>[])
        return { ...table, truncated, executedText: text }
      } catch (error) {
        if (controller.signal.aborted) throw new NqError('CANCELED', 'The query was canceled.')
        if ((error as { code?: number }).code === 50) {
          throw new NqError(
            'TIMEOUT',
            `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
            {
              hint: 'Add a filter or a $limit stage, or raise the time limit in Settings.',
            }
          )
        }
        throw error
      } finally {
        running.delete(options.queryId)
      }
    },

    async cancel(queryId) {
      running.get(queryId)?.abort()
    },

    async close() {
      const current = client ?? (clientReady ? await clientReady.catch(() => null) : null)
      client = null
      clientReady = null
      await current?.close().catch(() => {})
    },
  }
  return driver
}
