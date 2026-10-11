// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readChartSnapshot, SNAPSHOT_MAX_ROWS, toChartSnapshot } from '../chart-snapshot'
import { runDemoQuery } from '../demo-query'

describe('toChartSnapshot', () => {
  it('keeps only the rows the chart draws', () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ day: `d${i}`, total: i }))
    const snapshot = toChartSnapshot(rows, ['day', 'total'])
    expect(snapshot.rows).toHaveLength(SNAPSHOT_MAX_ROWS)
    expect(snapshot.rows[0]).toEqual({ day: 'd0', total: 0 })
  })

  it('turns database values into plain JSON', () => {
    const snapshot = toChartSnapshot(
      [
        {
          at: new Date('2026-10-12T08:00:00Z'),
          big: BigInt(42),
          huge: BigInt('9007199254740993'),
          amount: '1240.50',
          missing: null,
          blob: new Uint8Array([1, 2]),
        },
      ],
      ['at', 'big', 'huge', 'amount', 'missing', 'blob']
    )
    expect(snapshot.rows[0]).toEqual({
      at: '2026-10-12T08:00:00.000Z',
      big: 42,
      huge: '9007199254740993',
      amount: '1240.50',
      missing: null,
      blob: null,
    })
    expect(() => JSON.stringify(snapshot)).not.toThrow()
  })

  it('leaves out columns the query did not return', () => {
    const snapshot = toChartSnapshot([{ a: 1, secret: 'x' }], ['a'])
    expect(snapshot).toEqual({ fields: ['a'], rows: [{ a: 1 }] })
  })
})

describe('readChartSnapshot', () => {
  it('reads back what was stored', () => {
    const stored = JSON.parse(JSON.stringify(toChartSnapshot([{ a: 1 }], ['a'])))
    expect(readChartSnapshot(stored)).toEqual({ fields: ['a'], rows: [{ a: 1 }] })
  })

  it('ignores anything else', () => {
    expect(readChartSnapshot(null)).toBeNull()
    expect(readChartSnapshot({ fields: 'a', rows: [] })).toBeNull()
    expect(readChartSnapshot({ fields: [1], rows: [] })).toBeNull()
  })
})

describe('runDemoQuery', () => {
  it('answers from the sample store table the SQL names', () => {
    const result = runDemoQuery("SELECT * FROM orders WHERE status = 'shipped' LIMIT 2")
    expect(result.fields).toContain('amount')
    expect(result.rows.length).toBeLessThanOrEqual(2)
    expect(result.rows.every((row) => String(row.status).toLowerCase() === 'shipped')).toBe(true)
  })
})
