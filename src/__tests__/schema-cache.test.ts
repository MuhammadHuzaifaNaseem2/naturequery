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
    expect(schemaCache.get('conn-1')).toBeNull()
  })

  it('stores and retrieves a schema', () => {
    schemaCache.set('conn-1', mockSchema)
    const result = schemaCache.get('conn-1')
    expect(result).toEqual(mockSchema)
  })

  it('differentiates by connectionId', () => {
    schemaCache.set('conn-1', mockSchema)
    expect(schemaCache.get('conn-2')).toBeNull()
    expect(schemaCache.get('conn-3')).toBeNull()
  })

  it('invalidates a specific entry', () => {
    schemaCache.set('conn-1', mockSchema)
    schemaCache.invalidate('conn-1')
    expect(schemaCache.get('conn-1')).toBeNull()
  })

  it('clears all entries', () => {
    schemaCache.set('conn-1', mockSchema)
    schemaCache.set('conn-2', mockSchema)
    schemaCache.clear()
    expect(schemaCache.get('conn-1')).toBeNull()
    expect(schemaCache.get('conn-2')).toBeNull()
  })

  it('expires entries after TTL', () => {
    // The default TTL is 5 minutes. We mock Date.now to simulate time passing.
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    schemaCache.set('conn-1', mockSchema)

    // Still within TTL (4 minutes later)
    vi.spyOn(Date, 'now').mockReturnValue(now + 4 * 60 * 1000)
    expect(schemaCache.get('conn-1')).toEqual(mockSchema)

    // After TTL (6 minutes later)
    vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000)
    expect(schemaCache.get('conn-1')).toBeNull()

    vi.restoreAllMocks()
  })
})
