import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import type { HistoryEntry, HistoryQuery, SavedQuery, SavedQueryInput } from '@shared/types'
import { NqError } from '@shared/errors'

const HISTORY_LIMIT = 5000

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS history (
     id TEXT PRIMARY KEY,
     connection_id TEXT NOT NULL,
     connection_name TEXT NOT NULL,
     text TEXT NOT NULL,
     question TEXT,
     source TEXT NOT NULL,
     status TEXT NOT NULL,
     row_count INTEGER,
     duration_ms INTEGER,
     error TEXT,
     created_at TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS history_created ON history (created_at DESC)',
  'CREATE INDEX IF NOT EXISTS history_connection ON history (connection_id, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS saved_queries (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     connection_id TEXT,
     text TEXT NOT NULL,
     question TEXT,
     description TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
]

interface HistoryRow {
  id: string
  connection_id: string
  connection_name: string
  text: string
  question: string | null
  source: HistoryEntry['source']
  status: HistoryEntry['status']
  row_count: number | null
  duration_ms: number | null
  error: string | null
  created_at: string
}

interface SavedRow {
  id: string
  name: string
  connection_id: string | null
  text: string
  question: string | null
  description: string | null
  created_at: string
  updated_at: string
}

/**
 * Local query history and saved queries. Stored only on this computer in the
 * app data folder; nothing here is sent to NatureQuery's servers.
 */
export function openWorkspaceDb(file: string) {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 3000')
  for (const statement of MIGRATIONS) db.exec(statement)

  const insertHistory = db.prepare(
    `INSERT INTO history (id, connection_id, connection_name, text, question, source, status, row_count, duration_ms, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const pruneHistory = db.prepare(
    `DELETE FROM history WHERE id IN (
       SELECT id FROM history ORDER BY created_at DESC LIMIT -1 OFFSET ${HISTORY_LIMIT}
     )`
  )

  function toHistory(row: HistoryRow): HistoryEntry {
    return {
      id: row.id,
      connectionId: row.connection_id,
      connectionName: row.connection_name,
      text: row.text,
      question: row.question ?? undefined,
      source: row.source,
      status: row.status,
      rowCount: row.row_count ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
    }
  }

  function toSaved(row: SavedRow): SavedQuery {
    return {
      id: row.id,
      name: row.name,
      connectionId: row.connection_id ?? undefined,
      text: row.text,
      question: row.question ?? undefined,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  let writesSincePrune = 0

  return {
    addHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
      const record: HistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      insertHistory.run(
        record.id,
        record.connectionId,
        record.connectionName,
        record.text,
        record.question ?? null,
        record.source,
        record.status,
        record.rowCount ?? null,
        record.durationMs ?? null,
        record.error?.slice(0, 4000) ?? null,
        record.createdAt
      )
      if (++writesSincePrune >= 100) {
        writesSincePrune = 0
        pruneHistory.run()
      }
      return record
    },

    listHistory(query: HistoryQuery): HistoryEntry[] {
      const where: string[] = []
      const params: (string | number)[] = []
      if (query.search?.trim()) {
        const pattern = `%${query.search.trim().replace(/[\\%_]/g, '\\$&')}%`
        where.push(
          "(text LIKE ? ESCAPE '\\' OR question LIKE ? ESCAPE '\\' OR connection_name LIKE ? ESCAPE '\\')"
        )
        params.push(pattern, pattern, pattern)
      }
      if (query.connectionId) {
        where.push('connection_id = ?')
        params.push(query.connectionId)
      }
      if (query.before) {
        where.push('created_at < ?')
        params.push(query.before)
      }
      const sql = `SELECT * FROM history ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                   ORDER BY created_at DESC LIMIT ?`
      params.push(query.limit ?? 100)
      return (db.prepare(sql).all(...params) as unknown as HistoryRow[]).map(toHistory)
    },

    removeHistory(id: string): void {
      db.prepare('DELETE FROM history WHERE id = ?').run(id)
    },

    clearHistory(): void {
      db.exec('DELETE FROM history')
    },

    listSaved(): SavedQuery[] {
      return (
        db
          .prepare('SELECT * FROM saved_queries ORDER BY updated_at DESC')
          .all() as unknown as SavedRow[]
      ).map(toSaved)
    },

    saveQuery(input: SavedQueryInput): SavedQuery {
      const timestamp = new Date().toISOString()
      if (input.id) {
        const existing = db
          .prepare('SELECT * FROM saved_queries WHERE id = ?')
          .get(input.id) as unknown as SavedRow | undefined
        if (!existing) throw new NqError('NOT_FOUND', 'This saved query no longer exists.')
        db.prepare(
          `UPDATE saved_queries SET name = ?, connection_id = ?, text = ?, question = ?, description = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          input.name,
          input.connectionId ?? null,
          input.text,
          input.question ?? null,
          input.description ?? null,
          timestamp,
          input.id
        )
        return toSaved({
          ...existing,
          name: input.name,
          connection_id: input.connectionId ?? null,
          text: input.text,
          question: input.question ?? null,
          description: input.description ?? null,
          updated_at: timestamp,
        })
      }
      const id = crypto.randomUUID()
      db.prepare(
        `INSERT INTO saved_queries (id, name, connection_id, text, question, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.name,
        input.connectionId ?? null,
        input.text,
        input.question ?? null,
        input.description ?? null,
        timestamp,
        timestamp
      )
      return toSaved({
        id,
        name: input.name,
        connection_id: input.connectionId ?? null,
        text: input.text,
        question: input.question ?? null,
        description: input.description ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      })
    },

    removeSaved(id: string): void {
      db.prepare('DELETE FROM saved_queries WHERE id = ?').run(id)
    },

    close(): void {
      db.close()
    },
  }
}

export type WorkspaceDb = ReturnType<typeof openWorkspaceDb>
