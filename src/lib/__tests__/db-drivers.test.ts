// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMongoDriver } from '../db-drivers'

describe('MongoDB driver', () => {
  it('refuses a writing pipeline before it connects', async () => {
    // Nothing listens on port 1: reaching the server would fail differently.
    const driver = createMongoDriver({
      host: '127.0.0.1',
      port: 1,
      database: 'shop',
      user: '',
      password: '',
    })
    await expect(
      driver.executeQuery('{ "collection": "orders", "pipeline": [{ "$out": "orders_copy" }] }')
    ).rejects.toThrow(/\$out/)
  })
})
