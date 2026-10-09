import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openWorkspaceDb, type WorkspaceDb } from '../../src/main/workspace-db'

const open: { db: WorkspaceDb; directory: string }[] = []
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-workspace-'))
  const db = openWorkspaceDb(path.join(directory, 'workspace.db'))
  open.push({ db, directory })
  return db
}
afterEach(() => {
  for (const { db, directory } of open.splice(0)) {
    db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const entry = {
  connectionId: 'c1',
  connectionName: 'Sales',
  text: 'SELECT 1',
  source: 'editor' as const,
  status: 'success' as const,
  rowCount: 1,
  durationMs: 12,
}

describe('query history', () => {
  it('records, searches, filters and pages entries', async () => {
    const db = fixture()
    db.addHistory({ ...entry, text: 'SELECT * FROM orders' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    db.addHistory({
      ...entry,
      connectionId: 'c2',
      connectionName: 'ERP',
      text: 'SELECT * FROM invoices',
      question: 'unpaid invoices',
    })
    expect(db.listHistory({}).map((item) => item.text)).toEqual([
      'SELECT * FROM invoices',
      'SELECT * FROM orders',
    ])
    expect(db.listHistory({ search: 'unpaid' })).toHaveLength(1)
    expect(db.listHistory({ search: '%' })).toHaveLength(0)
    expect(db.listHistory({ connectionId: 'c1' })).toHaveLength(1)
    const [newest] = db.listHistory({ limit: 1 })
    expect(db.listHistory({ before: newest.createdAt }).map((item) => item.text)).toEqual([
      'SELECT * FROM orders',
    ])
  })

  it('removes single entries and clears everything', () => {
    const db = fixture()
    const kept = db.addHistory(entry)
    const removed = db.addHistory({ ...entry, text: 'SELECT 2' })
    db.removeHistory(removed.id)
    expect(db.listHistory({}).map((item) => item.id)).toEqual([kept.id])
    db.clearHistory()
    expect(db.listHistory({})).toEqual([])
  })
})

describe('saved queries', () => {
  it('creates, updates and deletes saved queries', () => {
    const db = fixture()
    const saved = db.saveQuery({ name: 'Revenue', connectionId: 'c1', text: 'SELECT 1' })
    const updated = db.saveQuery({
      id: saved.id,
      name: 'Monthly revenue',
      connectionId: 'c1',
      text: 'SELECT 2',
      description: 'Main KPI',
    })
    expect(updated.createdAt).toBe(saved.createdAt)
    expect(db.listSaved()).toEqual([
      expect.objectContaining({
        id: saved.id,
        name: 'Monthly revenue',
        text: 'SELECT 2',
        description: 'Main KPI',
      }),
    ])
    db.removeSaved(saved.id)
    expect(db.listSaved()).toEqual([])
    expect(() => db.saveQuery({ id: saved.id, name: 'x', text: 'x' })).toThrow(/no longer exists/)
  })
})
