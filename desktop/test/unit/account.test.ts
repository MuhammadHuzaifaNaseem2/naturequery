import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccount, type AccountOptions } from '../../src/main/account'
import { createSecretBox } from '../../src/main/secure-store'
import { aiSchema, sampleRows, MAX_AI_TABLES } from '../../src/main/ai-schema'
import { NqError } from '../../src/shared/errors'
import type { AuthState, SchemaSnapshot } from '../../src/shared/types'

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'dpapi',
  encryptString: (text: string) => Buffer.from(`sealed:${text}`).reverse(),
  decryptString: (data: Buffer) =>
    Buffer.from(data)
      .reverse()
      .toString()
      .replace(/^sealed:/, ''),
}

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | undefined
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

let directory: string
let calls: Call[]
let states: AuthState[]
let opened: string[]
let routes: Record<string, (call: Call) => Response | Promise<Response>>
let clock: number

function tokens(n: number, expiresIn = 3600) {
  return {
    access_token: `nqd_at_access${n}`,
    refresh_token: `nqd_rt_refresh${n}`,
    expires_in: expiresIn,
    user: { id: 'u1', email: 'ana@example.com', name: 'Ana' },
    plan: {
      planName: 'Free',
      queryLimit: 50,
      queriesUsed: n,
      periodEndsAt: '2026-11-01T00:00:00Z',
    },
  }
}

function options(overrides: Partial<AccountOptions> = {}): AccountOptions {
  return {
    apiBaseUrl: 'https://naturequery.test',
    file: path.join(directory, 'account.json'),
    box: createSecretBox(fakeSafeStorage),
    fetch: async (url, init) => {
      const headers = (init.headers ?? {}) as Record<string, string>
      const call: Call = {
        url,
        method: init.method ?? 'GET',
        headers,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      const route = routes[`${call.method} ${new URL(url).pathname}`]
      if (!route) return json(404, { error: 'not_found', message: 'Not found' })
      return route(call)
    },
    openExternal: (url) => {
      opened.push(url)
    },
    emit: (state) => states.push(state),
    device: { name: 'Office-PC', platform: 'win32', appVersion: '0.9.0' },
    now: () => clock,
    ...overrides,
  }
}

async function signedIn(account: ReturnType<typeof createAccount>, n = 1) {
  routes['POST /api/desktop/token'] = () => json(200, tokens(n))
  await account.signIn()
  const state = new URL(opened.at(-1)!).searchParams.get('state')
  await account.handleCallback(`naturequery://auth?code=nqd_code_${'a'.repeat(30)}&state=${state}`)
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-account-'))
  calls = []
  states = []
  opened = []
  routes = {}
  clock = 1_000_000
})

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('desktop sign-in', () => {
  it('opens the browser with a PKCE challenge and exchanges the returned code', async () => {
    const account = createAccount(options())
    routes['POST /api/desktop/token'] = () => json(200, tokens(1))
    await account.signIn()

    const url = new URL(opened[0])
    expect(url.origin + url.pathname).toBe('https://naturequery.test/desktop/authorize')
    expect(url.searchParams.get('device')).toBe('Office-PC')
    expect(account.state()).toMatchObject({ status: 'pending', authorizeUrl: opened[0] })

    const code = `nqd_code_${'b'.repeat(40)}`
    await account.handleCallback(
      `naturequery://auth?code=${code}&state=${url.searchParams.get('state')}`
    )
    const exchange = calls.find((call) => call.url.endsWith('/api/desktop/token'))!
    expect(exchange.body).toMatchObject({
      grant_type: 'authorization_code',
      code,
      device_name: 'Office-PC',
      platform: 'win32',
      app_version: '0.9.0',
    })
    const verifier = String(exchange.body!.code_verifier)
    expect(crypto.createHash('sha256').update(verifier).digest('base64url')).toBe(
      url.searchParams.get('challenge')
    )
    expect(account.state()).toMatchObject({
      status: 'signed-in',
      user: { email: 'ana@example.com' },
    })

    // Tokens are stored sealed, never as plain text.
    const saved = fs.readFileSync(path.join(directory, 'account.json'), 'utf8')
    expect(saved).not.toContain('nqd_at_access1')
    expect(saved).not.toContain('nqd_rt_refresh1')
    expect(createAccount(options()).state()).toMatchObject({ status: 'signed-in' })
  })

  it('ignores links from another sign-in attempt and reports browser cancellations', async () => {
    const account = createAccount(options())
    await account.signIn()
    expect(await account.handleCallback('naturequery://auth?code=nqd_code_x&state=forged')).toBe(
      true
    )
    expect(states.at(-1)).toMatchObject({ status: 'pending' })
    expect(calls).toHaveLength(0)

    const state = new URL(opened[0]).searchParams.get('state')
    await account.handleCallback(`naturequery://auth?error=access_denied&state=${state}`)
    expect(states.at(-1)).toEqual({
      status: 'signed-out',
      error: 'Sign-in was canceled in the browser.',
    })
    expect(await account.handleCallback('https://example.com')).toBe(false)
  })

  it('accepts a pasted code and rejects anything else', async () => {
    const account = createAccount(options())
    await expect(account.submitCode(`nqd_code_${'c'.repeat(30)}`)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    routes['POST /api/desktop/token'] = () => json(200, tokens(1))
    await account.signIn()
    await expect(account.submitCode('hello')).rejects.toThrow('not a NatureQuery sign-in code')
    expect((await account.submitCode(`  nqd_code_${'c'.repeat(30)}  `)).status).toBe('signed-in')
  })

  it('refreshes expired tokens once, even for parallel requests', async () => {
    const account = createAccount(options())
    await signedIn(account, 1)
    let refreshes = 0
    routes['POST /api/desktop/token'] = (call) => {
      expect(call.body).toMatchObject({
        grant_type: 'refresh_token',
        refresh_token: 'nqd_rt_refresh1',
      })
      refreshes++
      return json(200, tokens(2))
    }
    routes['GET /api/desktop/me'] = (call) =>
      call.headers.Authorization === 'Bearer nqd_at_access2'
        ? json(200, { user: { id: 'u1', email: 'ana@example.com' } })
        : json(401, { error: 'invalid_token' })
    clock += 2 * 60 * 60 * 1000
    await Promise.all([account.request('/api/desktop/me'), account.request('/api/desktop/me')])
    expect(refreshes).toBe(1)
  })

  it('retries once after a rejected access token, and signs out when refresh fails', async () => {
    const account = createAccount(options())
    await signedIn(account, 1)
    routes['GET /api/desktop/me'] = () => json(401, { error: 'invalid_token' })
    routes['POST /api/desktop/token'] = () =>
      json(400, { error: 'invalid_grant', message: 'You were signed out of NatureQuery Desktop.' })
    await expect(account.request('/api/desktop/me')).rejects.toMatchObject({ code: 'SIGNED_OUT' })
    expect(account.state()).toEqual({ status: 'signed-out' })
    expect(states.at(-1)).toMatchObject({
      status: 'signed-out',
      error: expect.stringMatching(/signed out/),
    })
    expect(fs.existsSync(path.join(directory, 'account.json'))).toBe(false)
  })

  it('keeps the sign-in when the network is down', async () => {
    const box = createSecretBox(fakeSafeStorage)
    fs.writeFileSync(
      path.join(directory, 'account.json'),
      JSON.stringify({
        version: 1,
        user: { id: 'u1', email: 'ana@example.com' },
        accessToken: box.seal('nqd_at_x'),
        accessExpiresAt: clock - 1,
        refreshToken: box.seal('nqd_rt_x'),
      })
    )
    const offline = createAccount(
      options({
        fetch: async () => {
          throw new TypeError('net::ERR_INTERNET_DISCONNECTED')
        },
      })
    )
    expect(offline.state().status).toBe('signed-in')
    await expect(offline.request('/api/desktop/me')).rejects.toMatchObject({ code: 'NETWORK' })
    expect(offline.state().status).toBe('signed-in')
  })

  it('explains plan limits and keeps the plan up to date', async () => {
    const account = createAccount(options())
    await signedIn(account, 1)
    routes['POST /api/desktop/ai/generate'] = () =>
      json(402, {
        error: 'plan_limit',
        message: 'You have used all 50 AI questions included in the Free plan this month.',
        plan: {
          planName: 'Free',
          queryLimit: 50,
          queriesUsed: 50,
          periodEndsAt: '2026-11-01T00:00:00Z',
        },
      })
    const error = await account
      .request('/api/desktop/ai/generate', { question: 'x' })
      .catch((e) => e)
    expect(error).toBeInstanceOf(NqError)
    expect(error).toMatchObject({ code: 'PLAN_LIMIT', hint: expect.stringMatching(/Upgrade/) })
    expect(account.state()).toMatchObject({ plan: { queriesUsed: 50 } })
  })

  it('signs out here even when the server cannot be told', async () => {
    const account = createAccount(options())
    await signedIn(account, 1)
    routes['POST /api/desktop/logout'] = () => {
      throw new TypeError('offline')
    }
    await account.signOut()
    expect(account.state()).toEqual({ status: 'signed-out' })
    expect(calls.at(-1)).toMatchObject({
      url: 'https://naturequery.test/api/desktop/logout',
      body: { refresh_token: 'nqd_rt_refresh1' },
    })
  })

  it('forgets a saved sign-in that cannot be unlocked', () => {
    fs.writeFileSync(
      path.join(directory, 'account.json'),
      JSON.stringify({
        version: 1,
        user: { id: 'u1', email: 'ana@example.com' },
        accessToken: { method: 'os', value: '!!' },
        accessExpiresAt: 0,
        refreshToken: { method: 'os', value: '!!' },
      })
    )
    const broken = createAccount(
      options({
        box: createSecretBox({
          ...fakeSafeStorage,
          decryptString: () => {
            throw new Error('wrong user')
          },
        }),
      })
    )
    expect(broken.state()).toEqual({ status: 'signed-out' })
    expect(fs.existsSync(path.join(directory, 'account.json'))).toBe(false)
  })
})

describe('schema for AI requests', () => {
  function table(name: string, columns: string[], references: string[] = []) {
    return {
      name,
      kind: 'table' as const,
      qualifiedName: name,
      columns: columns.map((column, index) => ({
        name: column,
        type: 'text',
        nullable: index > 0,
        isPrimaryKey: index === 0,
      })),
      foreignKeys: references.map((target) => ({
        column: `${target}_id`,
        referencedTable: target,
        referencedColumn: 'id',
      })),
    }
  }

  it('sends names, types, keys and relationships only', () => {
    const snapshot: SchemaSnapshot = {
      fetchedAt: '',
      tables: [
        table('customers', ['id', 'city']),
        { ...table('orders', ['id', 'total'], ['customers']), rowEstimate: 2500 },
      ],
    }
    expect(aiSchema(snapshot, 'revenue by city')).toEqual([
      {
        name: 'customers',
        kind: 'table',
        rows: undefined,
        columns: [
          { name: 'id', type: 'text', key: true, nullable: false },
          { name: 'city', type: 'text', key: undefined, nullable: true },
        ],
        references: undefined,
      },
      {
        name: 'orders',
        kind: 'table',
        rows: 2500,
        columns: [
          { name: 'id', type: 'text', key: true, nullable: false },
          { name: 'total', type: 'text', key: undefined, nullable: true },
        ],
        references: [{ column: 'customers_id', table: 'customers', tableColumn: 'id' }],
      },
    ])
  })

  it('narrows very large schemas to related tables and what they reference', () => {
    const tables = Array.from({ length: 1000 }, (_, i) =>
      table(`audit_log_${i}`, ['id', 'payload'])
    )
    tables.push(table('invoice_lines', ['id', 'amount'], ['invoices']))
    tables.push(table('invoices', ['id', 'issued_at']))
    const chosen = aiSchema({ fetchedAt: '', tables }, 'total invoice line amounts').map(
      (t) => t.name
    )
    expect(chosen.length).toBeLessThanOrEqual(MAX_AI_TABLES)
    expect(chosen.slice(0, 2)).toEqual(['invoice_lines', 'invoices'])
  })

  it('shortens long values in result samples', () => {
    const rows = sampleRows([['x'.repeat(500), { nested: 'y'.repeat(500) }, 42]])
    expect(String(rows[0][0])).toHaveLength(201)
    expect(String(rows[0][1])).toMatch(/…$/)
    expect(rows[0][2]).toBe(42)
    expect(sampleRows(Array.from({ length: 80 }, () => [1]))).toHaveLength(50)
  })
})

vi.setConfig({ testTimeout: 20000 })
