import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sql from 'mssql'
import { createRegistry } from '../../src/engine/registry'
import { describeError } from '../../src/engine/errors'
import { NqError } from '../../src/shared/errors'
import type {
  ConnectionConfig,
  ConnectionSecrets,
  ErrorCode,
  QueryResult,
} from '../../src/shared/types'

// Runs against the disposable databases in test/integration/docker-compose.yml.
// Set NQ_IT=1 to enable. Never point these tests at a real database.
const enabled = process.env.NQ_IT === '1'
const registry = createRegistry()
afterAll(() => registry.closeAll())

function connection(
  partial: Partial<ConnectionConfig> & Pick<ConnectionConfig, 'type'>
): ConnectionConfig {
  return { id: crypto.randomUUID(), name: 'integration', createdAt: '', updatedAt: '', ...partial }
}

async function run(
  config: ConnectionConfig,
  secrets: ConnectionSecrets,
  text: string,
  options: Partial<{ rowLimit: number; timeoutMs: number; queryId: string }> = {}
): Promise<QueryResult> {
  const startedAt = Date.now()
  const result = await registry.query(config, secrets, text, {
    queryId: options.queryId ?? crypto.randomUUID(),
    rowLimit: options.rowLimit ?? 1000,
    timeoutMs: options.timeoutMs ?? 30_000,
  })
  return { ...result, rowCount: result.rows.length, durationMs: Date.now() - startedAt }
}

/** Expects a failure and returns the user-facing error the app would show. */
async function failure(
  pending: Promise<unknown>,
  config: ConnectionConfig,
  phase: 'connect' | 'query' | 'schema',
  extra: { canceled?: boolean; timeoutSeconds?: number } = {}
) {
  try {
    await pending
  } catch (error) {
    return describeError(error, {
      type: config.type,
      host: config.host,
      port: config.port,
      database: config.database,
      phase,
      ...extra,
    })
  }
  throw new Error('Expected the operation to fail')
}

function expectCode(error: { code: ErrorCode }, code: ErrorCode) {
  expect(error.code, JSON.stringify(error)).toBe(code)
}

function tableNames(tables: { qualifiedName: string }[]) {
  return tables.map((table) => table.qualifiedName)
}

/** Starts a long query, cancels it after a moment and checks it stops quickly. */
async function expectCancel(
  config: ConnectionConfig,
  secrets: ConnectionSecrets,
  longQuery: string
) {
  const queryId = crypto.randomUUID()
  const startedAt = Date.now()
  // Attach the failure handler right away, so the rejection is never unhandled.
  const outcome = failure(
    run(config, secrets, longQuery, { queryId, timeoutMs: 60_000 }),
    config,
    'query',
    { canceled: true }
  )
  await new Promise((resolve) => setTimeout(resolve, 1500))
  await registry.cancel(queryId)
  const error = await outcome
  expectCode(error, 'CANCELED')
  expect(Date.now() - startedAt).toBeLessThan(10_000)
}

// ─── PostgreSQL ──────────────────────────────────────────────────────

describe.skipIf(!enabled)('PostgreSQL', () => {
  const base = { type: 'postgresql' as const, host: '127.0.0.1', port: 55432, database: 'acme' }
  const reader = connection({ ...base, user: 'nq_reader', tls: { mode: 'prefer' } })
  const readerSecrets = { password: 'nq_reader_pw' }
  const admin = connection({ ...base, user: 'nq_admin', tls: { mode: 'prefer' } })
  const adminSecrets = { password: 'nq_admin_pw' }

  it('connects and reports the server version', async () => {
    const result = await registry.test(reader, readerSecrets)
    expect(result.serverVersion).toMatch(/^PostgreSQL 17/)
  })

  it('discovers schemas, quoted names, views, keys and relationships', async () => {
    const { tables } = await registry.schema(reader, readerSecrets)
    expect(tableNames(tables)).toEqual(
      expect.arrayContaining([
        'sales.customers',
        'sales.orders',
        'sales.big_spenders',
        '"Order Details"',
      ])
    )
    const customers = tables.find((t) => t.qualifiedName === 'sales.customers')!
    expect(customers.columns.find((c) => c.name === 'id')).toMatchObject({
      isPrimaryKey: true,
      nullable: false,
    })
    expect(customers.columns.find((c) => c.name === 'balance')?.type).toBe('numeric(12,2)')
    const orders = tables.find((t) => t.qualifiedName === 'sales.orders')!
    expect(orders.foreignKeys).toContainEqual({
      column: 'customer_id',
      referencedTable: 'sales.customers',
      referencedColumn: 'id',
    })
    expect(tables.find((t) => t.name === 'big_spenders')?.kind).toBe('view')
    expect(tables.some((t) => /pg_catalog|information_schema/.test(t.qualifiedName))).toBe(false)
  })

  it('returns exact values without time zone shifts', async () => {
    const result = await run(
      reader,
      readerSecrets,
      'SELECT signed_up, birthday, balance, lifetime_orders, active, tags, profile, avatar FROM sales.customers WHERE id = 1'
    )
    expect(result.columns.map((c) => c.name)).toEqual([
      'signed_up',
      'birthday',
      'balance',
      'lifetime_orders',
      'active',
      'tags',
      'profile',
      'avatar',
    ])
    expect(result.rows[0]).toEqual([
      '2026-01-06 09:30:00',
      '1990-01-02',
      '1235.50',
      '9007199254740994',
      false,
      ['vip', 'east'],
      { tier: 'gold', n: 1 },
      '0x0102ff',
    ])
    const unicode = await run(
      reader,
      readerSecrets,
      'SELECT name FROM sales.customers WHERE id = 51'
    )
    expect(unicode.rows[0][0]).toBe('Zoë Ünicode 名前')
  })

  it('keeps duplicate column names and reads quoted tables', async () => {
    const duplicate = await run(reader, readerSecrets, 'SELECT 1 AS a, 2 AS a')
    expect(duplicate.columns.map((c) => c.name)).toEqual(['a', 'a'])
    expect(duplicate.rows).toEqual([[1, 2]])
    const quoted = await run(
      reader,
      readerSecrets,
      'SELECT * FROM "Order Details" ORDER BY "Line ID"'
    )
    expect(quoted.columns.map((c) => c.name)).toEqual(['Line ID', 'Order', 'qty'])
    expect(quoted.rows).toHaveLength(20)
  })

  it('stops at the row limit and reports it', async () => {
    const full = await run(reader, readerSecrets, 'SELECT * FROM sales.orders ORDER BY id')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    const small = await run(reader, readerSecrets, 'SELECT * FROM sales.orders ORDER BY id', {
      rowLimit: 100,
    })
    expect(small.rows).toHaveLength(100)
    const limited = await run(
      reader,
      readerSecrets,
      'SELECT * FROM sales.orders ORDER BY id LIMIT 7;'
    )
    expect(limited.rows).toHaveLength(7)
    expect(limited.truncated).toBe(false)
    const cte = await run(
      reader,
      readerSecrets,
      'WITH recent AS (SELECT * FROM sales.orders ORDER BY id DESC LIMIT 3) SELECT count(*) FROM recent'
    )
    expect(cte.rows).toEqual([[3]])
  })

  it('blocks writes in the guard and in the read-only transaction', async () => {
    await expect(run(admin, adminSecrets, 'DELETE FROM sales.orders')).rejects.toBeInstanceOf(
      NqError
    )
    const error = await failure(
      run(admin, adminSecrets, 'SELECT sales.sneaky_write()'),
      admin,
      'query'
    )
    expectCode(error, 'READ_ONLY')
    const count = await run(admin, adminSecrets, 'SELECT count(*) FROM sales.orders')
    expect(count.rows[0][0]).toBe(2500)
  })

  it('cancels a running query on the server', async () => {
    await expectCancel(reader, readerSecrets, 'SELECT pg_sleep(30)')
    // The pool is still healthy afterwards.
    expect((await run(reader, readerSecrets, 'SELECT 42 AS answer')).rows).toEqual([[42]])
  })

  it('stops queries that exceed the time limit', async () => {
    const error = await failure(
      run(reader, readerSecrets, 'SELECT pg_sleep(10)', { timeoutMs: 1500 }),
      reader,
      'query',
      { timeoutSeconds: 1.5 }
    )
    expectCode(error, 'TIMEOUT')
  })

  it('explains wrong passwords, databases and ports', async () => {
    expectCode(
      await failure(registry.test(reader, { password: 'wrong' }), reader, 'connect'),
      'AUTH_FAILED'
    )
    const missing = connection({ ...base, database: 'nope', user: 'nq_admin' })
    expectCode(await failure(registry.test(missing, adminSecrets), missing, 'connect'), 'NOT_FOUND')
    const closed = connection({ ...base, port: 1, user: 'nq_reader' })
    expectCode(
      await failure(registry.test(closed, readerSecrets), closed, 'connect'),
      'CONNECTION_REFUSED'
    )
  })

  it('applies each connection security mode', async () => {
    // The test server has TLS turned off, like many PostgreSQL servers on a company network.
    await expect(
      registry.test(
        connection({ ...base, user: 'nq_reader', tls: { mode: 'disable' } }),
        readerSecrets
      )
    ).resolves.toBeTruthy()
    await expect(
      registry.test(
        connection({ ...base, user: 'nq_reader', tls: { mode: 'prefer' } }),
        readerSecrets
      )
    ).resolves.toBeTruthy()
    for (const mode of ['require', 'verify-full'] as const) {
      const strict = connection({ ...base, user: 'nq_reader', tls: { mode } })
      const error = await failure(registry.test(strict, readerSecrets), strict, 'connect')
      expectCode(error, 'TLS')
      expect(error.hint).toMatch(/Prefer encryption/)
    }
  })

  it('connects through an SSH tunnel and pins the server key', async () => {
    const ssh = {
      enabled: true,
      host: '127.0.0.1',
      port: 52222,
      user: 'tunnel',
      auth: 'password' as const,
    }
    // "postgres" resolves on the SSH server's network, not on this computer.
    const tunneled = connection({ ...base, host: 'postgres', port: 5432, user: 'nq_reader', ssh })
    const secrets = { ...readerSecrets, sshPassword: 'tunnel_pw' }
    const result = await registry.test(tunneled, secrets)
    expect(result.sshHostKey).toMatch(/^SHA256:/)
    const pinned = connection({
      ...tunneled,
      ssh: { ...ssh, hostKeyFingerprint: result.sshHostKey },
    })
    expect((await run(pinned, secrets, 'SELECT count(*) FROM sales.orders')).rows).toEqual([[2500]])
    const spoofed = connection({
      ...tunneled,
      ssh: { ...ssh, hostKeyFingerprint: 'SHA256:not-the-real-key' },
    })
    const error = await failure(registry.test(spoofed, secrets), spoofed, 'connect')
    expectCode(error, 'SSH')
    expect(error.message).toMatch(/identity/)
    const wrongPassword = await failure(
      registry.test(tunneled, { ...readerSecrets, sshPassword: 'nope' }),
      tunneled,
      'connect'
    )
    expectCode(wrongPassword, 'SSH')
  })
})

// ─── MySQL and MariaDB ───────────────────────────────────────────────

for (const flavor of [
  { label: 'MySQL', type: 'mysql' as const, port: 53306, version: /^MySQL 8\.4/ },
  { label: 'MariaDB', type: 'mariadb' as const, port: 53307, version: /^MariaDB 11/ },
]) {
  describe.skipIf(!enabled)(flavor.label, () => {
    const base = { type: flavor.type, host: '127.0.0.1', port: flavor.port, database: 'acme' }
    const reader = connection({ ...base, user: 'nq_reader', tls: { mode: 'prefer' } })
    const secrets = { password: 'nq_reader_pw' }
    // A per-row condition stops the optimizer from simply multiplying table counts.
    const heavy =
      'SELECT COUNT(*) FROM orders a, orders b, orders c WHERE a.total + b.total + c.total > 1499 + MOD(a.id, 7)'

    it('connects and reports the server version', async () => {
      expect((await registry.test(reader, secrets)).serverVersion).toMatch(flavor.version)
    })

    it('discovers tables, views, keys and relationships', async () => {
      const { tables } = await registry.schema(reader, secrets)
      expect(tableNames(tables)).toEqual(
        expect.arrayContaining(['customers', 'orders', 'big_spenders', '`Order Details`'])
      )
      expect(
        tables.find((t) => t.name === 'customers')?.columns.find((c) => c.name === 'id')
          ?.isPrimaryKey
      ).toBe(true)
      expect(tables.find((t) => t.name === 'orders')?.foreignKeys).toContainEqual({
        column: 'customer_id',
        referencedTable: 'customers',
        referencedColumn: 'id',
      })
      expect(tables.find((t) => t.name === 'big_spenders')?.kind).toBe('view')
    })

    it('returns exact values', async () => {
      const result = await run(
        reader,
        secrets,
        'SELECT signed_up, birthday, balance, lifetime_orders, active, profile, avatar FROM customers WHERE id = 1'
      )
      const [signedUp, birthday, balance, lifetime, active, profile, avatar] = result.rows[0]
      expect(signedUp).toBe('2026-01-06 09:30:00')
      expect(birthday).toBe('1990-01-02')
      expect(balance).toBe('1235.50')
      expect(lifetime).toBe('9007199254740994')
      expect(active).toBe(0)
      expect(typeof profile === 'string' ? JSON.parse(profile) : profile).toEqual({
        tier: 'gold',
        n: 1,
      })
      expect(avatar).toBe('0x0102ff')
      expect(
        (await run(reader, secrets, 'SELECT name FROM customers WHERE id = 51')).rows[0][0]
      ).toBe('Zoë Ünicode 名前')
    })

    it('limits rows and keeps smaller limits', async () => {
      const full = await run(reader, secrets, 'SELECT * FROM orders ORDER BY id')
      expect(full.rows).toHaveLength(1000)
      expect(full.truncated).toBe(true)
      const limited = await run(reader, secrets, 'SELECT * FROM orders ORDER BY id LIMIT 5')
      expect(limited.rows).toHaveLength(5)
      expect(limited.truncated).toBe(false)
      expect((await run(reader, secrets, 'SELECT * FROM `Order Details`')).rows).toHaveLength(20)
      expect((await run(reader, secrets, 'SHOW TABLES')).rows.length).toBeGreaterThanOrEqual(4)
    })

    it('blocks writes and locking reads', async () => {
      await expect(run(reader, secrets, 'DELETE FROM orders')).rejects.toBeInstanceOf(NqError)
      await expect(run(reader, secrets, 'SELECT * FROM orders FOR UPDATE')).rejects.toBeInstanceOf(
        NqError
      )
      await expect(
        run(reader, secrets, "SELECT * FROM orders INTO OUTFILE '/tmp/x'")
      ).rejects.toBeInstanceOf(NqError)
    })

    it('cancels a running query on the server', async () => {
      await expectCancel(reader, secrets, heavy)
      expect((await run(reader, secrets, 'SELECT 42 AS answer')).rows).toEqual([[42]])
    })

    it('stops queries that exceed the time limit', async () => {
      const error = await failure(
        run(reader, secrets, heavy, { timeoutMs: 1500 }),
        reader,
        'query',
        { timeoutSeconds: 1.5 }
      )
      expectCode(error, 'TIMEOUT')
    })

    it('explains wrong passwords and unknown databases', async () => {
      expectCode(
        await failure(registry.test(reader, { password: 'wrong' }), reader, 'connect'),
        'AUTH_FAILED'
      )
      const missing = connection({ ...base, database: 'nope', user: 'root' })
      const error = await failure(
        registry.test(missing, { password: 'nq_root_pw' }),
        missing,
        'connect'
      )
      expectCode(error, 'NOT_FOUND')
    })

    it('applies each connection security mode', async () => {
      for (const mode of ['disable', 'prefer', 'require'] as const) {
        await expect(
          registry.test(connection({ ...base, user: 'nq_reader', tls: { mode } }), secrets)
        ).resolves.toBeTruthy()
      }
      // The server certificate is self-signed, so strict verification must refuse it.
      const strict = connection({ ...base, user: 'nq_reader', tls: { mode: 'verify-full' } })
      expectCode(await failure(registry.test(strict, secrets), strict, 'connect'), 'TLS')
    })
  })
}

// ─── SQL Server ──────────────────────────────────────────────────────

describe.skipIf(!enabled)('SQL Server', () => {
  const base = {
    type: 'sqlserver' as const,
    host: '127.0.0.1',
    port: 51433,
    database: 'acme',
    sqlserver: { auth: 'sql' as const, encrypt: true, trustServerCertificate: true },
  }
  const reader = connection({ ...base, user: 'nq_reader' })
  const secrets = { password: 'Reader_Pw_2026!' }
  // A per-row condition stops the optimizer from simply multiplying table counts.
  const heavy =
    'SELECT COUNT_BIG(*) FROM sys.all_objects a CROSS JOIN sys.all_objects b CROSS JOIN sys.all_objects c WHERE CHECKSUM(a.name, b.name, c.name) % 7 = 3'

  beforeAll(async () => {
    const adminConfig = {
      server: '127.0.0.1',
      port: 51433,
      user: 'sa',
      password: 'Nq_Test_Pw_2026!',
      options: { encrypt: true, trustServerCertificate: true },
    }
    const master = await new sql.ConnectionPool(adminConfig).connect()
    try {
      await master
        .request()
        .batch(
          "IF DB_ID('acme') IS NOT NULL BEGIN ALTER DATABASE acme SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE acme END"
        )
      await master.request().batch('CREATE DATABASE acme')
      await master
        .request()
        .batch(
          "IF SUSER_ID('nq_reader') IS NULL CREATE LOGIN nq_reader WITH PASSWORD = 'Reader_Pw_2026!', CHECK_POLICY = OFF"
        )
    } finally {
      await master.close()
    }
    // CREATE SCHEMA and CREATE VIEW must each be alone in a batch.
    const admin = await new sql.ConnectionPool({ ...adminConfig, database: 'acme' }).connect()
    try {
      const statements = [
        'CREATE SCHEMA sales',
        `CREATE TABLE sales.customers (id INT PRIMARY KEY, name NVARCHAR(100) NOT NULL, signed_up DATETIME2(0), birthday DATE,
           balance DECIMAL(12,2), lifetime_orders BIGINT, active BIT, avatar VARBINARY(16), seen_at DATETIMEOFFSET(0))`,
        `CREATE TABLE sales.orders (id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES sales.customers(id),
           ordered_on DATE NOT NULL, total DECIMAL(12,2) NOT NULL, status NVARCHAR(20) NOT NULL)`,
        'CREATE TABLE dbo.[Order Details] ([Line ID] INT PRIMARY KEY, [Order] INT, qty INT)',
        `CREATE VIEW sales.big_spenders AS SELECT c.name, SUM(o.total) AS spent
           FROM sales.customers c JOIN sales.orders o ON o.customer_id = c.id GROUP BY c.name`,
        `WITH n AS (SELECT TOP (50) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects)
         INSERT INTO sales.customers SELECT n, CONCAT('Customer ', n), DATEADD(DAY, n, '2026-01-05 09:30:00'),
           DATEADD(DAY, n, '1990-01-01'), 1234.50 + n, 9007199254740993 + n, n % 2, 0x0102FF, '2026-01-05 09:30:00 +05:00' FROM n`,
        "INSERT INTO sales.customers (id, name) VALUES (51, N'Zoë Ünicode 名前')",
        `WITH n AS (SELECT TOP (2500) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects a CROSS JOIN sys.all_objects b)
         INSERT INTO sales.orders SELECT n, 1 + n % 50, DATEADD(DAY, n % 365, '2025-01-01'), (n % 500) + 0.99,
           CHOOSE(1 + n % 3, 'completed', 'shipped', 'canceled') FROM n`,
        `WITH n AS (SELECT TOP (20) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects)
         INSERT INTO dbo.[Order Details] SELECT n, n, 1 + n % 5 FROM n`,
        'CREATE USER nq_reader FOR LOGIN nq_reader',
        'ALTER ROLE db_datareader ADD MEMBER nq_reader',
        'GRANT VIEW DATABASE STATE TO nq_reader',
      ]
      for (const statement of statements) await admin.request().batch(statement)
    } finally {
      await admin.close()
    }
  }, 120_000)

  it('connects and reports the server version', async () => {
    expect((await registry.test(reader, secrets)).serverVersion).toMatch(/SQL Server 2022/)
  })

  it('discovers schemas, keys, views and row counts', async () => {
    const { tables } = await registry.schema(reader, secrets)
    expect(tableNames(tables)).toEqual(
      expect.arrayContaining([
        'sales.customers',
        'sales.orders',
        'sales.big_spenders',
        'dbo.[Order Details]',
      ])
    )
    expect(
      tables
        .find((t) => t.qualifiedName === 'sales.customers')
        ?.columns.find((c) => c.name === 'id')?.isPrimaryKey
    ).toBe(true)
    expect(tables.find((t) => t.qualifiedName === 'sales.orders')?.foreignKeys).toContainEqual({
      column: 'customer_id',
      referencedTable: 'sales.customers',
      referencedColumn: 'id',
    })
    expect(tables.find((t) => t.qualifiedName === 'sales.orders')?.rowEstimate).toBe(2500)
    expect(
      tables
        .find((t) => t.qualifiedName === 'sales.customers')
        ?.columns.find((c) => c.name === 'balance')?.type
    ).toBe('decimal(12,2)')
  })

  it('returns stored date and time values unchanged', async () => {
    const result = await run(
      reader,
      secrets,
      'SELECT signed_up, birthday, balance, lifetime_orders, active, avatar, seen_at FROM sales.customers WHERE id = 1'
    )
    const [signedUp, birthday, balance, lifetime, active, avatar, seenAt] = result.rows[0]
    expect(signedUp).toBe('2026-01-06 09:30:00')
    expect(birthday).toBe('1990-01-02')
    expect(Number(balance)).toBe(1235.5)
    expect(lifetime).toBe('9007199254740994')
    expect(active).toBe(true)
    expect(avatar).toBe('0x0102ff')
    expect(seenAt).toBe('2026-01-05T04:30:00.000Z')
    expect(
      (await run(reader, secrets, 'SELECT name FROM sales.customers WHERE id = 51')).rows[0][0]
    ).toBe('Zoë Ünicode 名前')
  })

  it('limits rows without rewriting the query', async () => {
    const full = await run(reader, secrets, 'SELECT * FROM sales.orders ORDER BY id')
    expect(full.rows).toHaveLength(1000)
    expect(full.truncated).toBe(true)
    expect((await run(reader, secrets, 'SELECT TOP 5 * FROM sales.orders')).rows).toHaveLength(5)
    expect(
      (
        await run(
          reader,
          secrets,
          'SELECT * FROM sales.orders ORDER BY id OFFSET 10 ROWS FETCH NEXT 3 ROWS ONLY'
        )
      ).rows
    ).toHaveLength(3)
    const cte = await run(
      reader,
      secrets,
      'WITH x AS (SELECT TOP 3 id FROM sales.orders) SELECT COUNT(*) AS n FROM x'
    )
    expect(cte.rows).toEqual([[3]])
    // ROWCOUNT does not leak into later queries on the same pooled session.
    expect((await run(reader, secrets, 'SELECT COUNT(*) FROM sales.orders')).rows).toEqual([[2500]])
    expect((await run(reader, secrets, 'SELECT * FROM dbo.[Order Details]')).rows).toHaveLength(20)
  })

  it('blocks writes', async () => {
    await expect(run(reader, secrets, 'DELETE FROM sales.orders')).rejects.toBeInstanceOf(NqError)
    await expect(
      run(reader, secrets, 'SELECT * INTO #copy FROM sales.orders')
    ).rejects.toBeInstanceOf(NqError)
    await expect(run(reader, secrets, "EXEC xp_cmdshell 'dir'")).rejects.toBeInstanceOf(NqError)
  })

  it('cancels a running query', async () => {
    await expectCancel(reader, secrets, heavy)
    expect((await run(reader, secrets, 'SELECT 42 AS answer')).rows).toEqual([[42]])
  })

  it('stops queries that exceed the time limit', async () => {
    let caught: unknown
    try {
      await run(reader, secrets, heavy, { timeoutMs: 1500 })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(NqError)
    expect((caught as NqError).code).toBe('TIMEOUT')
  })

  it('explains wrong passwords and certificate problems', async () => {
    expectCode(
      await failure(registry.test(reader, { password: 'wrong' }), reader, 'connect'),
      'AUTH_FAILED'
    )
    const strict = connection({
      ...base,
      user: 'nq_reader',
      sqlserver: { auth: 'sql', encrypt: true, trustServerCertificate: false },
    })
    expectCode(await failure(registry.test(strict, secrets), strict, 'connect'), 'TLS')
    const plain = connection({
      ...base,
      user: 'nq_reader',
      sqlserver: { auth: 'sql', encrypt: false, trustServerCertificate: false },
    })
    await expect(registry.test(plain, secrets)).resolves.toBeTruthy()
  })
})
