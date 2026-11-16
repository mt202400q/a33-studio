import * as z from 'zod'

import { defineRoute } from '../define'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const rangeSchema = z.strictObject({ startDate: dateSchema, endDate: dateSchema })

const usageRecordSchema = z.strictObject({
  id: z.string(),
  createdAt: z.string(),
  model: z.string(),
  keyName: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheTokens: z.number(),
  /** Amount actually deducted from the balance. */
  cost: z.number(),
  durationMs: z.number().optional()
})

const usageSummarySchema = z.strictObject({
  days: z.array(z.strictObject({ date: z.string(), requests: z.number(), tokens: z.number(), cost: z.number() })),
  models: z.array(z.strictObject({ model: z.string(), requests: z.number(), tokens: z.number(), cost: z.number() }))
})

const paymentMethodSchema = z.strictObject({
  type: z.string(),
  name: z.string(),
  currency: z.string(),
  feeRate: z.number(),
  min: z.number(),
  max: z.number()
})

const checkoutSchema = z.strictObject({
  methods: z.array(paymentMethodSchema),
  /** 0 = no limit. */
  min: z.number(),
  max: z.number(),
  /** Balance credited per unit paid. */
  multiplier: z.number(),
  balanceDisabled: z.boolean(),
  helpText: z.string()
})

const orderSchema = z.strictObject({
  orderId: z.string(),
  outTradeNo: z.string(),
  /** Balance that will be credited. */
  amount: z.number(),
  /** What the user pays, fees included. */
  payAmount: z.number(),
  bonus: z.number(),
  currency: z.string(),
  expiresAt: z.string().optional(),
  /** Content to render as a QR code (provider QR, else the hosted pay URL). */
  qrContent: z.string().optional(),
  payUrl: z.string().optional(),
  /** Card payments (Stripe / Airwallex) need the provider's web checkout. */
  needsWebCheckout: z.boolean()
})

const orderStatusSchema = z.enum(['pending', 'paid', 'closed', 'failed', 'refund'])

const orderListSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      orderId: z.string(),
      createdAt: z.string(),
      amount: z.number(),
      payAmount: z.number(),
      paymentType: z.string(),
      status: orderStatusSchema,
      rawStatus: z.string()
    })
  ),
  total: z.number(),
  pages: z.number()
})

export type A33UsageRecord = z.infer<typeof usageRecordSchema>
export type A33UsageSummary = z.infer<typeof usageSummarySchema>
export type A33PaymentMethod = z.infer<typeof paymentMethodSchema>
export type A33Checkout = z.infer<typeof checkoutSchema>
export type A33Order = z.infer<typeof orderSchema>
export type A33OrderStatus = z.infer<typeof orderStatusSchema>
export type A33OrderList = z.infer<typeof orderListSchema>

/** A33 build: a33.club usage history, top-up and redeem codes, called from main with the account session. */
export const a33BillingRequestSchemas = {
  'a33.billing.usage_list': defineRoute({
    input: rangeSchema.extend({ page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100) }),
    output: z.strictObject({ items: z.array(usageRecordSchema), total: z.number(), pages: z.number() })
  }),
  'a33.billing.usage_summary': defineRoute({ input: rangeSchema, output: usageSummarySchema }),
  'a33.billing.checkout': defineRoute({ input: z.void(), output: checkoutSchema }),
  'a33.billing.create_order': defineRoute({
    input: z.strictObject({ amount: z.number().positive(), paymentType: z.string().min(1) }),
    output: orderSchema
  }),
  'a33.billing.order_status': defineRoute({
    input: z.strictObject({ orderId: z.string().min(1), outTradeNo: z.string().optional() }),
    output: orderStatusSchema
  }),
  'a33.billing.cancel_order': defineRoute({ input: z.strictObject({ orderId: z.string().min(1) }), output: z.void() }),
  'a33.billing.orders': defineRoute({
    input: z.strictObject({ page: z.number().int().min(1) }),
    output: orderListSchema
  }),
  'a33.billing.redeem': defineRoute({
    input: z.strictObject({ code: z.string().trim().min(1) }),
    output: z.strictObject({ message: z.string(), value: z.number() })
  })
}
