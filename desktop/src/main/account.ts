import crypto from 'node:crypto'
import fs from 'node:fs'
import { NqError } from '@shared/errors'
import type { AccountUser, AuthState, ErrorCode, PlanUsage } from '@shared/types'
import { readJsonFile, writeJsonFile } from './json-file'
import type { SealedSecret, SecretBox } from './secure-store'

/**
 * The NatureQuery account on this computer. Signing in happens in the
 * browser (OAuth 2.0 with PKCE); the website sends the app back a one-time
 * code through naturequery://auth, or the user pastes it. Tokens are sealed
 * with the operating system's credential protection.
 */

const PENDING_TTL_MS = 10 * 60 * 1000
const REFRESH_MARGIN_MS = 60 * 1000
const AUTH_TIMEOUT_MS = 20_000
const CODE_PATTERN = /^nqd_code_[A-Za-z0-9_-]{20,100}$/

interface AccountFile {
  version: 1
  user: AccountUser
  plan?: PlanUsage
  accessToken: SealedSecret
  accessExpiresAt: number
  refreshToken: SealedSecret
}

interface Session {
  user: AccountUser
  plan?: PlanUsage
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: AccountUser
  plan?: PlanUsage
}

interface ApiErrorBody {
  error?: string
  message?: string
  retryAfter?: number
  plan?: PlanUsage
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface AccountOptions {
  apiBaseUrl: string
  file: string
  box: SecretBox
  fetch: FetchLike
  openExternal: (url: string) => Promise<void> | void
  emit: (state: AuthState) => void
  device: { name: string; platform: string; appVersion: string }
  log?: { info(message: string): void; warn(message: string, error?: unknown): void }
  now?: () => number
}

function base64url(bytes: number): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

function signedOutError(message = 'Sign in to NatureQuery to use AI features.'): NqError {
  return new NqError('SIGNED_OUT', message, {
    hint: 'Your SQL workspace, connections and history keep working without an account.',
  })
}

function networkError(error: unknown): NqError {
  const timedOut =
    (error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError'
  return new NqError(
    'NETWORK',
    timedOut ? 'NatureQuery took too long to answer.' : 'Could not reach NatureQuery.',
    {
      hint: 'Check your internet connection, VPN or proxy, then try again. Your local workspace keeps working offline.',
      detail: (error as Error)?.message,
    }
  )
}

export function createAccount(options: AccountOptions) {
  const now = options.now ?? Date.now
  const base = options.apiBaseUrl.replace(/\/+$/, '')
  let pending: { verifier: string; state: string; startedAt: number; url: string } | null = null
  let lastError: string | undefined
  let refreshing: Promise<void> | null = null
  let session: Session | null = load()

  // ─── Persistence ──────────────────────────────────────────────────

  function load(): Session | null {
    try {
      const data = readJsonFile<AccountFile | null>(options.file, null, 'account')
      if (!data || data.version !== 1 || !data.user?.id) return null
      return {
        user: data.user,
        plan: data.plan,
        accessToken: options.box.open(data.accessToken),
        accessExpiresAt: data.accessExpiresAt,
        refreshToken: options.box.open(data.refreshToken),
      }
    } catch (error) {
      // An unreadable sign-in (for example, profile copied from another
      // computer) simply means signing in again.
      options.log?.warn('Saved sign-in could not be restored', error)
      removeFile()
      return null
    }
  }

  function persist() {
    if (!session) {
      removeFile()
      return
    }
    const data: AccountFile = {
      version: 1,
      user: session.user,
      plan: session.plan,
      accessToken: options.box.seal(session.accessToken),
      accessExpiresAt: session.accessExpiresAt,
      refreshToken: options.box.seal(session.refreshToken),
    }
    writeJsonFile(options.file, data)
  }

  function removeFile() {
    try {
      fs.rmSync(options.file, { force: true })
    } catch (error) {
      options.log?.warn('Could not remove the saved sign-in', error)
    }
  }

  // ─── State ────────────────────────────────────────────────────────

  function state(): AuthState {
    if (session) return { status: 'signed-in', user: session.user, plan: session.plan }
    if (pending && now() - pending.startedAt < PENDING_TTL_MS) {
      return {
        status: 'pending',
        startedAt: new Date(pending.startedAt).toISOString(),
        authorizeUrl: pending.url,
      }
    }
    return lastError ? { status: 'signed-out', error: lastError } : { status: 'signed-out' }
  }

  function emit() {
    options.emit(state())
    lastError = undefined
  }

  function signOutLocally(reason?: string) {
    session = null
    pending = null
    lastError = reason
    persist()
    emit()
  }

  function useTokens(body: TokenResponse) {
    if (!body?.access_token || !body.refresh_token || !body.user?.id) {
      throw new NqError('SERVER', 'NatureQuery sent an unexpected sign-in response.', {
        hint: 'Try signing in again. If it keeps happening, contact support.',
      })
    }
    session = {
      user: body.user,
      plan: body.plan ?? session?.plan,
      accessToken: body.access_token,
      accessExpiresAt: now() + Math.max(60, body.expires_in) * 1000,
      refreshToken: body.refresh_token,
    }
    persist()
  }

  // ─── HTTP ─────────────────────────────────────────────────────────

  async function send(
    path: string,
    init: { method?: string; body?: unknown; token?: string; timeoutMs?: number }
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'
    if (init.token) headers.Authorization = `Bearer ${init.token}`
    try {
      return await options.fetch(`${base}${path}`, {
        method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(init.timeoutMs ?? AUTH_TIMEOUT_MS),
      })
    } catch (error) {
      throw networkError(error)
    }
  }

  async function readBody<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T
    } catch {
      return {} as T
    }
  }

  /** Turns an error response into an error the interface can show. */
  async function failure(response: Response): Promise<NqError> {
    const body = await readBody<ApiErrorBody>(response)
    if (body.plan && session) {
      session.plan = body.plan
      persist()
      emit()
    }
    const message = body.message || 'NatureQuery could not complete the request.'
    const byStatus: Record<number, ErrorCode> = {
      400: 'VALIDATION',
      401: 'SIGNED_OUT',
      402: 'PLAN_LIMIT',
      413: 'VALIDATION',
      429: 'RATE_LIMITED',
    }
    const code: ErrorCode = byStatus[response.status] ?? 'SERVER'
    const hint =
      code === 'PLAN_LIMIT'
        ? 'Upgrade your plan for unlimited AI questions, or keep writing SQL yourself, which is always free.'
        : code === 'RATE_LIMITED' || body.error === 'ai_busy'
          ? 'Wait a moment, then try again.'
          : code === 'SERVER'
            ? 'Try again in a moment. Your local workspace keeps working.'
            : undefined
    return new NqError(code, message, { hint, detail: body.error })
  }

  async function postToken(body: Record<string, unknown>): Promise<TokenResponse> {
    const response = await send('/api/desktop/token', {
      body: {
        ...body,
        device_name: options.device.name,
        platform: options.device.platform,
        app_version: options.device.appVersion,
      },
    })
    if (!response.ok) throw await failure(response)
    return readBody<TokenResponse>(response)
  }

  async function refresh(): Promise<void> {
    if (!session) throw signedOutError()
    // One refresh at a time: refresh tokens work once.
    refreshing ??= (async () => {
      const current = session
      try {
        const body = await postToken({
          grant_type: 'refresh_token',
          refresh_token: current!.refreshToken,
        })
        if (session === current) useTokens(body)
      } catch (error) {
        if (
          error instanceof NqError &&
          (error.code === 'VALIDATION' || error.code === 'SIGNED_OUT')
        ) {
          signOutLocally('You were signed out. Sign in again to use AI features.')
          throw signedOutError('You were signed out. Sign in again to use AI features.')
        }
        throw error
      } finally {
        refreshing = null
      }
    })()
    return refreshing
  }

  /** Calls the NatureQuery API as the signed-in user, refreshing tokens as needed. */
  async function request<T>(path: string, body?: unknown, timeoutMs = 90_000): Promise<T> {
    if (!session) throw signedOutError()
    if (session.accessExpiresAt - REFRESH_MARGIN_MS < now()) await refresh()
    let response = await send(path, { body, token: session!.accessToken, timeoutMs })
    if (response.status === 401) {
      await refresh()
      response = await send(path, { body, token: session!.accessToken, timeoutMs })
      if (response.status === 401) {
        signOutLocally('You were signed out. Sign in again to use AI features.')
        throw signedOutError()
      }
    }
    if (!response.ok) throw await failure(response)
    return readBody<T>(response)
  }

  // ─── Sign-in flow ─────────────────────────────────────────────────

  async function exchange(code: string) {
    if (!pending) {
      throw new NqError('VALIDATION', 'Start signing in from NatureQuery first.', {
        hint: 'Choose "Sign in" again, then approve NatureQuery Desktop in your browser.',
      })
    }
    if (!CODE_PATTERN.test(code)) {
      throw new NqError('VALIDATION', 'That is not a NatureQuery sign-in code.', {
        hint: 'Copy the whole code shown in your browser after choosing "Allow".',
      })
    }
    const { verifier } = pending
    const body = await postToken({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
    })
    pending = null
    useTokens(body)
    options.log?.info('Signed in to NatureQuery')
    emit()
  }

  return {
    state,

    isSignedIn(): boolean {
      return session !== null
    },

    /** Opens the browser to approve this app. */
    async signIn(): Promise<void> {
      const verifier = base64url(32)
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
      const stateValue = base64url(24)
      const url = new URL(`${base}/desktop/authorize`)
      url.searchParams.set('challenge', challenge)
      url.searchParams.set('state', stateValue)
      url.searchParams.set('device', options.device.name)
      pending = { verifier, state: stateValue, startedAt: now(), url: url.toString() }
      await options.openExternal(url.toString())
      emit()
    },

    cancel(): void {
      pending = null
      emit()
    },

    /** Handles naturequery://auth?code=...&state=... from the browser. Returns false for other links. */
    async handleCallback(raw: string): Promise<boolean> {
      let url: URL
      try {
        url = new URL(raw)
      } catch {
        return false
      }
      if (url.protocol !== 'naturequery:' || url.hostname !== 'auth') return false
      const returnedState = url.searchParams.get('state')
      if (
        !pending ||
        returnedState !== pending.state ||
        now() - pending.startedAt > PENDING_TTL_MS
      ) {
        options.log?.warn('Ignored a sign-in link that does not match the current sign-in')
        lastError = session
          ? undefined
          : 'That sign-in link was from an earlier attempt. Choose "Sign in" to start again.'
        emit()
        return true
      }
      if (url.searchParams.get('error')) {
        pending = null
        lastError = 'Sign-in was canceled in the browser.'
        emit()
        return true
      }
      try {
        await exchange(url.searchParams.get('code') ?? '')
      } catch (error) {
        pending = null
        lastError = (error as Error).message
        emit()
      }
      return true
    },

    /** For people whose browser could not open the app: paste the code shown on the page. */
    async submitCode(code: string): Promise<AuthState> {
      await exchange(code.trim())
      return state()
    },

    async signOut(): Promise<void> {
      const current = session
      signOutLocally()
      if (!current) return
      try {
        await send('/api/desktop/logout', {
          token: current.accessToken,
          body: { refresh_token: current.refreshToken },
          timeoutMs: 10_000,
        })
      } catch (error) {
        // Signing out on this computer already happened; the server session expires on its own.
        options.log?.warn('Could not tell NatureQuery about the sign-out', error)
      }
    },

    /** Reloads the user and plan, for example after the app starts. */
    async refreshProfile(): Promise<void> {
      if (!session) return
      const body = await request<{ user: AccountUser; plan?: PlanUsage }>(
        '/api/desktop/me',
        undefined,
        20_000
      )
      if (!session) return
      session.user = body.user ?? session.user
      session.plan = body.plan ?? session.plan
      persist()
      emit()
    },

    updatePlan(plan: PlanUsage | undefined): void {
      if (!session || !plan) return
      session.plan = plan
      persist()
      emit()
    },

    request,
  }
}

export type Account = ReturnType<typeof createAccount>
