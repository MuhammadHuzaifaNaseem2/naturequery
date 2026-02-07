import { describe, it, expect, beforeEach, vi } from 'vitest'
import { schemaCache } from '@/lib/schema-cache'
import type { DatabaseSchema } from '@/actions/db'

const mockSchema: DatabaseSchema = {
  tables: [
    {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: true },
        { name: 'name', type: 'text', nullable: true, defaultValue: null, isPrimaryKey: false },
      ],
    },
  ],
}

describe('Schema Cache', () => {
  beforeEach(() => {
    schemaCache.clear()
  })

  it('returns null for uncached entry', () => {
    expect(schemaCache.get('localhost', 5432, 'mydb')).toBeNull()
  })

  it('stores and retrieves a schema', () => {
    schemaCache.set('localhost', 5432, 'mydb', mockSchema)
    const result = schemaCache.get('localhost', 5432, 'mydb')
    expect(result).toEqual(mockSchema)
  })

  it('differentiates by host/port/database', () => {
    schemaCache.set('localhost', 5432, 'db1', mockSchema)
    expect(schemaCache.get('localhost', 5432, 'db2')).toBeNull()
    expect(schemaCache.get('localhost', 5433, 'db1')).toBeNull()
    expect(schemaCache.get('remotehost', 5432, 'db1')).toBeNull()
  })

  it('invalidates a specific entry', () => {
    schemaCache.set('localhost', 5432, 'mydb', mockSchema)
    schemaCache.invalidate('localhost', 5432, 'mydb')
    expect(schemaCache.get('localhost', 5432, 'mydb')).toBeNull()
  })

  it('clears all entries', () => {
    schemaCache.set('host1', 5432, 'db1', mockSchema)
    schemaCache.set('host2', 5432, 'db2', mockSchema)
    schemaCache.clear()
    expect(schemaCache.get('host1', 5432, 'db1')).toBeNull()
    expect(schemaCache.get('host2', 5432, 'db2')).toBeNull()
  })

  it('expires entries after TTL', () => {
    // The default TTL is 5 minutes. We mock Date.now to simulate time passing.
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    schemaCache.set('localhost', 5432, 'mydb', mockSchema)

    // Still within TTL (4 minutes later)
    vi.spyOn(Date, 'now').mockReturnValue(now + 4 * 60 * 1000)
    expect(schemaCache.get('localhost', 5432, 'mydb')).toEqual(mockSchema)

    // After TTL (6 minutes later)
    vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000)
    expect(schemaCache.get('localhost', 5432, 'mydb')).toBeNull()

    vi.restoreAllMocks()
  })
})
