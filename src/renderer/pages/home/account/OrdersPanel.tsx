import { CheckCircle2, ChevronLeft, ChevronRight, Clock, RotateCcw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Skeleton } from '@cherrystudio/ui'
import { loggerService } from '@logger'
import { ipcApi } from '@renderer/ipc'
import type { A33OrderList, A33OrderStatus } from '@shared/ipc/schemas/a33Billing'

import { cnyFormatter } from '../money'

const logger = loggerService.withContext('A33OrdersPanel')

const STATUS = {
  pending: { icon: Clock, key: 'a33.account.orders.status_pending', className: 'text-muted-foreground' },
  paid: { icon: CheckCircle2, key: 'a33.account.orders.status_paid', className: 'text-success' },
  closed: { icon: XCircle, key: 'a33.account.orders.status_closed', className: 'text-muted-foreground' },
  failed: { icon: XCircle, key: 'a33.account.orders.status_failed', className: 'text-error' },
  refund: { icon: RotateCcw, key: 'a33.account.orders.status_refund', className: 'text-muted-foreground' }
} as const satisfies Record<A33OrderStatus, unknown>

export function OrdersPanel() {
  const { t, i18n } = useTranslation()
  const yuan = cnyFormatter(i18n.language)
  const [page, setPage] = useState(1)
  const [orders, setOrders] = useState<A33OrderList | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      setOrders(await ipcApi.request('a33.billing.orders', { page }))
    } catch (error) {
      logger.warn('Failed to load orders', error as Error)
      setFailed(true)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 font-semibold text-card-foreground text-sm">{t('a33.account.orders.title')}</h3>
        {orders && orders.pages > 1 && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('a33.account.previous_page')}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {page} / {orders.pages}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('a33.account.next_page')}
              disabled={page >= orders.pages}
              onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {failed ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">{t('a33.account.orders.load_failed')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : !orders ? (
        <Skeleton className="h-40 w-full" />
      ) : orders.items.length === 0 ? (
        <p className="m-0 text-muted-foreground text-sm">{t('a33.account.orders.empty')}</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead className="text-left text-muted-foreground text-xs">
            <tr>
              <th className="pb-2 font-normal">{t('a33.account.orders.time')}</th>
              <th className="pb-2 text-right font-normal">{t('a33.account.orders.credited')}</th>
              <th className="pb-2 text-right font-normal">{t('a33.account.orders.paid')}</th>
              <th className="pb-2 pl-6 font-normal">{t('a33.account.orders.method')}</th>
              <th className="pb-2 font-normal">{t('a33.account.orders.status')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {orders.items.map((order) => {
              const status = STATUS[order.status]
              const Icon = status.icon
              return (
                <tr key={order.orderId} className="border-border-subtle border-t">
                  <td className="py-2 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString(i18n.language)}
                  </td>
                  <td className="py-2 text-right text-card-foreground">{yuan.format(order.amount)}</td>
                  <td className="py-2 text-right text-muted-foreground">{yuan.format(order.payAmount)}</td>
                  <td className="py-2 pl-6 text-muted-foreground">{order.paymentType}</td>
                  <td className={`py-2 ${status.className}`} title={order.rawStatus}>
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5" />
                      {t(status.key)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
