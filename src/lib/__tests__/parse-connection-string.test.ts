import { describe, it, expect } from 'vitest'
import { parseConnectionString } from '../parse-connection-string'

// Helper: assert success and return the data object for further assertions
function ok(input: string) {
  const result = parseConnectionString(input)
  expect(result.success, `expected success for: ${input}`).toBe(true)
  if (!result.success) throw new Error('unreachable') // narrow type
  return result.data
}

// Helper: assert failure and return the error string
function fail(input: string) {
  const result = parseConnectionString(input)
  expect(result.success, `expected failure for: ${input}`).toBe(false)
  if (result.success) throw new Error('unreachable')
  return result.error
}

// ── Case 1: Standard URL ──────────────────────────────────────────────────

describe('Case 1: standard postgresql:// format', () => {
  it('parses all fields correctly', () => {
    const d = ok('postgresql://username:password@host:5432/dbname')
    expect(d.user).toBe('username')
    expect(d.password).toBe('password')
    expect(d.host).toBe('host')
    expect(d.port).toBe(5432)
    expect(d.database).toBe('dbname')
  })
})

// ── Case 2: sslmode query param ───────────────────────────────────────────

describe('Case 2: connection string with ?sslmode=require', () => {
  it('parses all fields and ignores the query string', () => {
    const d = ok('postgresql://user:pass@host:5432/db?sslmode=require')
    expect(d.user).toBe('user')
    expect(d.password).toBe('pass')
    expect(d.host).toBe('host')
    expect(d.port).toBe(5432)
    expect(d.database).toBe('db')
  })

  it('also handles multiple query params', () => {
    const d = ok('postgresql://user:pass@host:5432/db?sslmode=require&connect_timeout=10')
    expect(d.database).toBe('db')
  })
})

// ── Case 3: URL-encoded special characters in password ────────────────────

describe('Case 3: URL-encoded password', () => {
  it('decodes %40 → @ and %21 → !', () => {
    const d = ok('postgresql://user:p%40ss%21word@host:5432/db')
    expect(d.password).toBe('p@ss!word')
  })

  it('decodes %23 → # in password', () => {
    const d = ok('postgresql://user:p%23ass@host:5432/db')
    expect(d.password).toBe('p#ass')
  })

  it('decodes %2F → / in password', () => {
    const d = ok('postgresql://user:p%2Fass@host:5432/db')
    expect(d.password).toBe('p/ass')
  })

  it('decodes %25 → % in password', () => {
    const d = ok('postgresql://user:p%25ass@host:5432/db')
    expect(d.password).toBe('p%ass')
  })

  it('also decodes URL-encoded characters in username', () => {
    const d = ok('postgresql://user%40name:pass@host:5432/db')
    expect(d.user).toBe('user@name')
  })
})

// ── Case 4: Dots in username (Supabase style) ─────────────────────────────

describe('Case 4: dots in username and hostname (Supabase)', () => {
  it('parses postgres.projectref user correctly', () => {
    const d = ok(
      'postgresql://postgres.projectref:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
    )
    expect(d.user).toBe('postgres.projectref')
    expect(d.password).toBe('password')
    expect(d.host).toBe('aws-0-us-east-1.pooler.supabase.com')
    expect(d.port).toBe(6543)
    expect(d.database).toBe('postgres')
  })

  it('handles dotted hostname without dots in username', () => {
    const d = ok('postgresql://user:pass@db.example.com:5432/mydb')
    expect(d.host).toBe('db.example.com')
  })
})

// ── Case 5: postgres:// scheme alias ─────────────────────────────────────

describe('Case 5: postgres:// scheme alias', () => {
  it('accepts postgres:// as equivalent to postgresql://', () => {
    const d = ok('postgres://user:pass@host:5432/db')
    expect(d.user).toBe('user')
    expect(d.password).toBe('pass')
    expect(d.host).toBe('host')
    expect(d.port).toBe(5432)
    expect(d.database).toBe('db')
  })

  it('is case-insensitive on the scheme', () => {
    const d = ok('POSTGRES://user:pass@host:5432/db')
    expect(d.user).toBe('user')
  })

  it('is case-insensitive on POSTGRESQL scheme too', () => {
    const d = ok('POSTGRESQL://user:pass@host:5432/db')
    expect(d.user).toBe('user')
  })
})

// ── Case 6: Malformed strings ─────────────────────────────────────────────

describe('Case 6: malformed / unsupported strings', () => {
  it('rejects a plain non-URL string', () => {
    const err = fail('not-a-connection-string')
    expect(err).toContain('Invalid connection string format')
    expect(err).toContain('postgresql://user:password@host:port/database')
  })

  it('rejects mysql:// scheme', () => {
    const err = fail('mysql://user:pass@host:3306/db')
    expect(err).toContain('Invalid connection string format')
  })

  it('rejects a string missing the database segment', () => {
    // No /database at the end
    const err = fail('postgresql://user:pass@host:5432')
    expect(err).toContain('Invalid connection string format')
  })

  it('rejects a string missing the host', () => {
    const err = fail('postgresql://user:pass@:5432/db')
    expect(err).toContain('Invalid connection string format')
  })

  it('rejects jdbc connection strings', () => {
    const err = fail('jdbc:postgresql://host:5432/db')
    expect(err).toContain('Invalid connection string format')
  })
})

// ── Case 7: Empty / whitespace input ─────────────────────────────────────

describe('Case 7: empty or whitespace input', () => {
  it('returns failure with empty error for empty string', () => {
    const result = parseConnectionString('')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('')
  })

  it('returns failure with empty error for whitespace-only string', () => {
    const result = parseConnectionString('   \t\n  ')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('')
  })
})

// ── Optional fields ───────────────────────────────────────────────────────

describe('optional fields', () => {
  it('accepts connection string without a password', () => {
    const d = ok('postgresql://user@host:5432/db')
    expect(d.user).toBe('user')
    expect(d.password).toBe('')
  })

  it('returns null port when port is absent', () => {
    const d = ok('postgresql://user:pass@host/db')
    expect(d.port).toBeNull()
  })

  it('parses database name with hyphens and underscores', () => {
    const d = ok('postgresql://user:pass@host:5432/my_prod-db')
    expect(d.database).toBe('my_prod-db')
  })
})

// ── Real-world examples ───────────────────────────────────────────────────

describe('real-world connection strings', () => {
  it('Neon serverless', () => {
    const d = ok(
      'postgresql://neondb_owner:secretpass@ep-fancy-lake-a1b2c3d4.us-east-2.aws.neon.tech:5432/neondb?sslmode=require'
    )
    expect(d.host).toBe('ep-fancy-lake-a1b2c3d4.us-east-2.aws.neon.tech')
    expect(d.database).toBe('neondb')
    expect(d.port).toBe(5432)
  })

  it('Supabase direct connection', () => {
    const d = ok('postgresql://postgres:mypassword@db.abcdefghijkl.supabase.co:5432/postgres')
    expect(d.host).toBe('db.abcdefghijkl.supabase.co')
    expect(d.database).toBe('postgres')
  })

  it('Supabase transaction pooler with dot username', () => {
    const d = ok(
      'postgresql://postgres.abcdefghijkl:mypassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
    )
    expect(d.user).toBe('postgres.abcdefghijkl')
    expect(d.port).toBe(6543)
  })

  it('Railway', () => {
    const d = ok('postgresql://postgres:randompassword@roundhouse.proxy.rlwy.net:12345/railway')
    expect(d.host).toBe('roundhouse.proxy.rlwy.net')
    expect(d.database).toBe('railway')
  })

  it('Render managed PostgreSQL', () => {
    const d = ok('postgres://myuser:mypassword@dpg-abc123-a.oregon-postgres.render.com/mydb')
    expect(d.host).toBe('dpg-abc123-a.oregon-postgres.render.com')
    expect(d.port).toBeNull() // Render omits the port (defaults to 5432)
  })
})
