import type {
  A33Checkout,
  A33Order,
  A33OrderList,
  A33OrderStatus,
  A33UsageRecord,
  A33UsageSummary
} from '@shared/ipc/schemas/a33Billing'

import { a33Request } from './a33Account'

type Json = Record<string, unknown>

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value))
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : [])
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value))
  return search.toString()
}

/** sub2api order states folded into what the client acts on. */
export function toOrderStatus(status: string): A33OrderStatus {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'pending'
    case 'PAID':
    case 'RECHARGING':
    case 'COMPLETED':
      return 'paid'
    case 'EXPIRED':
    case 'CANCELLED':
      return 'closed'
    case 'FAILED':
      return 'failed'
    default:
      return status.toUpperCase().includes('REFUND') ? 'refund' : 'failed'
  }
}

export async function listUsage(input: {
  startDate: string
  endDate: string
  page: number
  pageSize: number
}): Promise<{ items: A33UsageRecord[]; total: number; pages: number }> {
  const data = await a33Request<Json>(
    `/api/v1/usage?${query({
      page: input.page,
      page_size: input.pageSize,
      start_date: input.startDate,
      end_date: input.endDate,
      timezone: timezone(),
      sort_by: 'created_at',
      sort_order: 'desc'
    })}`
  )
  return {
    items: list(data.items).map((log) => ({
      id: text(log.id ?? log.request_id),
      createdAt: text(log.created_at),
      model: text(log.model),
      keyName: text((log.api_key as Json | undefined)?.name),
      inputTokens: num(log.input_tokens),
      outputTokens: num(log.output_tokens),
      cacheTokens: num(log.cache_creation_tokens) + num(log.cache_read_tokens),
      cost: num(log.actual_cost),
      durationMs: log.duration_ms === undefined || log.duration_ms === null ? undefined : num(log.duration_ms)
    })),
    total: num(data.total),
    pages: num(data.pages)
  }
}

export async function usageSummary(input: { startDate: string; endDate: string }): Promise<A33UsageSummary> {
  const data = await a33Request<Json>(
    `/api/v1/usage/dashboard/snapshot-v2?${query({
      start_date: input.startDate,
      end_date: input.endDate,
      granularity: 'day',
      timezone: timezone(),
      include_trend: true,
      include_model_stats: true
    })}`
  )
  return {
    days: list(data.trend).map((point) => ({
      date: text(point.date),
      requests: num(point.requests),
      tokens: num(point.total_tokens),
      cost: num(point.actual_cost)
    })),
    models: list(data.models)
      .map((row) => ({
        model: text(row.model),
        requests: num(row.requests),
        tokens: num(row.total_tokens),
        cost: num(row.actual_cost)
      }))
      .sort((a, b) => b.cost - a.cost)
  }
}

export async function getCheckout(): Promise<A33Checkout> {
  const data = await a33Request<Json>('/api/v1/payment/checkout-info')
  const raw = data.methods
  const methods = (Array.isArray(raw) ? raw : Object.values((raw as Json | undefined) ?? {})) as Json[]
  return {
    methods: methods.map((method) => ({
      type: text(method.payment_type),
      name: text(method.display_name || method.payment_type),
      currency: text(method.currency || 'CNY'),
      feeRate: num(method.fee_rate),
      min: num(method.single_min),
      max: num(method.single_max)
    })),
    min: num(data.global_min),
    max: num(data.global_max),
    multiplier: num(data.balance_recharge_multiplier) || 1,
    balanceDisabled: data.balance_disabled === true,
    helpText: text(data.help_text)
  }
}

export async function createOrder(input: { amount: number; paymentType: string }): Promise<A33Order> {
  const data = await a33Request<Json>('/api/v1/payment/orders', {
    method: 'POST',
    body: {
      amount: input.amount,
      payment_type: input.paymentType,
      order_type: 'balance',
      is_mobile: false,
      payment_source: 'hosted_redirect'
    }
  })
  const qrCode = text(data.qr_code)
  const payUrl = text(data.pay_url)
  return {
    orderId: text(data.order_id),
    outTradeNo: text(data.out_trade_no),
    amount: num(data.amount),
    payAmount: num(data.pay_amount),
    bonus: num(data.bonus_amount),
    currency: text(data.currency || 'CNY'),
    expiresAt: text(data.expires_at) || undefined,
    // A hosted pay page can still be finished on a phone: scanning its URL opens the same page.
    qrContent: qrCode || payUrl || undefined,
    payUrl: payUrl || undefined,
    needsWebCheckout: !qrCode && !payUrl && !!data.client_secret
  }
}

/** Current state of an order; with `outTradeNo`, asks the provider directly first (for missed callbacks). */
export async function getOrderStatus(input: { orderId: string; outTradeNo?: string }): Promise<A33OrderStatus> {
  if (input.outTradeNo) {
    await a33Request('/api/v1/payment/orders/verify', {
      method: 'POST',
      body: { out_trade_no: input.outTradeNo }
    }).catch(() => undefined)
  }
  const order = await a33Request<Json>(`/api/v1/payment/orders/${encodeURIComponent(input.orderId)}`)
  return toOrderStatus(text(order.status))
}

export async function cancelOrder(input: { orderId: string }): Promise<void> {
  await a33Request(`/api/v1/payment/orders/${encodeURIComponent(input.orderId)}/cancel`, { method: 'POST' })
}

export async function listOrders(input: { page: number }): Promise<A33OrderList> {
  const data = await a33Request<Json>(`/api/v1/payment/orders/my?${query({ page: input.page, page_size: 20 })}`)
  return {
    items: list(data.items).map((order) => ({
      orderId: text(order.order_id ?? order.id),
      createdAt: text(order.created_at),
      amount: num(order.amount),
      payAmount: num(order.pay_amount ?? order.amount),
      paymentType: text(order.payment_type),
      status: toOrderStatus(text(order.status)),
      rawStatus: text(order.status)
    })),
    total: num(data.total),
    pages: num(data.pages)
  }
}

export async function redeem(input: { code: string }): Promise<{ message: string; value: number }> {
  const data = await a33Request<Json>('/api/v1/redeem', { method: 'POST', body: { code: input.code.trim() } })
  return { message: text(data.message), value: num(data.value) }
}
