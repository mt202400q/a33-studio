import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`sealed:${value}`),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^sealed:/, '')
  }
}))
vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory()
})

import { application } from '@application'
import { a33AccountErrorCodes } from '@shared/ipc/errors/a33Account'

import type * as AccountModule from '../a33Account'

type Account = typeof AccountModule

interface Group {
  id: number
  platform: string
}
interface Key {
  key: string
  group_id: number | null
}

/** In-memory a33.club (sub2api) with single-use refresh tokens, like the real server. */
function createServer() {
  const state = {
    password: 'secret',
    requires2fa: false,
    validAccess: new Set<string>(),
    validRefresh: new Set<string>(),
    refreshCalls: 0,
    rejectRefresh: false,
    groups: [] as Group[],
    keys: [] as Key[],
    createdKeys: [] as unknown[],
    issued: 0
  }

  const issue = () => {
    state.issued += 1
    const tokens = { access_token: `at_${state.issued}`, refresh_token: `rt_${state.issued}`, expires_in: 3600 }
    state.validAccess.add(tokens.access_token)
    state.validRefresh.add(tokens.refresh_token)
    return tokens
  }
  const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, message: 'success', data }), { status: 200 })
  const fail = (status: number, body: object) => new Response(JSON.stringify(body), { status })

  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const { pathname } = new URL(url)
    const body = init.body ? JSON.parse(String(init.body)) : {}
    const token = new Headers(init.headers).get('Authorization')?.replace('Bearer ', '')

    if (pathname === '/api/v1/auth/login') {
      if (body.password !== state.password) {
        return fail(401, { code: 401, message: 'invalid email or password', reason: 'INVALID_CREDENTIALS' })
      }
      if (state.requires2fa) return ok({ requires_2fa: true, temp_token: 'tmp_1', user_email_masked: 'u***@x.com' })
      return ok(issue())
    }
    if (pathname === '/api/v1/auth/login/2fa') {
      if (body.temp_token !== 'tmp_1' || body.totp_code !== '123456') {
        return fail(401, { code: 401, message: 'invalid code', reason: 'INVALID_TOTP' })
      }
      return ok(issue())
    }
    if (pathname === '/api/v1/auth/refresh') {
      state.refreshCalls += 1
      // Single-use: a second refresh with the same token is rejected, which would log the user out.
      if (state.rejectRefresh || !state.validRefresh.delete(body.refresh_token)) {
        return fail(401, { code: 401, message: 'invalid refresh token', reason: 'REFRESH_TOKEN_INVALID' })
      }
      return ok(issue())
    }
    if (pathname === '/api/v1/auth/logout') return ok(null)

    if (!token || !state.validAccess.has(token)) return fail(401, { code: 'TOKEN_EXPIRED', message: 'expired' })
    if (pathname === '/api/v1/auth/me') return ok({ email: 'user@x.com', balance: 6.75 })
    if (pathname === '/api/v1/usage/dashboard/stats') {
      return ok({ total_actual_cost: 3.25, total_tokens: 3_250_000, today_tokens: 12_000 })
    }
    if (pathname === '/api/v1/groups/available') return ok(state.groups)
    if (pathname === '/api/v1/keys' && init.method === 'POST') {
      state.createdKeys.push(body)
      return ok({ key: 'sk-created', group_id: body.group_id })
    }
    if (pathname === '/api/v1/keys') return ok({ items: state.keys, total: state.keys.length })
    return fail(404, { code: 404, message: 'not found' })
  })

  return { state, fetch, expireAccessTokens: () => state.validAccess.clear() }
}

let dir: string
let server: ReturnType<typeof createServer>
let account: Account

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'a33-account-'))
  vi.mocked(application.getPath).mockImplementation(() => path.join(dir, 'a33-account-session.enc'))
  server = createServer()
  vi.stubGlobal('fetch', server.fetch)
  // The service caches the session in module state; each test starts from a fresh module.
  vi.resetModules()
  account = await import('../a33Account')
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(dir, { recursive: true, force: true })
})

const signIn = () => account.login({ email: 'user@x.com', password: 'secret', wantApiKey: false })

describe('a33 account session', () => {
  it('reports the wallet overview after signing in', async () => {
    await signIn()

    expect(await account.getAccountStatus()).toEqual({
      signedIn: true,
      overview: { email: 'user@x.com', balance: 6.75, usedCost: 3.25, totalTokens: 3_250_000, todayTokens: 12_000 }
    })
  })

  it('shares one refresh between concurrent calls when the access token expires', async () => {
    await signIn()
    server.expireAccessTokens()

    const [first, second] = await Promise.all([account.getAccountStatus(), account.getAccountStatus()])

    expect(first.signedIn && second.signedIn).toBe(true)
    expect(server.state.refreshCalls).toBe(1)
  })

  it('keeps the session across restarts and refreshes with the rotated token', async () => {
    await signIn()
    server.expireAccessTokens()
    await account.getAccountStatus()

    vi.resetModules()
    const restarted: Account = await import('../a33Account')
    server.expireAccessTokens()

    expect((await restarted.getAccountStatus()).signedIn).toBe(true)
    expect(server.state.refreshCalls).toBe(2)
  })

  it('signs out locally when a33.club rejects the refresh token', async () => {
    await signIn()
    server.expireAccessTokens()
    server.state.rejectRefresh = true

    expect(await account.getAccountStatus()).toEqual({ signedIn: false })
    await expect(stat(path.join(dir, 'a33-account-session.enc'))).rejects.toThrow()
  })

  it('maps a wrong password to the invalid-credentials code', async () => {
    const attempt = account.login({ email: 'user@x.com', password: 'wrong', wantApiKey: false })

    // `code` is what crosses IPC; instanceof would compare against a pre-resetModules class copy.
    await expect(attempt).rejects.toMatchObject({ code: a33AccountErrorCodes.INVALID_CREDENTIALS })
    expect(await account.getAccountStatus()).toEqual({ signedIn: false })
  })

  it('asks for the 2FA code before signing in when the account has it enabled', async () => {
    server.state.requires2fa = true

    const challenge = await signIn()
    expect(challenge).toEqual({ status: 'requires_2fa', tempToken: 'tmp_1', maskedEmail: 'u***@x.com' })
    expect((await account.getAccountStatus()).signedIn).toBe(false)

    await expect(account.loginWith2fa({ tempToken: 'tmp_1', code: '000000', wantApiKey: false })).rejects.toMatchObject(
      { code: a33AccountErrorCodes.INVALID_2FA_CODE }
    )
    expect(await account.loginWith2fa({ tempToken: 'tmp_1', code: '123456', wantApiKey: false })).toEqual({
      status: 'signed_in'
    })
    expect((await account.getAccountStatus()).signedIn).toBe(true)
  })

  it('clears the session on logout', async () => {
    await signIn()
    await account.logout()

    expect(await account.getAccountStatus()).toEqual({ signedIn: false })
  })
})

describe('a33 API key after login', () => {
  const loginWantingKey = () => account.login({ email: 'user@x.com', password: 'secret', wantApiKey: true })

  it('reuses an active key on an Anthropic group, never a key from another platform', async () => {
    server.state.groups = [
      { id: 1, platform: 'openai' },
      { id: 2, platform: 'anthropic' }
    ]
    server.state.keys = [
      { key: 'sk-openai', group_id: 1 },
      { key: 'sk-anthropic', group_id: 2 }
    ]

    expect(await loginWantingKey()).toEqual({ status: 'signed_in', apiKey: 'sk-anthropic' })
    expect(server.state.createdKeys).toEqual([])
  })

  it('creates a key on an Anthropic group when the account has none', async () => {
    server.state.groups = [
      { id: 1, platform: 'openai' },
      { id: 2, platform: 'anthropic' }
    ]
    server.state.keys = [{ key: 'sk-openai', group_id: 1 }]

    expect(await loginWantingKey()).toEqual({ status: 'signed_in', apiKey: 'sk-created' })
    expect(server.state.createdKeys).toEqual([{ name: 'A33 Studio', group_id: 2 }])
  })

  it('still signs in without a key when no Anthropic group is available', async () => {
    server.state.groups = [{ id: 1, platform: 'openai' }]

    expect(await loginWantingKey()).toEqual({ status: 'signed_in' })
    expect(server.state.createdKeys).toEqual([])
  })
})
