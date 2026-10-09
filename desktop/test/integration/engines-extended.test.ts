import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import cassandra from 'cassandra-driver'
import oracledb from 'oracledb'
import { createClient as createLibsqlClient } from '@libsql/client/web'
import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  type WriteRequest,
} from '@aws-sdk/client-dynamodb'
import { NqError } from '../../src/shared/errors'
import { createHarness, SSH_SECRETS, SSH_TUNNEL } from './helpers'

// Runs against the disposable databases in the "extended" profile of
// test/integration/docker-compose.yml. Set NQ_IT_EXTENDED=1 to enable.
// Never point these tests at a real database.
const enabled = process.env.NQ_IT_EXTENDED === '1'
const { registry, connection, run, failure, expectCode, tableNames, expectCancel } = createHarness()
afterAll(() => registry.closeAll())

// ─── MongoDB ─────────────────────────────────────────────────────────

describe.skipIf(!enabled)('MongoDB', () => {
  const reader = connection({
    type: 'mongodb',
    host: '127.0.0.1',
    port: 58017,
    database: 'acme',
    user: 'nq_reader',
    mongodb: { useConnectionString: false, authSource: 'acme' },
    tls: { mode: 'disable' },
  })
  const secrets = { password: 'nq_reader_pw' }
  const heavy = JSON.stringify({
    collection: 'orders',
    pipeline: [
      { $lookup: { from: 'orders', pipeline: [], as: 'other' } },
      { $unwind: '$other' },
      { $lookup: { from: 'orders', pipeline: [], as: 'third' } },
      { $unwind: '$third' },
      { $count: 'n' },
    ],
  })

  it('connects and reports the server version', async () => {
    expect((await registry.test(reader, secrets)).serverVersion).toMatch(/^MongoDB 8\./)
  })

  it('discovers collections, views and fields', async () => {
    const { tables } = await registry.schema(reader, secrets)
    expect(tableNames(tables)).toEqual(
      expect.arrayContaining(['customers', 'orders', 'paid_orders'])
    )
    const customers = tables.find((t) => t.name === 'customers')!
    expect(customers.kind).toBe('collection')
    expect(customers.rowEstimate).toBe(51)
    expect(customers.columns.find((c) => c.name === '_id')).toMatchObject({ isPrimaryKey: true })
    expect(customers.columns.find((c) => c.name === 'signedUp')?.type).toBe('date')
    expect(customers.columns.find((c) => c.name === 'balance')?.type).toBe('decimal128')
    expect(tables.find((t) => t.name === 'paid_orders')?.kind).toBe('view')
  })

  it('returns exact values', async () => {
    const result = await run(
      reader,
      secrets,
      '{ "collection": "customers", "filter": { "_id": 51 } }'
    )
    expect(result.columns.map((c) => c.name)).toEqual([
      '_id',
      'name',
      'email',
      'signedUp',
      'balance',
      'lifetimeOrders',
    ])
    expect(result.rows[0]).toEqual([
      51,
      'Zoë Ünicode 名前',
      'zoe@example.com',
      '2026-01-06T09:30:00.000Z',
      '1235.50',
      '9007199254740993',
    ])
    const nested = await run(
      reader,
      secrets,
      '{ "collection": "customers", "filter": { "_id": 3 } }'
    )
    expect(nested.rows[0][nested.columns.findIndex((c) => c.name === 'address')]).toEqual({
      city: 'Karachi',
      zip: '54003',
    })
  })

  it('runs aggregation pipelines and Extended JSON filters', async () => {
    const grouped = await run(
      reader,
      secrets,
      '{ "collection": "orders", "pipeline": [{ "$group": { "_id": "$status", "n": { "$sum": 1 } } }, { "$sort": { "_id": 1 } }] }'
    )
    expect(grouped.rows).toEqual([
      ['paid', 1875],
      ['refunded', 625],
    ])
    const dated = await run(
      reader,
      secrets,
      '{ "collection": "orders", "filter": { "placedAt": { "$gte": { "$date": "2026-02-28T00:00:00Z" } } }, "limit": 1000 }'
    )
    expect(dated.rows.length).toBeGreaterThan(0)
  })

  it('stops at the row limit and keeps smaller limits', async () => {
    const full = await run(reader, secrets, '{ "collection": "orders" }')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    const limited = await run(reader, secrets, '{ "collection": "orders", "limit": 7 }')
    expect(limited.rows).toHaveLength(7)
    expect(limited.truncated).toBe(false)
    const piped = await run(reader, secrets, '{ "collection": "orders", "pipeline": [] }', {
      rowLimit: 50,
    })
    expect(piped.rows).toHaveLength(50)
    expect(piped.truncated).toBe(true)
  })

  it('blocks stages that write or run code', async () => {
    await expect(
      run(reader, secrets, '{ "collection": "orders", "pipeline": [{ "$out": "copy" }] }')
    ).rejects.toBeInstanceOf(NqError)
    await expect(
      run(reader, secrets, '{ "collection": "orders", "filter": { "$where": "true" } }')
    ).rejects.toBeInstanceOf(NqError)
  })

  it('cancels a running query', async () => {
    await expectCancel(reader, secrets, heavy)
  })

  it('stops queries that exceed the time limit', async () => {
    const error = await failure(run(reader, secrets, heavy, { timeoutMs: 2000 }), reader, 'query', {
      timeoutSeconds: 2,
    })
    expectCode(error, 'TIMEOUT')
  })

  it('explains wrong passwords and missing permissions', async () => {
    const wrong = await failure(registry.test(reader, { password: 'nope' }), reader, 'connect')
    expectCode(wrong, 'AUTH_FAILED')
    const otherDb = connection({ ...reader, database: 'admin' })
    const denied = await failure(
      run(otherDb, secrets, '{ "collection": "system.users" }'),
      otherDb,
      'query'
    )
    expectCode(denied, 'AUTH_FAILED')
  })

  it('connects with a connection string', async () => {
    const uri = connection({
      type: 'mongodb',
      mongodb: { useConnectionString: true },
    })
    const uriSecrets = {
      connectionString: 'mongodb://nq_reader:nq_reader_pw@127.0.0.1:58017/acme?authSource=acme',
    }
    expect(
      (await run(uri, uriSecrets, '{ "collection": "customers", "limit": 2 }')).rows
    ).toHaveLength(2)
  })

  it('connects through an SSH tunnel', async () => {
    const tunneled = connection({ ...reader, host: 'mongo', port: 27017, ssh: SSH_TUNNEL })
    const tunnelSecrets = { ...secrets, ...SSH_SECRETS }
    const tested = await registry.test(tunneled, tunnelSecrets)
    expect(tested.sshHostKey).toMatch(/^SHA256:/)
    const result = await run(
      tunneled,
      tunnelSecrets,
      '{ "collection": "orders", "pipeline": [{ "$count": "n" }] }'
    )
    expect(result.rows).toEqual([[2500]])
  })
})

// ─── ClickHouse ──────────────────────────────────────────────────────

describe.skipIf(!enabled)('ClickHouse', () => {
  const base = {
    type: 'clickhouse' as const,
    host: '127.0.0.1',
    port: 58123,
    database: 'acme',
    clickhouse: { protocol: 'http' as const },
  }
  // readonly = 1: may not change settings, so the driver retries without them.
  const reader = connection({ ...base, user: 'nq_reader' })
  const readerSecrets = { password: 'nq_reader_pw' }
  // readonly = 2: may change settings, so server-side time limits apply.
  const analyst = connection({ ...base, user: 'nq_analyst' })
  const analystSecrets = { password: 'nq_analyst_pw' }
  const heavy = 'SELECT count() FROM numbers(1000000000000) WHERE sipHash64(number) % 7 = 3'

  it('connects and reports the server version', async () => {
    expect((await registry.test(reader, readerSecrets)).serverVersion).toMatch(/^ClickHouse 25\.8/)
  })

  it('discovers tables, views, key columns and row counts', async () => {
    const { tables } = await registry.schema(reader, readerSecrets)
    expect(tableNames(tables)).toEqual(['customers', 'orders', 'paid_orders'])
    const customers = tables.find((t) => t.name === 'customers')!
    expect(customers.rowEstimate).toBe(51)
    expect(customers.columns.find((c) => c.name === 'id')).toMatchObject({ isPrimaryKey: true })
    expect(customers.columns.find((c) => c.name === 'note')).toMatchObject({
      type: 'Nullable(String)',
      nullable: true,
    })
    expect(tables.find((t) => t.name === 'paid_orders')?.kind).toBe('view')
  })

  it('returns exact values for read-only accounts', async () => {
    const result = await run(
      reader,
      readerSecrets,
      'SELECT signed_up, birthday, lifetime_orders, tags, city, note, name FROM customers WHERE id = 51'
    )
    expect(result.rows[0]).toEqual([
      '2026-01-06 09:30:00',
      '1990-01-02',
      '18446744073709551615',
      [],
      'Karachi',
      'note',
      'Zoë Ünicode 名前',
    ])
    const decimals = await run(
      analyst,
      analystSecrets,
      "SELECT balance, toDecimal128('12345678901234567890.12', 2) AS big FROM customers WHERE id = 1"
    )
    // Values a JavaScript number cannot hold exactly keep their text.
    expect(decimals.rows).toEqual([[1235.5, '12345678901234567890.12']])
  })

  it('stops at the row limit and keeps smaller limits', async () => {
    const full = await run(reader, readerSecrets, 'SELECT * FROM orders ORDER BY id')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    const limited = await run(reader, readerSecrets, 'SELECT * FROM orders ORDER BY id LIMIT 7')
    expect(limited.rows).toHaveLength(7)
    expect(limited.truncated).toBe(false)
  })

  it('blocks writes and server commands', async () => {
    for (const statement of [
      "INSERT INTO orders VALUES (9999, 1, 1, 'x', now())",
      'OPTIMIZE TABLE orders FINAL',
      'SYSTEM DROP DNS CACHE',
      'ALTER TABLE orders DELETE WHERE 1',
    ]) {
      await expect(run(reader, readerSecrets, statement)).rejects.toBeInstanceOf(NqError)
    }
  })

  it('cancels a running query', async () => {
    await expectCancel(analyst, analystSecrets, heavy)
  })

  it('stops queries that exceed the time limit', async () => {
    const error = await failure(
      run(analyst, analystSecrets, heavy, { timeoutMs: 2000 }),
      analyst,
      'query',
      { timeoutSeconds: 2 }
    )
    expectCode(error, 'TIMEOUT')
  })

  it('explains wrong passwords and unknown databases', async () => {
    const wrong = await failure(registry.test(reader, { password: 'nope' }), reader, 'connect')
    expectCode(wrong, 'AUTH_FAILED')
    const missing = connection({ ...base, user: 'nq_admin', database: 'nope' })
    const unknown = await failure(
      registry.test(missing, { password: 'nq_admin_pw' }),
      missing,
      'connect'
    )
    expectCode(unknown, 'NOT_FOUND')
  })

  it('connects through an SSH tunnel', async () => {
    const tunneled = connection({
      ...base,
      host: 'clickhouse',
      port: 8123,
      user: 'nq_reader',
      ssh: SSH_TUNNEL,
    })
    const result = await run(
      tunneled,
      { ...readerSecrets, ...SSH_SECRETS },
      'SELECT count() FROM orders'
    )
    expect(result.rows).toEqual([[2500]])
  })
})

// ─── Cassandra ───────────────────────────────────────────────────────

describe.skipIf(!enabled)('Cassandra', () => {
  const base = {
    type: 'cassandra' as const,
    host: '127.0.0.1',
    port: 59042,
    cassandra: { datacenter: 'datacenter1', keyspace: 'shop' },
    tls: { mode: 'disable' as const },
  }
  const reader = connection(base)
  const secrets = {}

  beforeAll(async () => {
    const admin = new cassandra.Client({
      contactPoints: ['127.0.0.1:59042'],
      localDataCenter: 'datacenter1',
    })
    await admin.connect()
    await admin.execute(
      "CREATE KEYSPACE IF NOT EXISTS shop WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}"
    )
    await admin.execute(
      `CREATE TABLE IF NOT EXISTS shop.orders (
         customer_id int, order_no int, total decimal, status text, placed_at timestamp,
         id uuid, tags set<text>, attrs map<text, text>, lifetime bigint, note text,
         PRIMARY KEY ((customer_id), order_no)
       ) WITH CLUSTERING ORDER BY (order_no ASC)`
    )
    await admin.execute('CREATE TABLE IF NOT EXISTS shop.customers (id int PRIMARY KEY, name text)')
    await admin.execute('TRUNCATE shop.orders')
    const insert =
      'INSERT INTO shop.orders (customer_id, order_no, total, status, placed_at, id, tags, attrs, lifetime, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const rows = Array.from({ length: 2500 }, (_, i) => [
      i < 1500 ? 1 : 2,
      i + 1,
      cassandra.types.BigDecimal.fromString(`${((i + 1) * 1.25).toFixed(2)}`),
      i % 4 ? 'paid' : 'refunded',
      new Date(Date.UTC(2026, 1, (i % 28) + 1, 9, 30)),
      cassandra.types.Uuid.fromString('6f1c2a50-0000-4000-8000-000000000000'),
      ['vip'],
      { channel: 'web' },
      cassandra.types.Long.fromString('9007199254740993'),
      i === 0 ? 'Zoë Ünicode 名前' : null,
    ])
    for (let i = 0; i < rows.length; i += 100) {
      await Promise.all(
        rows.slice(i, i + 100).map((params) => admin.execute(insert, params, { prepare: true }))
      )
    }
    await admin.execute("INSERT INTO shop.customers (id, name) VALUES (1, 'Acme')")
    await admin.shutdown()
  })

  it('connects and reports the server version', async () => {
    expect((await registry.test(reader, secrets)).serverVersion).toMatch(/^Cassandra 5\./)
  })

  it('discovers tables with partition and clustering keys first', async () => {
    const { tables } = await registry.schema(reader, secrets)
    expect(tableNames(tables)).toEqual(['customers', 'orders'])
    const orders = tables.find((t) => t.name === 'orders')!
    expect(orders.columns.slice(0, 2)).toMatchObject([
      { name: 'customer_id', isPrimaryKey: true },
      { name: 'order_no', isPrimaryKey: true },
    ])
    const everything = connection({ ...base, cassandra: { datacenter: 'datacenter1' } })
    const all = await registry.schema(everything, secrets)
    expect(tableNames(all.tables)).toEqual(['shop.customers', 'shop.orders'])
  })

  it('returns exact values', async () => {
    const result = await run(
      reader,
      secrets,
      'SELECT total, placed_at, id, tags, attrs, lifetime, note FROM orders WHERE customer_id = 1 AND order_no = 1'
    )
    expect(result.rows[0]).toEqual([
      '1.25',
      '2026-02-01T09:30:00.000Z',
      '6f1c2a50-0000-4000-8000-000000000000',
      ['vip'],
      { channel: 'web' },
      '9007199254740993',
      'Zoë Ünicode 名前',
    ])
  })

  it('stops at the row limit and keeps smaller limits', async () => {
    const full = await run(reader, secrets, 'SELECT * FROM orders WHERE customer_id = 1')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    const limited = await run(
      reader,
      secrets,
      'SELECT * FROM orders WHERE customer_id = 1 LIMIT 7;'
    )
    expect(limited.rows).toHaveLength(7)
    expect(limited.truncated).toBe(false)
  })

  it('blocks writes', async () => {
    for (const statement of [
      'INSERT INTO orders (customer_id, order_no) VALUES (9, 9)',
      'DELETE FROM orders WHERE customer_id = 1',
      'TRUNCATE orders',
      'USE system',
    ]) {
      await expect(run(reader, secrets, statement)).rejects.toBeInstanceOf(NqError)
    }
  })

  it('names the data centers when the configured one is wrong', async () => {
    const wrong = connection({ ...base, cassandra: { datacenter: 'dc-east', keyspace: 'shop' } })
    const error = await failure(registry.test(wrong, secrets), wrong, 'connect')
    expectCode(error, 'VALIDATION')
    expect(error.hint).toMatch(/datacenter1/)
  })

  it('explains unknown keyspaces', async () => {
    const missing = connection({
      ...base,
      cassandra: { datacenter: 'datacenter1', keyspace: 'nope' },
    })
    const error = await failure(registry.test(missing, secrets), missing, 'connect')
    expectCode(error, 'NOT_FOUND')
  })

  it('connects through an SSH tunnel', async () => {
    const tunneled = connection({ ...base, host: 'cassandra', port: 9042, ssh: SSH_TUNNEL })
    const result = await run(
      tunneled,
      SSH_SECRETS,
      'SELECT count(*) FROM orders WHERE customer_id = 2'
    )
    expect(result.rows).toEqual([['1000']])
  })
})

// ─── DynamoDB ────────────────────────────────────────────────────────

describe.skipIf(!enabled)('DynamoDB', () => {
  const reader = connection({
    type: 'dynamodb',
    user: 'localtestkey',
    dynamodb: { region: 'us-east-1', endpoint: 'http://127.0.0.1:58000' },
  })
  const secrets = { secretAccessKey: 'localtestsecret' }

  beforeAll(async () => {
    const admin = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: 'http://127.0.0.1:58000',
      credentials: { accessKeyId: 'localtestkey', secretAccessKey: 'localtestsecret' },
    })
    const existing = (await admin.send(new ListTablesCommand({}))).TableNames ?? []
    for (const name of ['Customers', 'Orders']) {
      if (existing.includes(name)) await admin.send(new DeleteTableCommand({ TableName: name }))
    }
    await admin.send(
      new CreateTableCommand({
        TableName: 'Customers',
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      })
    )
    await admin.send(
      new CreateTableCommand({
        TableName: 'Orders',
        KeySchema: [
          { AttributeName: 'customerId', KeyType: 'HASH' },
          { AttributeName: 'orderNo', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'customerId', AttributeType: 'S' },
          { AttributeName: 'orderNo', AttributeType: 'N' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      })
    )
    const requests: WriteRequest[] = Array.from({ length: 30 }, (_, i) => ({
      PutRequest: {
        Item: {
          customerId: { S: i < 20 ? 'c-1' : 'c-2' },
          orderNo: { N: String(i + 1) },
          total: { N: ((i + 1) * 1.25).toFixed(2) },
          status: { S: i % 4 ? 'paid' : 'refunded' },
          lines: { L: [{ M: { sku: { S: 'X' }, qty: { N: '2' } } }] },
          tags: { SS: ['vip'] },
          lifetime: { N: '9007199254740993' },
        },
      },
    }))
    for (let i = 0; i < requests.length; i += 25) {
      await admin.send(
        new BatchWriteItemCommand({ RequestItems: { Orders: requests.slice(i, i + 25) } })
      )
    }
    await admin.send(
      new BatchWriteItemCommand({
        RequestItems: {
          Customers: [
            { PutRequest: { Item: { id: { S: 'c-1' }, name: { S: 'Zoë Ünicode 名前' } } } },
          ],
        },
      })
    )
    admin.destroy()
  })

  it('connects', async () => {
    expect((await registry.test(reader, secrets)).serverVersion).toBe('Amazon DynamoDB (us-east-1)')
  })

  it('discovers tables, keys and sampled attributes', async () => {
    const { tables } = await registry.schema(reader, secrets)
    expect(tableNames(tables)).toEqual(['"Customers"', '"Orders"'])
    const orders = tables.find((t) => t.name === 'Orders')!
    // DynamoDB returns attributes in no particular order.
    expect(
      orders.columns
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name)
        .sort()
    ).toEqual(['customerId', 'orderNo'])
    expect(orders.columns.find((c) => c.name === 'lines')?.type).toBe('array')
  })

  it('runs PartiQL and returns exact values', async () => {
    const result = await run(
      reader,
      secrets,
      `SELECT orderNo, total, lines, tags, lifetime FROM "Orders" WHERE customerId = 'c-1' AND orderNo = 2`
    )
    expect(result.rows).toHaveLength(1)
    const item = Object.fromEntries(result.columns.map((c, i) => [c.name, result.rows[0][i]]))
    expect(item).toEqual({
      orderNo: 2,
      total: 2.5,
      lines: [{ sku: 'X', qty: 2 }],
      tags: ['vip'],
      lifetime: '9007199254740993',
    })
    const unicode = await run(reader, secrets, `SELECT name FROM "Customers" WHERE id = 'c-1'`)
    expect(unicode.rows).toEqual([['Zoë Ünicode 名前']])
  })

  it('stops at the row limit', async () => {
    const result = await run(reader, secrets, 'SELECT * FROM "Orders"', { rowLimit: 10 })
    expect(result.rows).toHaveLength(10)
    expect(result.truncated).toBe(true)
    const all = await run(reader, secrets, 'SELECT * FROM "Orders"')
    expect(all.rows).toHaveLength(30)
    expect(all.truncated).toBe(false)
  })

  it('blocks writes', async () => {
    for (const statement of [
      `UPDATE "Orders" SET status = 'x' WHERE customerId = 'c-1' AND orderNo = 1`,
      `DELETE FROM "Orders" WHERE customerId = 'c-1' AND orderNo = 1`,
      `INSERT INTO "Orders" VALUE {'customerId': 'c-9', 'orderNo': 1}`,
    ]) {
      await expect(run(reader, secrets, statement)).rejects.toBeInstanceOf(NqError)
    }
  })

  it('explains unknown tables', async () => {
    const error = await failure(run(reader, secrets, 'SELECT * FROM "Nope"'), reader, 'query')
    expectCode(error, 'NOT_FOUND')
  })
})

// ─── libSQL ──────────────────────────────────────────────────────────

describe.skipIf(!enabled)('libSQL', () => {
  const reader = connection({ type: 'turso', turso: { url: 'http://127.0.0.1:58080' } })
  const secrets = {}

  beforeAll(async () => {
    const admin = createLibsqlClient({ url: 'http://127.0.0.1:58080' })
    await admin.batch(
      [
        'DROP VIEW IF EXISTS paid_orders',
        'DROP TABLE IF EXISTS orders',
        'DROP TABLE IF EXISTS customers',
        'CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, lifetime INTEGER)',
        `CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
           total REAL, status TEXT, placed_at TEXT)`,
        "CREATE VIEW paid_orders AS SELECT * FROM orders WHERE status = 'paid'",
        "INSERT INTO customers VALUES (1, 'Zoë Ünicode 名前', 9007199254740993), (2, 'Acme', 7)",
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2500)
         INSERT INTO orders SELECT i, 1 + i % 2, i * 1.25, CASE WHEN i % 4 = 0 THEN 'refunded' ELSE 'paid' END,
           '2026-02-01 09:30:00' FROM n`,
      ],
      'write'
    )
    admin.close()
  })

  it('connects and reports the server version', async () => {
    expect((await registry.test(reader, secrets)).serverVersion).toMatch(/^libSQL \(SQLite 3\./)
  })

  it('discovers tables, views, keys and relationships', async () => {
    const { tables } = await registry.schema(reader, secrets)
    expect(tableNames(tables)).toEqual(
      expect.arrayContaining(['customers', 'orders', 'paid_orders'])
    )
    const orders = tables.find((t) => t.name === 'orders')!
    expect(orders.foreignKeys).toContainEqual({
      column: 'customer_id',
      referencedTable: 'customers',
      referencedColumn: 'id',
    })
    expect(orders.columns.find((c) => c.name === 'id')).toMatchObject({ isPrimaryKey: true })
    expect(tables.find((t) => t.name === 'paid_orders')?.kind).toBe('view')
  })

  it('returns exact values', async () => {
    const result = await run(
      reader,
      secrets,
      'SELECT id, name, lifetime FROM customers ORDER BY id'
    )
    expect(result.rows).toEqual([
      [1, 'Zoë Ünicode 名前', '9007199254740993'],
      [2, 'Acme', 7],
    ])
  })

  it('stops at the row limit and keeps smaller limits', async () => {
    const full = await run(reader, secrets, 'SELECT * FROM orders ORDER BY id')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    const limited = await run(reader, secrets, 'SELECT * FROM orders ORDER BY id LIMIT 7')
    expect(limited.rows).toHaveLength(7)
    expect(limited.truncated).toBe(false)
  })

  it('blocks writes', async () => {
    await expect(run(reader, secrets, 'DELETE FROM orders')).rejects.toBeInstanceOf(NqError)
    await expect(run(reader, secrets, "ATTACH 'x.db' AS x")).rejects.toBeInstanceOf(NqError)
  })

  it('explains servers that cannot be reached', async () => {
    const closed = connection({ type: 'turso', turso: { url: 'http://127.0.0.1:58089' } })
    const error = await failure(registry.test(closed, secrets), closed, 'connect')
    expectCode(error, 'CONNECTION_REFUSED')
  })
})

// ─── Oracle ──────────────────────────────────────────────────────────

describe.skipIf(!enabled)('Oracle', () => {
  const base = {
    type: 'oracle' as const,
    host: '127.0.0.1',
    port: 51521,
    database: 'FREEPDB1',
    oracle: { connectAs: 'service' as const },
  }
  const reader = connection({ ...base, user: 'nq_reader' })
  const secrets = { password: 'nq_reader_pw' }
  const heavy = 'SELECT COUNT(*) FROM all_objects a, all_objects b, all_objects c'

  beforeAll(async () => {
    const owner = await oracledb.getConnection({
      user: 'nq_reader',
      password: 'nq_reader_pw',
      connectString: '127.0.0.1:51521/FREEPDB1',
    })
    const ignoreMissing = async (statement: string) => {
      try {
        await owner.execute(statement)
      } catch (error) {
        if (!/ORA-00942|ORA-04043/.test(String(error))) throw error
      }
    }
    await ignoreMissing('DROP VIEW big_spenders')
    await ignoreMissing('DROP TABLE "Order Details" PURGE')
    await ignoreMissing('DROP TABLE orders PURGE')
    await ignoreMissing('DROP TABLE customers PURGE')
    await owner.execute(`CREATE TABLE customers (
      id NUMBER(10) PRIMARY KEY, name NVARCHAR2(100) NOT NULL, signed_up DATE, last_seen TIMESTAMP(3),
      balance NUMBER(12,2), lifetime_orders NUMBER(20), notes CLOB)`)
    await owner.execute(`CREATE TABLE orders (
      id NUMBER(10) PRIMARY KEY, customer_id NUMBER(10) NOT NULL REFERENCES customers(id),
      total NUMBER(10,2), status VARCHAR2(20))`)
    await owner.execute('CREATE TABLE "Order Details" ("Line ID" NUMBER PRIMARY KEY, qty NUMBER)')
    await owner.execute(
      'CREATE VIEW big_spenders AS SELECT customer_id, SUM(total) AS spent FROM orders GROUP BY customer_id'
    )
    await owner.execute(
      `INSERT INTO customers VALUES (1, 'Zoë Ünicode 名前', DATE '2026-01-06', TIMESTAMP '2026-01-06 09:30:00.250',
        1235.5, 9007199254740993, 'long text')`
    )
    await owner.execute(
      `INSERT INTO orders SELECT LEVEL, 1, LEVEL * 1.25, CASE WHEN MOD(LEVEL, 4) = 0 THEN 'refunded' ELSE 'paid' END
       FROM dual CONNECT BY LEVEL <= 2500`
    )
    await owner.execute('INSERT INTO "Order Details" VALUES (1, 3)')
    await owner.commit()
    await owner.close()
  })

  it('connects and reports the server version', async () => {
    expect((await registry.test(reader, secrets)).serverVersion).toMatch(/^Oracle Database 23/)
  })

  it('discovers tables, views, keys and relationships', async () => {
    const { tables } = await registry.schema(reader, secrets)
    expect(tableNames(tables)).toEqual(
      expect.arrayContaining(['CUSTOMERS', 'ORDERS', 'BIG_SPENDERS', '"Order Details"'])
    )
    expect(tables.some((t) => t.schema === 'SYS' || t.schema === 'SYSTEM')).toBe(false)
    const orders = tables.find((t) => t.name === 'ORDERS')!
    expect(orders.foreignKeys).toContainEqual({
      column: 'CUSTOMER_ID',
      referencedTable: 'CUSTOMERS',
      referencedColumn: 'ID',
    })
    expect(orders.columns.find((c) => c.name === 'TOTAL')?.type).toBe('NUMBER(10,2)')
    expect(tables.find((t) => t.name === 'BIG_SPENDERS')?.kind).toBe('view')
  })

  it('returns exact values without time zone shifts', async () => {
    const result = await run(
      reader,
      secrets,
      'SELECT name, signed_up, last_seen, balance, lifetime_orders, notes FROM customers WHERE id = 1'
    )
    expect(result.rows[0]).toEqual([
      'Zoë Ünicode 名前',
      '2026-01-06 00:00:00',
      '2026-01-06 09:30:00.250',
      1235.5,
      '9007199254740993',
      'long text',
    ])
  })

  it('stops at the row limit and keeps smaller limits', async () => {
    const full = await run(reader, secrets, 'SELECT * FROM orders ORDER BY id;')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    const limited = await run(
      reader,
      secrets,
      'SELECT * FROM orders ORDER BY id FETCH FIRST 7 ROWS ONLY'
    )
    expect(limited.rows).toHaveLength(7)
    expect(limited.truncated).toBe(false)
  })

  it('blocks writes in the guard', async () => {
    for (const statement of [
      'DELETE FROM orders',
      'SELECT * FROM orders FOR UPDATE',
      'BEGIN DBMS_LOCK.SLEEP(1); END;',
      "SELECT UTL_HTTP.REQUEST('http://example.com') FROM dual",
    ]) {
      await expect(run(reader, secrets, statement)).rejects.toBeInstanceOf(NqError)
    }
  })

  it('cancels a running query', async () => {
    await expectCancel(reader, secrets, heavy)
  })

  it('stops queries that exceed the time limit', async () => {
    const error = await failure(run(reader, secrets, heavy, { timeoutMs: 2000 }), reader, 'query', {
      timeoutSeconds: 2,
    })
    expectCode(error, 'TIMEOUT')
  })

  it('explains wrong passwords and unknown service names', async () => {
    const wrong = await failure(registry.test(reader, { password: 'nope' }), reader, 'connect')
    expectCode(wrong, 'AUTH_FAILED')
    const missing = connection({ ...base, user: 'nq_reader', database: 'NOPE' })
    const unknown = await failure(registry.test(missing, secrets), missing, 'connect')
    expectCode(unknown, 'NOT_FOUND')
  })

  it('connects by SID', async () => {
    // FREE is the container database, where only common users such as SYSTEM exist.
    const sid = connection({
      ...base,
      user: 'system',
      database: 'FREE',
      oracle: { connectAs: 'sid' },
    })
    expect((await registry.test(sid, { password: 'nq_sys_pw' })).serverVersion).toMatch(/^Oracle/)
  })

  it('connects through an SSH tunnel', async () => {
    const tunneled = connection({
      ...base,
      host: 'oracle',
      port: 1521,
      user: 'nq_reader',
      ssh: SSH_TUNNEL,
    })
    const result = await run(
      tunneled,
      { ...secrets, ...SSH_SECRETS },
      'SELECT COUNT(*) FROM orders'
    )
    expect(result.rows).toEqual([[2500]])
  })
})
