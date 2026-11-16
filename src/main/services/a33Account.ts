import fs from 'node:fs/promises'

import { safeStorage } from 'electron'

import { application } from '@application'
import { loggerService } from '@logger'
import { a33AccountErrorCodes } from '@shared/ipc/errors/a33Account'
import { IpcError } from '@shared/ipc/errors/IpcError'
import type { A33AccountStatus, A33ApiKeys, A33KeyKind, A33LoginResult } from '@shared/ipc/schemas/a33Account'

const logger = loggerService.withContext('A33Account')

const BASE_URL = 'https://a33.club'
const KEY_NAME = 'A33 Studio'
// The a33 provider speaks Anthropic Messages, so its key must belong to an Anthropic-platform group.
const CHAT_GROUP_PLATFORM = 'anthropic'

interface Session {
  accessToken: string
  refreshToken?: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
}

type LoginResponse = TokenResponse | { requires_2fa: true; temp_token: string; user_email_masked: string }

interface A33Group {
  id: number
  platform: string
  name?: string
}

interface A33ApiKey {
  key: string
  group_id: number | null
  group?: A33Group | null
}

/** sub2api error: `reason` from handler errors, or the string `code` the JWT middleware uses. */
class A33ApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string
  ) {
    super(message)
  }
}

let cachedSession: Session | null | undefined
let refreshing: Promise<Session> | null = null

function sessionFile(): string {
  return application.getPath('feature.a33_account.session_file')
}

async function readSession(): Promise<Session | null> {
  if (cachedSession !== undefined) return cachedSession
  try {
    cachedSession = JSON.parse(safeStorage.decryptString(await fs.readFile(sessionFile()))) as Session
  } catch {
    cachedSession = null
  }
  return cachedSession
}

async function writeSession(session: Session | null): Promise<void> {
  cachedSession = session
  if (!session) {
    await fs.rm(sessionFile(), { force: true })
    return
  }
  // Without an OS key store the session lives in memory only; tokens are never written in plain text.
  if (!safeStorage.isEncryptionAvailable()) return
  await fs.writeFile(sessionFile(), safeStorage.encryptString(JSON.stringify(session)), { mode: 0o600 })
}

async function request<T>(
  pathname: string,
  { method = 'GET', body, token }: { method?: string; body?: unknown; token?: string } = {}
): Promise<T> {
  const response = await fetch(BASE_URL + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const payload = (await response.json().catch(() => null)) as {
    code?: number | string
    message?: string
    reason?: string
    data?: T
  } | null
  if (!response.ok || (typeof payload?.code === 'number' && payload.code !== 0)) {
    const reason = payload?.reason ?? (typeof payload?.code === 'string' ? payload.code : '')
    throw new A33ApiError(response.status, reason, payload?.message || `HTTP ${response.status}`)
  }
  return payload?.data as T
}

/** Single-flight: the refresh token is single-use, so concurrent 401s must share one refresh. */
function refreshSession(session: Session & { refreshToken: string }): Promise<Session> {
  refreshing ??= (async () => {
    try {
      const tokens = await request<TokenResponse>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refresh_token: session.refreshToken }
      })
      const next = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? session.refreshToken }
      await writeSession(next)
      return next
    } catch (error) {
      if (error instanceof A33ApiError && error.status === 401) await writeSession(null)
      throw error
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function authed<T>(pathname: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = await readSession()
  if (!session) throw new A33ApiError(401, 'NOT_SIGNED_IN', 'Not signed in to a33.club')
  try {
    return await request<T>(pathname, { ...init, token: session.accessToken })
  } catch (error) {
    if (!(error instanceof A33ApiError) || error.status !== 401) throw error
    // Another call may already have refreshed while this one was in flight.
    const latest = await readSession()
    let next: Session | null = null
    if (latest && latest.accessToken !== session.accessToken) next = latest
    else if (latest?.refreshToken) next = await refreshSession({ ...latest, refreshToken: latest.refreshToken })
    if (!next) {
      await writeSession(null)
      throw error
    }
    return request<T>(pathname, { ...init, token: next.accessToken })
  }
}

function toIpcError(error: unknown, invalidCodeMeans2fa = false): unknown {
  if (!(error instanceof A33ApiError)) return error
  if (error.status === 429) return new IpcError(a33AccountErrorCodes.RATE_LIMITED, error.message)
  if (error.reason === 'USER_NOT_ACTIVE' || error.reason === 'USER_INACTIVE') {
    return new IpcError(a33AccountErrorCodes.INACTIVE, error.message)
  }
  if (error.status === 401 || error.status === 400) {
    return new IpcError(
      invalidCodeMeans2fa ? a33AccountErrorCodes.INVALID_2FA_CODE : a33AccountErrorCodes.INVALID_CREDENTIALS,
      error.message
    )
  }
  return new Error(error.message)
}

/**
 * Which a33.club groups serve each key kind — the split the a33.club key dialog uses: text groups run on
 * the Anthropic platform, 生图 on OpenAI, and 生视频 is its own named group (on the Grok platform).
 */
const KEY_KIND_GROUPS: Record<A33KeyKind, (group: A33Group) => boolean> = {
  chat: (group) => group.platform === CHAT_GROUP_PLATFORM,
  image: (group) => group.platform === 'openai',
  video: (group) => (group.name ?? '').includes('视频') || group.platform === 'grok'
}
const KEY_NAMES: Record<A33KeyKind, string> = {
  chat: KEY_NAME,
  image: `${KEY_NAME} 生图`,
  video: `${KEY_NAME} 生视频`
}

/**
 * For each requested kind, an active key of the account on a matching group, creating one on the first
 * matching group when the account has none. Kinds with no matching group are left out.
 */
export async function provisionKeys(input: { keyKinds: A33KeyKind[] }): Promise<A33ApiKeys> {
  if (input.keyKinds.length === 0) return {}
  const groupsData = await a33Request<A33Group[] | { items?: A33Group[] }>('/api/v1/groups/available')
  const groups = Array.isArray(groupsData) ? groupsData : (groupsData.items ?? [])
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const keys = (await a33Request<{ items: A33ApiKey[] }>('/api/v1/keys?status=active&page_size=100')).items

  const result: A33ApiKeys = {}
  for (const kind of input.keyKinds) {
    const matches = KEY_KIND_GROUPS[kind]
    const existing = keys.find((key) => {
      const group = key.group ?? (key.group_id === null ? undefined : groupById.get(key.group_id))
      return !!group && matches(group)
    })
    if (existing) {
      result[kind] = existing.key
      continue
    }
    const group = groups.find(matches)
    if (!group) continue
    const created = await a33Request<A33ApiKey>('/api/v1/keys', {
      method: 'POST',
      body: { name: KEY_NAMES[kind], group_id: group.id }
    })
    result[kind] = created.key
  }
  return result
}

async function finishLogin(tokens: TokenResponse, keyKinds: A33KeyKind[]): Promise<A33LoginResult> {
  await writeSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token })
  try {
    return { status: 'signed_in', apiKeys: await provisionKeys({ keyKinds }) }
  } catch (error) {
    // Signed in either way; the client retries later and the key prompts still cover a missing key.
    logger.warn('Could not provision a33 API keys after login', error as Error)
    return { status: 'signed_in', apiKeys: {} }
  }
}

export async function login(input: {
  email: string
  password: string
  keyKinds: A33KeyKind[]
}): Promise<A33LoginResult> {
  let result: LoginResponse
  try {
    result = await request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email: input.email.trim(), password: input.password }
    })
  } catch (error) {
    throw toIpcError(error)
  }
  if ('requires_2fa' in result) {
    return { status: 'requires_2fa', tempToken: result.temp_token, maskedEmail: result.user_email_masked }
  }
  return finishLogin(result, input.keyKinds)
}

export async function loginWith2fa(input: {
  tempToken: string
  code: string
  keyKinds: A33KeyKind[]
}): Promise<A33LoginResult> {
  let tokens: TokenResponse
  try {
    tokens = await request<TokenResponse>('/api/v1/auth/login/2fa', {
      method: 'POST',
      body: { temp_token: input.tempToken, totp_code: input.code }
    })
  } catch (error) {
    throw toIpcError(error, true)
  }
  return finishLogin(tokens, input.keyKinds)
}

export async function logout(): Promise<void> {
  const session = await readSession()
  await writeSession(null)
  if (!session?.refreshToken) return
  // Server-side revoke is best effort; the local session is already gone.
  await request('/api/v1/auth/logout', { method: 'POST', body: { refresh_token: session.refreshToken } }).catch(
    (error) => logger.warn('a33.club logout request failed', error as Error)
  )
}

/**
 * Authenticated a33.club call for other A33 services (billing, usage). Errors cross IPC as
 * NOT_SIGNED_IN / RATE_LIMITED, or as REQUEST_FAILED carrying the server's own message.
 */
export async function a33Request<T>(pathname: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    return await authed<T>(pathname, init)
  } catch (error) {
    if (!(error instanceof A33ApiError)) throw error
    if (error.status === 401) throw new IpcError(a33AccountErrorCodes.NOT_SIGNED_IN, error.message)
    if (error.status === 429) throw new IpcError(a33AccountErrorCodes.RATE_LIMITED, error.message)
    throw new IpcError(a33AccountErrorCodes.REQUEST_FAILED, error.message, { reason: error.reason })
  }
}

export async function getAccountStatus(): Promise<A33AccountStatus> {
  if (!(await readSession())) return { signedIn: false }
  try {
    const me = await authed<{ email: string; balance: number }>('/api/v1/auth/me')
    const stats = await authed<{ total_actual_cost: number; total_tokens: number; today_tokens: number }>(
      '/api/v1/usage/dashboard/stats'
    )
    return {
      signedIn: true,
      overview: {
        email: me.email,
        balance: me.balance,
        usedCost: stats.total_actual_cost,
        totalTokens: stats.total_tokens,
        todayTokens: stats.today_tokens
      }
    }
  } catch (error) {
    // A rejected refresh clears the session: report signed out instead of an error.
    if (!(await readSession())) return { signedIn: false }
    throw toIpcError(error)
  }
}
