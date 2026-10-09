import {
  DocumentReference,
  Firestore,
  GeoPoint,
  Timestamp,
  type Query,
  type WhereFilterOp,
} from '@google-cloud/firestore'
import { NqError } from '@shared/errors'
import { documentsToTable, inferFields } from './documents'
import { withDeadline } from './shared'
import { type Driver, type DriverFactory } from './types'

const SAMPLE_SIZE = 20
const SCHEMA_COLLECTION_LIMIT = 200
const OPERATORS: WhereFilterOp[] = [
  '<',
  '<=',
  '==',
  '!=',
  '>=',
  '>',
  'array-contains',
  'array-contains-any',
  'in',
  'not-in',
]

export interface FirestoreQuerySpec {
  /** A collection path such as "orders" or "customers/acme/orders". */
  collection?: string
  /** Queries every collection with this ID, at any depth. */
  collectionGroup?: string
  where?: [field: string, op: WhereFilterOp, value: unknown][]
  orderBy?: [field: string, direction: 'asc' | 'desc'][]
  select?: string[]
  limit?: number
}

function fail(message: string, hint?: string): never {
  throw new NqError('VALIDATION', message, { hint })
}

/** {"$date": "2026-01-01"} in a query becomes a date. */
function revive(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === '$date') {
      const date = new Date((value as { $date: string | number }).$date)
      if (Number.isNaN(date.getTime())) fail('A "$date" value in the query is not a valid date.')
      return date
    }
  }
  return value
}

/**
 * Parses a Firestore query written as JSON. Also accepts the shape the
 * website uses: "conditions": [{ "field", "op", "value" }] and a single
 * "orderBy" field with "desc": true.
 */
export function parseFirestoreQuery(text: string): FirestoreQuerySpec {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text, revive) as Record<string, unknown>
  } catch (error) {
    if (error instanceof NqError) throw error
    fail(
      'Firestore queries are written as JSON, and this is not valid JSON.',
      'Example: { "collection": "orders", "where": [["status", "==", "paid"]], "limit": 50 }'
    )
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('Write the query as a JSON object with a "collection".')
  }
  const allowed = [
    'collection',
    'collectionGroup',
    'where',
    'conditions',
    'orderBy',
    'desc',
    'select',
    'limit',
  ]
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      fail(
        `"${key}" is not a supported query field.`,
        `Use ${allowed.filter((k) => k !== 'conditions' && k !== 'desc').join(', ')}.`
      )
    }
  }
  const spec: FirestoreQuerySpec = {}
  if (typeof raw.collection === 'string' && raw.collection.trim())
    spec.collection = raw.collection.trim()
  if (typeof raw.collectionGroup === 'string' && raw.collectionGroup.trim()) {
    spec.collectionGroup = raw.collectionGroup.trim()
  }
  if (!spec.collection === !spec.collectionGroup) {
    fail('Say which collection to query, with either "collection" or "collectionGroup".')
  }

  const where: FirestoreQuerySpec['where'] = []
  const conditions = raw.where ?? raw.conditions
  if (conditions !== undefined) {
    if (!Array.isArray(conditions)) fail('"where" must be a list of conditions.')
    for (const condition of conditions) {
      const [field, op, value] = Array.isArray(condition)
        ? condition
        : [condition?.field, condition?.op, condition?.value]
      if (typeof field !== 'string' || !field) fail('Each condition needs a field name.')
      if (!OPERATORS.includes(op)) {
        fail(`"${String(op)}" is not a Firestore operator.`, `Use one of: ${OPERATORS.join(', ')}.`)
      }
      where.push([field, op, value])
    }
  }
  if (where.length) spec.where = where

  if (raw.orderBy !== undefined) {
    if (typeof raw.orderBy === 'string') {
      spec.orderBy = [[raw.orderBy, raw.desc ? 'desc' : 'asc']]
    } else if (Array.isArray(raw.orderBy)) {
      spec.orderBy = raw.orderBy.map((entry) => {
        const [field, direction = 'asc'] = Array.isArray(entry) ? entry : [entry]
        if (typeof field !== 'string' || !['asc', 'desc'].includes(direction)) {
          fail('"orderBy" entries look like ["createdAt", "desc"].')
        }
        return [field, direction]
      })
    } else fail('"orderBy" entries look like ["createdAt", "desc"].')
  }
  if (raw.select !== undefined) {
    if (!Array.isArray(raw.select) || raw.select.some((field) => typeof field !== 'string')) {
      fail('"select" must be a list of field names.')
    }
    spec.select = raw.select as string[]
  }
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== 'number' || !Number.isInteger(raw.limit) || raw.limit < 1) {
      fail('"limit" must be a whole number above zero.')
    }
    spec.limit = raw.limit
  }
  return spec
}

/** Converts Firestore types into plain values. */
export function firestoreValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value ?? null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude }
  if (value instanceof DocumentReference) return value.path
  if (value instanceof Uint8Array) return value
  if (depth > 8) return '[nested value]'
  if (Array.isArray(value)) return value.map((item) => firestoreValue(item, depth + 1))
  const vector = value as { toArray?: () => number[] }
  if (typeof vector.toArray === 'function') return vector.toArray()
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, firestoreValue(item, depth + 1)])
  )
}

/** Google Cloud Firestore, queried with JSON query specs. */
export const createFirestoreDriver: DriverFactory = (config, secrets) => {
  let key: { project_id?: string; client_email?: string; private_key?: string } | undefined
  try {
    key = secrets.serviceAccountKey ? JSON.parse(secrets.serviceAccountKey) : undefined
  } catch {
    throw new NqError('VALIDATION', 'The service account key file is not valid JSON.')
  }
  const projectId = config.firestore?.projectId || key?.project_id
  const db = new Firestore({
    projectId,
    databaseId: config.database || undefined,
    credentials: key ? { client_email: key.client_email, private_key: key.private_key } : undefined,
    preferRest: true,
  })
  const canceled = new Set<string>()

  const driver: Driver = {
    async test() {
      await db.listCollections()
      return { serverVersion: `Cloud Firestore (${projectId})` }
    },

    async schema() {
      const collections = (await db.listCollections()).slice(0, SCHEMA_COLLECTION_LIMIT)
      const tables = await Promise.all(
        collections.map(async (collection) => {
          const snapshot = await collection
            .limit(SAMPLE_SIZE)
            .get()
            .catch(() => null)
          const samples = (snapshot?.docs ?? []).map((doc) => ({
            _id: doc.id,
            ...(firestoreValue(doc.data()) as Record<string, unknown>),
          }))
          const columns = inferFields(samples, ['_id'])
          if (!columns.length)
            columns.push({ name: '_id', type: 'string', nullable: false, isPrimaryKey: true })
          return {
            name: collection.id,
            kind: 'collection' as const,
            columns,
            foreignKeys: [],
            qualifiedName: collection.id,
          }
        })
      )
      return { tables, truncated: collections.length >= SCHEMA_COLLECTION_LIMIT }
    },

    async query(text, options) {
      const spec = parseFirestoreQuery(text)
      canceled.delete(options.queryId)
      let query: Query = spec.collectionGroup
        ? db.collectionGroup(spec.collectionGroup)
        : db.collection(spec.collection!)
      for (const [field, op, value] of spec.where ?? []) query = query.where(field, op, value)
      for (const [field, direction] of spec.orderBy ?? []) query = query.orderBy(field, direction)
      if (spec.select) query = query.select(...spec.select)
      query = query.limit(Math.min(spec.limit ?? Infinity, options.rowLimit + 1))

      const snapshot = await withDeadline(
        query.get(),
        Math.max(1000, options.timeoutMs),
        'timeout'
      ).catch((error) => {
        if (canceled.delete(options.queryId))
          throw new NqError('CANCELED', 'The query was canceled.')
        if ((error as Error).message === 'timeout') {
          throw new NqError(
            'TIMEOUT',
            `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
            { hint: 'Add conditions or a lower limit, or raise the time limit in Settings.' }
          )
        }
        throw error
      })
      if (canceled.delete(options.queryId)) throw new NqError('CANCELED', 'The query was canceled.')
      const documents = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...(spec.collectionGroup ? { _path: doc.ref.path } : {}),
        ...(firestoreValue(doc.data()) as Record<string, unknown>),
      }))
      const truncated = documents.length > options.rowLimit
      if (truncated) documents.length = options.rowLimit
      return { ...documentsToTable(documents), truncated, executedText: text }
    },

    async cancel(queryId) {
      // Firestore reads cannot be interrupted; the result is discarded.
      canceled.add(queryId)
    },

    async close() {
      await db.terminate().catch(() => {})
    },
  }
  return driver
}
