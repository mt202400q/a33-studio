import { CheckCircle2, Copy, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton
} from '@cherrystudio/ui'
import { loggerService } from '@logger'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import { openExternalWebsite } from '@renderer/services/website'
import { cn } from '@renderer/utils/style'
import { IpcError } from '@shared/ipc/errors/IpcError'
import type { A33Checkout, A33Order, A33OrderStatus } from '@shared/ipc/schemas/a33Billing'

import { cnyFormatter } from '../money'

const logger = loggerService.withContext('A33RechargePanel')

/** The a33.club web console's preset amounts (sub2api hard-codes them in its payment page). */
const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
const A33_PURCHASE_URL = 'https://a33.club/purchase'
/** Manual top-up contact the a33.club purchase page shows (large amounts, invoices, transfers). */
const SUPPORT_WECHAT = 'honghuo888812345'
const SUPPORT_WECHAT_QR = 'https://a33.club/wechat-qr.webp'

/** Friendly names for when a33.club leaves a method's display name empty. */
const METHOD_LABEL_KEYS: Record<string, string> = {
  wxpay: 'a33.account.recharge.method_wxpay',
  wxpay_direct: 'a33.account.recharge.method_wxpay',
  alipay: 'a33.account.recharge.method_alipay',
  alipay_direct: 'a33.account.recharge.method_alipay',
  stripe: 'a33.account.recharge.method_card',
  airwallex: 'a33.account.recharge.method_card'
}

const POLL_MS = 3000
const VERIFY_EVERY = 5
const MAX_VERIFIES = 6

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function RechargePanel({ onPaid }: { onPaid: () => void }) {
  const { t, i18n } = useTranslation()
  const [checkout, setCheckout] = useState<A33Checkout | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [methodType, setMethodType] = useState<string>()
  const [amount, setAmount] = useState<number>(100)
  const [customAmount, setCustomAmount] = useState('')
  const [creating, setCreating] = useState(false)
  const [order, setOrder] = useState<A33Order | null>(null)
  const yuan = cnyFormatter(i18n.language)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const info = await ipcApi.request('a33.billing.checkout')
      setCheckout(info)
      setMethodType((current) => current ?? info.methods[0]?.type)
    } catch (error) {
      logger.warn('Failed to load checkout info', error as Error)
      setLoadError(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const method = checkout?.methods.find((item) => item.type === methodType)
  const [min, max] = useMemo(() => {
    const lo = Math.max(checkout?.min || 0, method?.min || 0)
    const caps = [checkout?.max, method?.max].filter((value): value is number => !!value && value > 0)
    return [lo, caps.length ? Math.min(...caps) : Infinity]
  }, [checkout, method])
  const presets = PRESET_AMOUNTS.filter((value) => value >= min && value <= max)
  const chosen = customAmount ? Number(customAmount) : amount
  const amountValid = Number.isFinite(chosen) && chosen > 0 && chosen >= min && chosen <= max
  const credited = checkout ? Math.round(chosen * checkout.multiplier * 100) / 100 : 0

  const pay = async () => {
    if (!method || !amountValid) return
    setCreating(true)
    try {
      setOrder(await ipcApi.request('a33.billing.create_order', { amount: chosen, paymentType: method.type }))
    } catch (error) {
      toast.error(t('a33.account.recharge.create_failed', { message: errorMessage(error) }))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border-subtle bg-card p-5">
        <h3 className="m-0 mb-4 font-semibold text-card-foreground text-sm">{t('a33.account.recharge.title')}</h3>
        {loadError ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground text-sm">
              {t('a33.account.recharge.unavailable', { message: loadError })}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : !checkout ? (
          <Skeleton className="h-48 w-full" />
        ) : checkout.balanceDisabled || checkout.methods.length === 0 ? (
          <p className="m-0 text-muted-foreground text-sm">{t('a33.account.recharge.no_methods')}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 text-muted-foreground text-xs">{t('a33.account.recharge.method')}</div>
              <div className="flex flex-wrap gap-2">
                {checkout.methods.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    aria-pressed={item.type === methodType}
                    onClick={() => setMethodType(item.type)}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-sm transition-colors',
                      item.type === methodType
                        ? 'border-border-selected bg-accent text-foreground'
                        : 'border-border-subtle text-muted-foreground hover:border-border-strong hover:text-foreground'
                    )}>
                    {item.name && item.name !== item.type
                      ? item.name
                      : METHOD_LABEL_KEYS[item.type]
                        ? t(METHOD_LABEL_KEYS[item.type])
                        : item.type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-muted-foreground text-xs">{t('a33.account.recharge.amount')}</div>
              <div className="grid grid-cols-5 gap-2">
                {presets.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={!customAmount && value === amount}
                    onClick={() => {
                      setAmount(value)
                      setCustomAmount('')
                    }}
                    className={cn(
                      'rounded-xl border py-2.5 font-medium text-sm tabular-nums transition-colors',
                      !customAmount && value === amount
                        ? 'border-border-selected bg-accent text-foreground'
                        : 'border-border-subtle text-card-foreground hover:border-border-strong'
                    )}>
                    {yuan.format(value)}
                  </button>
                ))}
              </div>
              <Input
                className="mt-2"
                inputMode="decimal"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value.replace(/[^\d.]/g, ''))}
                placeholder={t('a33.account.recharge.custom_amount', {
                  min: yuan.format(min),
                  max: Number.isFinite(max) ? yuan.format(max) : '∞'
                })}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-border-subtle border-t pt-4">
              <div className="text-sm">
                <span className="text-muted-foreground">{t('a33.account.recharge.credited')} </span>
                <span className="font-semibold text-card-foreground tabular-nums">
                  {amountValid ? yuan.format(credited) : '—'}
                </span>
                {!!method?.feeRate && (
                  <span className="ml-2 text-muted-foreground text-xs">
                    {t('a33.account.recharge.fee', { rate: method.feeRate })}
                  </span>
                )}
              </div>
              <Button type="button" loading={creating} disabled={!amountValid} onClick={() => void pay()}>
                {t('a33.account.recharge.pay', { amount: amountValid ? yuan.format(chosen) : '' })}
              </Button>
            </div>
            {checkout.helpText && <p className="m-0 text-muted-foreground text-xs">{checkout.helpText}</p>}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-5">
        <RedeemCard onRedeemed={onPaid} />
        <ManualCard />
      </div>

      {order && (
        <PaymentDialog
          order={order}
          onClose={() => setOrder(null)}
          onPaid={() => {
            onPaid()
            toast.success(t('a33.account.recharge.paid_toast', { amount: yuan.format(order.amount) }))
          }}
        />
      )}
    </div>
  )
}

function PaymentDialog({ order, onClose, onPaid }: { order: A33Order; onClose: () => void; onPaid: () => void }) {
  const { t, i18n } = useTranslation()
  const yuan = cnyFormatter(i18n.language)
  const [status, setStatus] = useState<A33OrderStatus>('pending')
  const [now, setNow] = useState(() => Date.now())
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid
  const expiresAt = order.expiresAt ? Date.parse(order.expiresAt) : NaN
  const secondsLeft = Number.isFinite(expiresAt) ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : undefined

  useEffect(() => {
    if (status !== 'pending') return
    let tick = 0
    let verifies = 0
    const timer = window.setInterval(() => {
      tick += 1
      setNow(Date.now())
      if (tick % (POLL_MS / 1000) !== 0) return
      // Every ~15 s also ask the provider directly, in case its callback to a33.club was missed.
      const verify = (tick / (POLL_MS / 1000)) % VERIFY_EVERY === 0 && verifies < MAX_VERIFIES
      if (verify) verifies += 1
      ipcApi
        .request('a33.billing.order_status', {
          orderId: order.orderId,
          outTradeNo: verify ? order.outTradeNo : undefined
        })
        .then((next) => {
          setStatus(next)
          if (next === 'paid') onPaidRef.current()
        })
        .catch((error) => logger.warn('Order status check failed', error as Error))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [order.orderId, order.outTradeNo, status])

  const cancel = async () => {
    if (status === 'pending') {
      await ipcApi.request('a33.billing.cancel_order', { orderId: order.orderId }).catch((error) => {
        logger.warn('Cancel order failed', error as Error)
      })
    }
    onClose()
  }

  const expired = status === 'closed' || secondsLeft === 0
  return (
    <Dialog open onOpenChange={(open) => !open && void cancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {status === 'paid' ? t('a33.account.recharge.paid_title') : t('a33.account.recharge.scan_title')}
          </DialogTitle>
          <DialogDescription>
            {status === 'paid'
              ? t('a33.account.recharge.paid_description', { amount: yuan.format(order.amount) })
              : t('a33.account.recharge.scan_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {status === 'paid' ? (
            <CheckCircle2 className="size-16 text-success" />
          ) : order.needsWebCheckout || !order.qrContent ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <QrCode className="size-12 text-muted-foreground" />
              <p className="m-0 text-muted-foreground text-sm">{t('a33.account.recharge.web_only')}</p>
              <Button type="button" variant="outline" onClick={() => void openExternalWebsite(A33_PURCHASE_URL)}>
                <ExternalLink className="size-4" />
                {t('a33.account.recharge.open_web')}
              </Button>
            </div>
          ) : (
            <>
              <div className={cn('rounded-xl bg-white p-3', expired && 'opacity-30')}>
                <QRCodeSVG value={order.qrContent} size={200} marginSize={0} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-2xl text-foreground tabular-nums">
                  {yuan.format(order.payAmount)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {expired
                    ? t('a33.account.recharge.expired')
                    : secondsLeft !== undefined
                      ? t('a33.account.recharge.expires_in', {
                          time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                        })
                      : t('a33.account.recharge.waiting')}
                </div>
                {order.bonus > 0 && (
                  <div className="mt-1 text-success text-xs">
                    {t('a33.account.recharge.bonus', { amount: yuan.format(order.bonus) })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {status === 'paid' ? (
            <Button type="button" onClick={onClose}>
              {t('common.confirm')}
            </Button>
          ) : (
            <>
              {order.payUrl && !expired && (
                <Button type="button" variant="ghost" onClick={() => void openExternalWebsite(order.payUrl!)}>
                  <ExternalLink className="size-4" />
                  {t('a33.account.recharge.open_in_browser')}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => void cancel()}>
                {expired ? t('common.close') : t('a33.account.recharge.cancel_order')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RedeemCard({ onRedeemed }: { onRedeemed: () => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const redeem = async () => {
    if (!code.trim()) return
    setBusy(true)
    try {
      const result = await ipcApi.request('a33.billing.redeem', { code })
      toast.success(result.message || t('a33.account.redeem.success'))
      setCode('')
      onRedeemed()
    } catch (error) {
      const message = error instanceof IpcError ? error.message : errorMessage(error)
      toast.error(t('a33.account.redeem.failed', { message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-5">
      <h3 className="m-0 mb-1 font-semibold text-card-foreground text-sm">{t('a33.account.redeem.title')}</h3>
      <p className="mt-0 mb-3 text-muted-foreground text-xs">{t('a33.account.redeem.description')}</p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void redeem()
        }}>
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t('a33.account.redeem.placeholder')}
        />
        <Button type="submit" variant="outline" loading={busy} disabled={!code.trim()}>
          {t('a33.account.redeem.submit')}
        </Button>
      </form>
    </section>
  )
}

function ManualCard() {
  const { t } = useTranslation()
  const [qrFailed, setQrFailed] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(SUPPORT_WECHAT)
    toast.success(t('a33.account.manual.copied'))
  }
  return (
    <section className="flex gap-4 rounded-2xl border border-border-subtle bg-card p-5">
      {!qrFailed && (
        <img
          src={SUPPORT_WECHAT_QR}
          alt=""
          className="size-[88px] shrink-0 rounded-lg bg-white"
          onError={() => setQrFailed(true)}
        />
      )}
      <div className="min-w-0">
        <h3 className="m-0 mb-1 font-semibold text-card-foreground text-sm">{t('a33.account.manual.title')}</h3>
        <p className="mt-0 mb-2 text-muted-foreground text-xs">{t('a33.account.manual.description')}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-card-foreground text-xs hover:bg-accent">
          {t('a33.account.manual.wechat')} <b className="font-medium">{SUPPORT_WECHAT}</b>
          <Copy className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </section>
  )
}
