// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DBCredentials } from '@/actions/db'
import { assertConnectionTarget, isPrivateAddress, privateHostsAllowed } from '../connection-target'
import { createDriver, type DatabaseType } from '../db-drivers'

const dns: Record<string, string[]> = {
  'db.example.com': ['93.184.215.14'],
  'h1.example.com': ['93.184.215.15'],
  'h2.example.com': ['10.1.2.3'],
  'both.example.com': ['93.184.215.16', '192.168.1.20'],
  'rebind.example.com': ['127.0.0.1'],
  'shard-00.mongo.example.net': ['34.1.2.3'],
  'shard-01.mongo.example.net': ['34.1.2.4'],
  'private.example.net': ['172.20.0.5'],
  'xy12345.us-east-1.snowflakecomputing.com': ['52.1.2.3'],
  'mydb-myorg.turso.io': ['66.1.2.3'],
}
const srv: Record<string, string[]> = {
  '_mongodb._tcp.cluster0.mongo.example.net': [
    'shard-00.mongo.example.net',
    'shard-01.mongo.example.net',
  ],
  '_mongodb._tcp.inside.example.net': ['shard-00.mongo.example.net', 'private.example.net'],
}
const hosted = {
  allowPrivate: false,
  lookup: async (host: string) => {
    if (!dns[host]) throw new Error('ENOTFOUND')
    return dns[host]
  },
  resolveSrv: async (name: string) => {
    if (!srv[name]) throw new Error('ENOTFOUND')
    return srv[name]
  },
}

const creds = (host: string, extra: Partial<DBCredentials> = {}): DBCredentials => ({
  host,
  port: 5432,
  database: 'app',
  user: 'u',
  password: 'p',
  ...extra,
})
const check = (type: DatabaseType, host: string, extra: Partial<DBCredentials> = {}) =>
  assertConnectionTarget(creds(host, extra), type, hosted)

describe('private addresses', () => {
  it('flags private, local and reserved IPv4', () => {
    for (const ip of [
      '10.0.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '100.64.0.1',
      '0.0.0.0',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '93.184.215.14', '172.32.0.1', '100.128.0.1', '11.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('flags private IPv6, including IPv4 addresses carried inside it', () => {
    for (const ip of [
      '::1',
      '::',
      '[::1]',
      'fd00::1',
      'fe80::1%eth0',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:10.0.0.1',
      '64:ff9b::a00:1',
      '2002:c0a8:101::1',
      '2001:db8::1',
      '100::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public IPv6', () => {
    for (const ip of ['2606:4700:4700::1111', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('treats anything that is not an IP address as unsafe', () => {
    expect(isPrivateAddress('db.example.com')).toBe(true)
  })
})

describe('database addresses on the hosted site', () => {
  it('allows public hosts', async () => {
    await expect(check('postgresql', 'db.example.com')).resolves.toBeUndefined()
    await expect(check('mysql', 'DB.Example.com.')).resolves.toBeUndefined()
    await expect(check('sqlserver', 'db.example.com\\SQLEXPRESS')).resolves.toBeUndefined()
  })

  it('refuses private, local and metadata addresses', async () => {
    for (const host of [
      '10.0.0.5',
      '127.0.0.1',
      '169.254.169.254',
      '::1',
      '[fd00::1]',
      'localhost',
      'postgres',
      'db.internal',
      'metadata.google.internal',
      'printer.local',
      'h2.example.com',
      'both.example.com',
      'rebind.example.com',
    ]) {
      await expect(check('postgresql', host), host).rejects.toThrow(
        /private or local network address/
      )
    }
  })

  it('refuses addresses with extra parts', async () => {
    for (const host of [
      'db.example.com/x',
      'user@db.example.com',
      'db.example.com:8123',
      'db example.com',
      'http://db.example.com',
      'db.example.com?x=1',
    ]) {
      await expect(check('clickhouse', host), host).rejects.toThrow(/not a valid server address/)
    }
  })

  it('reports unknown hosts plainly', async () => {
    await expect(check('postgresql', 'missing.example.com')).rejects.toThrow(
      'Could not find the database server missing.example.com. Check the address.'
    )
  })

  it('checks every MongoDB host, including the ones SRV records list', async () => {
    await expect(
      check('mongodb', 'cluster0.mongo.example.net', { port: 0 })
    ).resolves.toBeUndefined()
    await expect(
      check('mongodb', 'mongodb+srv://u:p@cluster0.mongo.example.net/app?retryWrites=true')
    ).resolves.toBeUndefined()
    await expect(
      check('mongodb', 'mongodb://u:p@h1.example.com:27017,db.example.com/app')
    ).resolves.toBeUndefined()
    await expect(
      check('mongodb', 'mongodb://u:p@h1.example.com:27017,h2.example.com:27017/app')
    ).rejects.toThrow(/private/)
    await expect(check('mongodb', 'inside.example.net', { port: 0 })).rejects.toThrow(/private/)
    await expect(check('mongodb', 'mongodb://u:p@[::1]:27017/app')).rejects.toThrow(/private/)
  })

  it('keeps Turso on remote addresses', async () => {
    await expect(
      check('turso', '', { database: 'libsql://mydb-myorg.turso.io' })
    ).resolves.toBeUndefined()
    await expect(check('turso', '', { database: 'file:/var/task/app.db' })).rejects.toThrow(
      /libsql:\/\//
    )
    await expect(check('turso', '', { database: 'https://10.0.0.5:8080' })).rejects.toThrow(
      /private/
    )
  })

  it('never opens database files on the server', async () => {
    await expect(check('sqlite', '', { database: '/var/task/prisma/dev.db' })).rejects.toThrow(
      /can't open database files/
    )
  })

  it('checks Snowflake accounts and AWS regions', async () => {
    await expect(check('snowflake', 'xy12345.us-east-1')).resolves.toBeUndefined()
    await expect(check('snowflake', 'evil.example.com/x?')).rejects.toThrow(/Snowflake account/)
    await expect(check('dynamodb', '', { database: 'us-east-1' })).resolves.toBeUndefined()
    await expect(check('dynamodb', '', { database: 'us-east-1.evil.com' })).rejects.toThrow(
      /AWS region/
    )
  })

  it('leaves uploaded files and Google services alone', async () => {
    for (const type of ['magic', 'bigquery', 'firestore'] as DatabaseType[]) {
      await expect(check(type, '')).resolves.toBeUndefined()
    }
  })
})

describe('self-hosting and development', () => {
  const allow = { ...hosted, allowPrivate: true }
  afterEach(() => vi.unstubAllEnvs())

  it('allows private addresses and database files', async () => {
    await expect(
      assertConnectionTarget(creds('10.0.0.5'), 'postgresql', allow)
    ).resolves.toBeUndefined()
    await expect(
      assertConnectionTarget(creds('localhost'), 'mysql', allow)
    ).resolves.toBeUndefined()
    await expect(
      assertConnectionTarget(creds('', { database: '/data/app.db' }), 'sqlite', allow)
    ).resolves.toBeUndefined()
  })

  it('still refuses addresses with extra parts', async () => {
    await expect(
      assertConnectionTarget(creds('db.example.com/x'), 'clickhouse', allow)
    ).rejects.toThrow(/not a valid server address/)
  })

  it('allows private addresses outside production, or when the setting is on', () => {
    vi.stubEnv('ALLOW_PRIVATE_DB_HOSTS', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(privateHostsAllowed()).toBe(false)
    vi.stubEnv('ALLOW_PRIVATE_DB_HOSTS', 'true')
    expect(privateHostsAllowed()).toBe(true)
    vi.stubEnv('ALLOW_PRIVATE_DB_HOSTS', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(privateHostsAllowed()).toBe(true)
  })
})

describe('drivers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('check the address before they connect', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_PRIVATE_DB_HOSTS', '')
    const driver = createDriver(creds('127.0.0.1'), 'postgresql')
    await expect(driver.testConnection()).rejects.toThrow(/private or local network address/)
    await expect(driver.executeQuery('SELECT 1')).rejects.toThrow(
      /private or local network address/
    )
    await driver.close()
  })
})
