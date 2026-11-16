import * as z from 'zod'

import { defineRoute } from '../define'

const overviewSchema = z.strictObject({
  email: z.string(),
  /** Wallet balance (yuan: a33.club credits top-ups 1:1 in CNY). */
  balance: z.number(),
  /** All-time amount actually charged. a33.club bills only the wallet, so total = used + balance. */
  usedCost: z.number(),
  totalTokens: z.number(),
  todayTokens: z.number()
})

const statusSchema = z.discriminatedUnion('signedIn', [
  z.strictObject({ signedIn: z.literal(false) }),
  z.strictObject({ signedIn: z.literal(true), overview: overviewSchema })
])

/** The three a33.club key groups the client uses: 对话 (a33), 生图 (a33-image), 生视频 (a33-video). */
const keyKindSchema = z.enum(['chat', 'image', 'video'])
const keyKindsSchema = z.array(keyKindSchema)
const apiKeysSchema = z.strictObject({
  chat: z.string().optional(),
  image: z.string().optional(),
  video: z.string().optional()
})

const loginResultSchema = z.discriminatedUnion('status', [
  /** `apiKeys` holds a key for each requested kind the account has (or could create) a group for. */
  z.strictObject({ status: z.literal('signed_in'), apiKeys: apiKeysSchema }),
  z.strictObject({ status: z.literal('requires_2fa'), tempToken: z.string(), maskedEmail: z.string() })
])

export type A33AccountOverview = z.infer<typeof overviewSchema>
export type A33AccountStatus = z.infer<typeof statusSchema>
export type A33KeyKind = z.infer<typeof keyKindSchema>
export type A33ApiKeys = z.infer<typeof apiKeysSchema>
export type A33LoginResult = z.infer<typeof loginResultSchema>

/** A33 build: a33.club account login and usage, called from main so the session never reaches the renderer. */
export const a33AccountRequestSchemas = {
  'a33.account.status': defineRoute({ input: z.void(), output: statusSchema }),
  'a33.account.login': defineRoute({
    input: z.strictObject({ email: z.string().min(1), password: z.string().min(1), keyKinds: keyKindsSchema }),
    output: loginResultSchema
  }),
  'a33.account.login_2fa': defineRoute({
    input: z.strictObject({ tempToken: z.string().min(1), code: z.string().length(6), keyKinds: keyKindsSchema }),
    output: loginResultSchema
  }),
  /** Keys for providers that still lack one, while signed in (e.g. after an upgrade or a deleted key). */
  'a33.account.provision_keys': defineRoute({
    input: z.strictObject({ keyKinds: keyKindsSchema }),
    output: apiKeysSchema
  }),
  'a33.account.logout': defineRoute({ input: z.void(), output: z.void() })
}
