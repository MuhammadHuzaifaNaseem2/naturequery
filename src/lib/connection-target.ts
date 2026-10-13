/**
 * Where a database connection may point.
 *
 * On the hosted site NatureQuery connects only to public internet addresses: never
 * to its own server (localhost, files on disk), the cloud provider's internal
 * network, or the metadata service that hands out server credentials. Every host a
 * name resolves to is checked, not just the first.
 *
 * Self-hosted installs can allow private addresses with ALLOW_PRIVATE_DB_HOSTS=true.
 * Development allows them too, so local test databases keep working.
 */
import { lookup as dnsLookup, resolveSrv as dnsResolveSrv } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { DBCredentials } from '@/actions/db'
import type { DatabaseType } from '@/lib/db-drivers'
import { CLICKHOUSE_HTTP_PORTS } from '@/lib/driver-tls'

export class ConnectionTargetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectionTargetError'
  }
}

export interface TargetOptions {
  /** Allow private and local addresses (self-hosting, development). */
  allowPrivate?: boolean
  /** Resolves a host name to IP addresses. Defaults to the system resolver. */
  lookup?: (host: string) => Promise<string[]>
  /** Resolves an SRV name to target host names. Defaults to DNS. */
  resolveSrv?: (name: string) => Promise<string[]>
}

export function privateHostsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_DB_HOSTS === 'true' || process.env.NODE_ENV !== 'production'
}

// ── IP addresses ─────────────────────────────────────────────────────────

function isPrivateIPv4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, including cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved and broadcast
  )
}

/** The eight 16-bit groups of a valid IPv6 address. */
function ipv6Groups(ip: string): number[] {
  let text = ip
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (dotted) {
    const [p0, p1, p2, p3] = dotted.slice(1).map(Number)
    text = `${text.slice(0, dotted.index)}${((p0 << 8) | p1).toString(16)}:${((p2 << 8) | p3).toString(16)}`
  }
  const [head, tail] = text.split('::')
  const headParts = head ? head.split(':') : []
  const tailParts = tail === undefined ? [] : tail ? tail.split(':') : []
  const missing = tail === undefined ? 0 : 8 - headParts.length - tailParts.length
  return [...headParts, ...Array<string>(missing).fill('0'), ...tailParts].map((g) =>
    parseInt(g, 16)
  )
}

function embeddedIPv4(high: number, low: number): string {
  return [high >> 8, high & 255, low >> 8, low & 255].join('.')
}

/** True for any address that is not on the public internet. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  const family = isIP(ip)
  if (family === 4) return isPrivateIPv4(ip)
  if (family !== 6) return true

  const g = ipv6Groups(ip.toLowerCase())
  const zeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0)
  if (zeroUpTo(7) && (g[7] === 0 || g[7] === 1)) return true // :: and ::1
  if (zeroUpTo(5) && g[5] === 0xffff) return isPrivateIPv4(embeddedIPv4(g[6], g[7])) // ::ffff:a.b.c.d
  if (zeroUpTo(6)) return isPrivateIPv4(embeddedIPv4(g[6], g[7])) // ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPrivateIPv4(embeddedIPv4(g[6], g[7])) // NAT64
  if (g[0] === 0x2002) return isPrivateIPv4(embeddedIPv4(g[1], g[2])) // 6to4
  return (
    (g[0] & 0xfe00) === 0xfc00 || // unique local
    (g[0] & 0xffc0) === 0xfe80 || // link-local
    (g[0] & 0xffc0) === 0xfec0 || // old site-local
    (g[0] & 0xff00) === 0xff00 || // multicast
    (g[0] === 0x2001 && g[1] === 0x0db8) || // documentation
    (g[0] === 0x2001 && g[1] === 0) || // Teredo
    (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) // discard
  )
}

// ── Host names ───────────────────────────────────────────────────────────

const HOST_NAME =
  /^(?=.{1,253}$)[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)*\.?$/i
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan']

function invalidHost(host: string): never {
  throw new ConnectionTargetError(
    `"${host}" is not a valid server address. Enter only the host name, for example db.example.com.`
  )
}

function privateHost(host: string): never {
  throw new ConnectionTargetError(
    `NatureQuery's website can't connect to ${host}, because it is a private or local network address. ` +
      "Use the database's public address, or use NatureQuery Desktop for databases on your own network."
  )
}

/** A bare host name or IP address, with no port, path or other parts. */
function plainHost(raw: string): string {
  const host = raw.trim()
  if (isIP(host.replace(/^\[|\]$/g, ''))) return host.replace(/^\[|\]$/g, '')
  if (!HOST_NAME.test(host)) invalidHost(raw)
  return host.replace(/\.$/, '').toLowerCase()
}

/** Splits "host", "host:port" or "[ipv6]:port" and returns the host part. */
function hostOfHostPort(entry: string): string {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(entry)
  if (bracketed) return plainHost(bracketed[1])
  const colon = entry.lastIndexOf(':')
  if (colon > 0 && entry.indexOf(':') === colon) {
    if (!/^\d+$/.test(entry.slice(colon + 1))) invalidHost(entry)
    return plainHost(entry.slice(0, colon))
  }
  return plainHost(entry)
}

// ── What each database type connects to ──────────────────────────────────

interface Target {
  host: string
  /** A MongoDB +srv name, whose SRV records list the real hosts. */
  srv?: boolean
}

function mongoTargets(credentials: DBCredentials): Target[] {
  const value = credentials.host.trim()
  const scheme = /^(mongodb(?:\+srv)?):\/\//i.exec(value)
  if (!scheme) {
    // Same rule as the driver: no port and a dotted name means an Atlas-style SRV host.
    const host = plainHost(value)
    const srv = !credentials.port && host.includes('.') && isIP(host) === 0
    return [{ host, srv }]
  }
  const rest = value.slice(scheme[0].length)
  const authority = rest.split(/[/?]/)[0]
  const hosts = authority.slice(authority.lastIndexOf('@') + 1)
  if (!hosts) invalidHost(value)
  if (scheme[1].toLowerCase() === 'mongodb+srv') return [{ host: plainHost(hosts), srv: true }]
  return hosts.split(',').map((entry) => ({ host: hostOfHostPort(entry) }))
}

function targetsFor(
  credentials: DBCredentials,
  type: DatabaseType,
  allowPrivate: boolean
): Target[] {
  switch (type) {
    case 'magic': // uploaded files, stored by NatureQuery itself
    case 'bigquery': // Google's API
    case 'firestore':
      return []
    case 'dynamodb':
      // The AWS endpoint comes from the region, so the region must be a plain name.
      if (!/^[a-z]{2}(?:-[a-z]+)+-\d{1,2}$/.test(credentials.database.trim())) {
        throw new ConnectionTargetError(
          `"${credentials.database}" is not a valid AWS region. Use a region such as us-east-1.`
        )
      }
      return []
    case 'snowflake': {
      const account = credentials.host.trim()
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(account) || account.length > 200) {
        throw new ConnectionTargetError(
          `"${account}" is not a valid Snowflake account identifier. It looks like myorg-myaccount or xy12345.us-east-1.`
        )
      }
      const host = /\.snowflakecomputing\.(?:com|cn)$/i.test(account)
        ? account
        : `${account}.snowflakecomputing.com`
      return [{ host: host.toLowerCase() }]
    }
    case 'sqlite':
      if (allowPrivate) return []
      throw new ConnectionTargetError(
        "NatureQuery's website can't open database files. To query a SQLite file, use NatureQuery Desktop."
      )
    case 'turso': {
      let url: URL
      try {
        url = new URL(credentials.database.trim())
      } catch {
        throw new ConnectionTargetError(
          'Enter the Turso database URL, for example libsql://mydb-myorg.turso.io.'
        )
      }
      if (url.protocol === 'file:' && allowPrivate) return []
      const allowed = allowPrivate
        ? ['libsql:', 'https:', 'wss:', 'http:', 'ws:']
        : ['libsql:', 'https:', 'wss:']
      if (!allowed.includes(url.protocol)) {
        throw new ConnectionTargetError('Turso addresses start with libsql://, https:// or wss://.')
      }
      return [{ host: plainHost(url.hostname) }]
    }
    case 'mongodb':
      return mongoTargets(credentials)
    case 'sqlserver':
      // "host\instance" names a SQL Server instance on that host.
      return [{ host: plainHost(credentials.host.split('\\')[0]) }]
    case 'clickhouse':
      if (!allowPrivate && CLICKHOUSE_HTTP_PORTS.includes(credentials.port)) {
        throw new ConnectionTargetError(
          `Port ${credentials.port} is ClickHouse's unencrypted HTTP port, which would send your password as plain text. ` +
            'Use the HTTPS port instead, usually 8443.'
        )
      }
      return [{ host: plainHost(credentials.host) }]
    default:
      return [{ host: plainHost(credentials.host) }]
  }
}

// ── The check ────────────────────────────────────────────────────────────

const systemLookup = async (host: string) =>
  (await dnsLookup(host, { all: true, verbatim: true })).map((entry) => entry.address)
const systemResolveSrv = async (name: string) =>
  (await dnsResolveSrv(name)).map((record) => record.name)

async function addressesOf(host: string, lookup: (host: string) => Promise<string[]>) {
  if (isIP(host)) return [host]
  try {
    const addresses = await lookup(host)
    if (addresses.length) return addresses
  } catch {
    // reported below
  }
  throw new ConnectionTargetError(`Could not find the database server ${host}. Check the address.`)
}

/**
 * Throws ConnectionTargetError unless the connection points somewhere the hosted
 * site may connect to.
 */
export async function assertConnectionTarget(
  credentials: DBCredentials,
  type: DatabaseType,
  options: TargetOptions = {}
): Promise<void> {
  const allowPrivate = options.allowPrivate ?? privateHostsAllowed()
  const targets = targetsFor(credentials, type, allowPrivate)
  if (allowPrivate) return

  const lookup = options.lookup ?? systemLookup
  const resolveSrv = options.resolveSrv ?? systemResolveSrv
  for (const target of targets) {
    let names = [target.host]
    if (target.srv) {
      names = await resolveSrv(`_mongodb._tcp.${target.host}`).catch(() => [])
      if (!names.length) {
        throw new ConnectionTargetError(
          `Could not find the database server ${target.host}. Check the address.`
        )
      }
    }
    for (const name of names) {
      const host = plainHost(name)
      // A name without a dot is resolved inside the server's own network.
      const singleLabel = !host.includes('.') && isIP(host) === 0
      if (host === 'localhost' || singleLabel) privateHost(host)
      if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) privateHost(host)
      const addresses = await addressesOf(host, lookup)
      if (addresses.some(isPrivateAddress)) privateHost(host)
    }
  }
}
