import { describe, expect, it } from 'vitest'
import { applyDemoQueryFilters } from '@/lib/demo-query'

const ORDERS = [
  { id: 1, status: 'completed', amount: 100 },
  { id: 2, status: 'pending', amount: 200 },
  { id: 3, status: 'completed', amount: 300 },
  { id: 4, status: 'shipped', amount: 400 },
]

describe('demo query filters', () => {
  it('applies a quoted status equality filter', () => {
    expect(
      applyDemoQueryFilters(ORDERS, "SELECT id, amount FROM orders WHERE status = 'completed'")
    ).toEqual([ORDERS[0], ORDERS[2]])
  })

  it('applies status IN and LIMIT filters', () => {
    expect(
      applyDemoQueryFilters(
        ORDERS,
        "SELECT * FROM orders WHERE `status` IN ('completed', 'shipped') LIMIT 2"
      )
    ).toEqual([ORDERS[0], ORDERS[2]])
  })

  it('does not mutate the demo dataset', () => {
    const copy = [...ORDERS]
    applyDemoQueryFilters(ORDERS, 'SELECT * FROM orders LIMIT 1')
    expect(ORDERS).toEqual(copy)
  })
})
