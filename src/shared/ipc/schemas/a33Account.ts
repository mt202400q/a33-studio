import * as z from 'zod'

import { defineRoute } from '../define'

const overviewSchema = z.strictObject({
  email: z.string(),
  /** Wallet balance in USD. */
  balance: z.number(),
  /** All-time amount actually charged, in USD. a33.club bills only the wallet, so total = used + balance. */
  usedCost: z.number(),
  totalTokens: z.number(),
  todayTokens: z.number()
})

const statusSchema = z.discriminatedUnion('signedIn', [
  z.strictObject({ signedIn: z.literal(false) }),
  z.strictObject({ signedIn: z.literal(true), overview: overviewSchema })
])

const loginResultSchema = z.discriminatedUnion('status', [
  /** `apiKey` is set only when `wantApiKey` was requested and a key for the a33 (Anthropic) group exists or could be created. */
  z.strictObject({ status: z.literal('signed_in'), apiKey: z.string().optional() }),
  z.strictObject({ status: z.literal('requires_2fa'), tempToken: z.string(), maskedEmail: z.string() })
])

export type A33AccountOverview = z.infer<typeof overviewSchema>
export type A33AccountStatus = z.infer<typeof statusSchema>
export type A33LoginResult = z.infer<typeof loginResultSchema>

/** A33 build: a33.club account login and usage, called from main so the session never reaches the renderer. */
export const a33AccountRequestSchemas = {
  'a33.account.status': defineRoute({ input: z.void(), output: statusSchema }),
  'a33.account.login': defineRoute({
    input: z.strictObject({ email: z.string().min(1), password: z.string().min(1), wantApiKey: z.boolean() }),
    output: loginResultSchema
  }),
  'a33.account.login_2fa': defineRoute({
    input: z.strictObject({ tempToken: z.string().min(1), code: z.string().length(6), wantApiKey: z.boolean() }),
    output: loginResultSchema
  }),
  'a33.account.logout': defineRoute({ input: z.void(), output: z.void() })
}
