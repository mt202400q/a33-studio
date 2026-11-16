import { beforeEach, describe, expect, it, vi } from 'vitest'

const a33Request = vi.hoisted(() => vi.fn())
vi.mock('../a33Account', () => ({ a33Request }))

import { createOrder, getCheckout, getOrderStatus, listUsage, toOrderStatus } from '../a33Billing'

beforeEach(() => {
  a33Request.mockReset()
})

describe('toOrderStatus', () => {
  it('treats paid, recharging and completed orders as credited', () => {
    expect(['PAID', 'RECHARGING', 'COMPLETED'].map(toOrderStatus)).toEqual(['paid', 'paid', 'paid'])
  })

  it('separates waiting, closed, failed and refunded orders', () => {
    expect(toOrderStatus('PENDING')).toBe('pending')
    expect(toOrderStatus('EXPIRED')).toBe('closed')
    expect(toOrderStatus('CANCELLED')).toBe('closed')
    expect(toOrderStatus('FAILED')).toBe('failed')
    expect(['REFUND_REQUESTED', 'PARTIALLY_REFUNDED', 'REFUNDED'].map(toOrderStatus)).toEqual([
      'refund',
      'refund',
      'refund'
    ])
  })
})

describe('createOrder', () => {
  const order = (extra: object) => ({
    order_id: 42,
    out_trade_no: 'T42',
    amount: 100,
    pay_amount: 101.5,
    bonus_amount: 0,
    currency: 'CNY',
    expires_at: '2026-11-16T10:00:00Z',
    ...extra
  })

  it('asks for a balance order on the desktop flow', async () => {
    a33Request.mockResolvedValue(order({ qr_code: 'weixin://wxpay/abc' }))
    await createOrder({ amount: 100, paymentType: 'wxpay' })

    expect(a33Request).toHaveBeenCalledWith('/api/v1/payment/orders', {
      method: 'POST',
      body: expect.objectContaining({ amount: 100, payment_type: 'wxpay', order_type: 'balance', is_mobile: false })
    })
  })

  it("renders the provider's QR content when there is one", async () => {
    a33Request.mockResolvedValue(order({ qr_code: 'weixin://wxpay/abc', pay_url: 'https://pay/x' }))

    expect(await createOrder({ amount: 100, paymentType: 'wxpay' })).toMatchObject({
      orderId: '42',
      outTradeNo: 'T42',
      payAmount: 101.5,
      qrContent: 'weixin://wxpay/abc',
      payUrl: 'https://pay/x',
      needsWebCheckout: false
    })
  })

  it('falls back to a QR of the hosted pay page so it can still be paid from a phone', async () => {
    a33Request.mockResolvedValue(order({ pay_url: 'https://openapi.alipay.com/x' }))

    expect(await createOrder({ amount: 100, paymentType: 'alipay' })).toMatchObject({
      qrContent: 'https://openapi.alipay.com/x',
      needsWebCheckout: false
    })
  })

  it('flags card checkouts that only work with the provider web SDK', async () => {
    a33Request.mockResolvedValue(order({ client_secret: 'pi_secret' }))

    expect(await createOrder({ amount: 100, paymentType: 'stripe' })).toMatchObject({
      qrContent: undefined,
      needsWebCheckout: true
    })
  })
})

describe('getOrderStatus', () => {
  it('asks the provider to verify before reading the order when a trade number is given', async () => {
    a33Request.mockResolvedValueOnce({}).mockResolvedValueOnce({ status: 'COMPLETED' })

    expect(await getOrderStatus({ orderId: '42', outTradeNo: 'T42' })).toBe('paid')
    expect(a33Request.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/payment/orders/verify',
      '/api/v1/payment/orders/42'
    ])
  })

  it('still reports the order when the verify call fails', async () => {
    a33Request.mockRejectedValueOnce(new Error('provider down')).mockResolvedValueOnce({ status: 'PENDING' })

    expect(await getOrderStatus({ orderId: '42', outTradeNo: 'T42' })).toBe('pending')
  })
})

describe('getCheckout', () => {
  it('reads methods given as a map keyed by payment type and defaults the multiplier to 1', async () => {
    a33Request.mockResolvedValue({
      methods: {
        alipay: {
          payment_type: 'alipay',
          display_name: '支付宝',
          currency: 'CNY',
          fee_rate: 0,
          single_min: 1,
          single_max: 5000
        }
      },
      global_min: 10,
      global_max: 0
    })

    expect(await getCheckout()).toEqual({
      methods: [{ type: 'alipay', name: '支付宝', currency: 'CNY', feeRate: 0, min: 1, max: 5000 }],
      min: 10,
      max: 0,
      multiplier: 1,
      balanceDisabled: false,
      helpText: ''
    })
  })
})

describe('listUsage', () => {
  it('maps records to the charged amount and sums both cache token kinds', async () => {
    a33Request.mockResolvedValue({
      items: [
        {
          id: 7,
          created_at: '2026-11-16T08:00:00Z',
          model: 'claude-sonnet-5-5',
          input_tokens: 100,
          output_tokens: 20,
          cache_creation_tokens: 5,
          cache_read_tokens: 300,
          total_cost: 1,
          actual_cost: 0.25,
          api_key: { name: '对话' }
        }
      ],
      total: 1,
      pages: 1
    })

    const result = await listUsage({ startDate: '2026-11-10', endDate: '2026-11-16', page: 1, pageSize: 20 })

    expect(result.items[0]).toMatchObject({ id: '7', keyName: '对话', cacheTokens: 305, cost: 0.25 })
    expect(a33Request.mock.calls[0][0]).toContain('start_date=2026-11-10')
  })
})
