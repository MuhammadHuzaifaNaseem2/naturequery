import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  executeDesktopSQL,
  fetchDesktopSchema,
  listDesktopConnections,
  removeDesktopConnection,
} from './desktop-bridge'

const localdb = {
  openManager: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  test: vi.fn(),
  schema: vi.fn(),
  query: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  window.naturequery = { isDesktop: true, platform: 'win32', localdb }
})

describe('desktop bridge', () => {
  it('maps safe local metadata into dashboard connections', async () => {
    localdb.list.mockResolvedValue([
      {
        id: 'local-1',
        name: 'Office PostgreSQL',
        dbType: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'reports',
        user: 'analyst',
      },
    ])

    const connections = await listDesktopConnections()

    expect(connections).toEqual([
      expect.objectContaining({
        id: 'desktop:local-1',
        source: 'desktop',
        teamName: 'On this computer',
        status: 'active',
      }),
    ])
    expect(connections[0]).not.toHaveProperty('password')
  })

  it('converts desktop table metadata to the shared schema shape', async () => {
    localdb.schema.mockResolvedValue({
      ok: true,
      schema: [
        {
          name: 'orders',
          columns: [{ name: 'id', type: 'integer', nullable: false }],
        },
      ],
    })

    await expect(fetchDesktopSchema('desktop:local-1')).resolves.toEqual({
      success: true,
      data: {
        tables: [
          {
            tableName: 'orders',
            columns: [
              {
                name: 'id',
                type: 'integer',
                nullable: false,
                defaultValue: null,
                isPrimaryKey: false,
              },
            ],
          },
        ],
      },
    })
  })

  it('executes and removes only prefixed desktop connection ids', async () => {
    localdb.query.mockResolvedValue({
      ok: true,
      rows: [{ total: 3 }],
      fields: ['total'],
      rowCount: 1,
    })
    localdb.remove.mockResolvedValue({ ok: true })

    const query = await executeDesktopSQL('desktop:local-1', 'SELECT COUNT(*) AS total FROM orders')
    expect(query.success).toBe(true)
    expect(localdb.query).toHaveBeenCalledWith(
      'local-1',
      'SELECT COUNT(*) AS total FROM orders'
    )

    await expect(removeDesktopConnection('desktop:local-1')).resolves.toEqual({ success: true })
    await expect(executeDesktopSQL('cloud-1', 'SELECT 1')).rejects.toThrow(
      'Invalid desktop connection id'
    )
  })
})
