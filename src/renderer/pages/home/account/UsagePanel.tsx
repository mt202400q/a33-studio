import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Skeleton } from '@cherrystudio/ui'
import { loggerService } from '@logger'
import { ipcApi } from '@renderer/ipc'
import { cn } from '@renderer/utils/style'
import type { A33UsageRecord, A33UsageSummary } from '@shared/ipc/schemas/a33Billing'

import { formatCost } from '../money'

const logger = loggerService.withContext('A33UsagePanel')
const PAGE_SIZE = 20

type Range = 'today' | '7d' | '30d'
const RANGE_DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30 }

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Local calendar days, oldest first, ending today. */
function rangeDays(count: number): string[] {
  const today = new Date()
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (count - 1 - index))
    return isoDate(day)
  })
}

export function UsagePanel() {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<Range>('7d')
  const days = useMemo(() => rangeDays(RANGE_DAYS[range]), [range])
  const startDate = days[0]
  const endDate = days[days.length - 1]
  const [summary, setSummary] = useState<A33UsageSummary | null>(null)
  const [records, setRecords] = useState<{ items: A33UsageRecord[]; pages: number } | null>(null)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [nextSummary, nextRecords] = await Promise.all([
        ipcApi.request('a33.billing.usage_summary', { startDate, endDate }),
        ipcApi.request('a33.billing.usage_list', { startDate, endDate, page, pageSize: PAGE_SIZE })
      ])
      setSummary(nextSummary)
      setRecords(nextRecords)
    } catch (error) {
      logger.warn('Failed to load usage', error as Error)
      setFailed(true)
    }
  }, [endDate, page, startDate])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(
    () =>
      (summary?.days ?? []).reduce(
        (sum, day) => ({
          cost: sum.cost + day.cost,
          requests: sum.requests + day.requests,
          tokens: sum.tokens + day.tokens
        }),
        { cost: 0, requests: 0, tokens: 0 }
      ),
    [summary]
  )
  const count = new Intl.NumberFormat(i18n.language)

  const rangeButton = (value: Range, label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={range === value}
      onClick={() => {
        setRange(value)
        setPage(1)
      }}
      className={cn(
        'rounded-md px-3 py-1 text-[13px] transition-colors',
        range === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}>
      {label}
    </button>
  )

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="m-0 text-muted-foreground text-sm">{t('a33.account.usage.load_failed')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-0.5 self-start rounded-lg bg-muted p-0.5">
        {rangeButton('today', t('a33.account.usage.range_today'))}
        {rangeButton('7d', t('a33.account.usage.range_7d'))}
        {rangeButton('30d', t('a33.account.usage.range_30d'))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label={t('a33.account.usage.cost')} value={summary ? formatCost(i18n.language, totals.cost) : null} />
        <StatTile label={t('a33.account.usage.requests')} value={summary ? count.format(totals.requests) : null} />
        <StatTile label={t('a33.account.usage.tokens')} value={summary ? count.format(totals.tokens) : null} />
      </div>

      {range !== 'today' && (
        <section className="rounded-2xl border border-border-subtle bg-card p-5">
          <h3 className="m-0 mb-4 font-semibold text-card-foreground text-sm">{t('a33.account.usage.daily_cost')}</h3>
          {summary ? <DailyCostChart days={days} summary={summary} /> : <Skeleton className="h-40 w-full" />}
        </section>
      )}

      <section className="rounded-2xl border border-border-subtle bg-card p-5">
        <h3 className="m-0 mb-3 font-semibold text-card-foreground text-sm">{t('a33.account.usage.by_model')}</h3>
        {!summary ? (
          <Skeleton className="h-24 w-full" />
        ) : summary.models.length === 0 ? (
          <p className="m-0 text-muted-foreground text-sm">{t('a33.account.usage.empty')}</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-left text-muted-foreground text-xs">
              <tr>
                <th className="pb-2 font-normal">{t('a33.account.usage.model')}</th>
                <th className="pb-2 text-right font-normal">{t('a33.account.usage.requests')}</th>
                <th className="pb-2 text-right font-normal">{t('a33.account.usage.tokens')}</th>
                <th className="pb-2 text-right font-normal">{t('a33.account.usage.cost')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {summary.models.map((row) => (
                <tr key={row.model} className="border-border-subtle border-t">
                  <td className="py-2 text-card-foreground">{row.model}</td>
                  <td className="py-2 text-right text-muted-foreground">{count.format(row.requests)}</td>
                  <td className="py-2 text-right text-muted-foreground">{count.format(row.tokens)}</td>
                  <td className="py-2 text-right text-card-foreground">{formatCost(i18n.language, row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 font-semibold text-card-foreground text-sm">{t('a33.account.usage.records')}</h3>
          {records && records.pages > 1 && (
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
              {page} / {records.pages}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('a33.account.next_page')}
                disabled={page >= records.pages}
                onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
        {!records ? (
          <Skeleton className="h-40 w-full" />
        ) : records.items.length === 0 ? (
          <p className="m-0 text-muted-foreground text-sm">{t('a33.account.usage.empty')}</p>
        ) : (
          <table className="w-full table-fixed text-[13px]">
            <thead className="text-left text-muted-foreground text-xs">
              <tr>
                <th className="w-[140px] pb-2 font-normal">{t('a33.account.usage.time')}</th>
                <th className="pb-2 font-normal">{t('a33.account.usage.model')}</th>
                <th className="w-[120px] pb-2 font-normal">{t('a33.account.usage.key')}</th>
                <th className="w-[150px] pb-2 text-right font-normal">{t('a33.account.usage.in_out')}</th>
                <th className="w-[100px] pb-2 text-right font-normal">{t('a33.account.usage.cost')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {records.items.map((record) => (
                <tr key={record.id} className="border-border-subtle border-t">
                  <td className="py-2 text-muted-foreground">
                    {new Date(record.createdAt).toLocaleString(i18n.language)}
                  </td>
                  <td className="truncate py-2 text-card-foreground" title={record.model}>
                    {record.model}
                  </td>
                  <td className="truncate py-2 text-muted-foreground" title={record.keyName}>
                    {record.keyName || '—'}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {count.format(record.inputTokens)} / {count.format(record.outputTokens)}
                  </td>
                  <td className="py-2 text-right text-card-foreground">{formatCost(i18n.language, record.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-5">
      <div className="text-muted-foreground text-xs">{label}</div>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-1.5 font-semibold text-2xl text-card-foreground tabular-nums">{value}</div>
      )}
    </div>
  )
}

/** Daily spend as thin single-hue bars on a shared baseline; each day shows its numbers on hover. */
function DailyCostChart({ days, summary }: { days: string[]; summary: A33UsageSummary }) {
  const { t, i18n } = useTranslation()
  const count = new Intl.NumberFormat(i18n.language)
  const byDate = new Map(summary.days.map((day) => [day.date.slice(0, 10), day]))
  const points = days.map((date) => byDate.get(date) ?? { date, cost: 0, requests: 0, tokens: 0 })
  const max = Math.max(...points.map((point) => point.cost), 0)
  const label = (date: string) => date.slice(5).replace('-', '/')

  return (
    <div>
      <div className="mb-1 text-muted-foreground text-xs tabular-nums">{formatCost(i18n.language, max)}</div>
      <div className="flex h-40 items-end gap-[2px] border-border-subtle border-b">
        {points.map((point) => (
          <div key={point.date} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
              style={{ height: max > 0 ? `${Math.max((point.cost / max) * 100, point.cost > 0 ? 1.5 : 0)}%` : 0 }}
            />
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md group-hover:block">
              <div className="font-medium">{point.date}</div>
              <div className="tabular-nums">
                {t('a33.account.usage.cost')} {formatCost(i18n.language, point.cost)}
              </div>
              <div className="text-muted-foreground tabular-nums">
                {t('a33.account.usage.tokens')} {count.format(point.tokens)} · {t('a33.account.usage.requests')}{' '}
                {count.format(point.requests)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-muted-foreground text-xs tabular-nums">
        <span>{label(points[0].date)}</span>
        <span>{label(points[Math.floor(points.length / 2)].date)}</span>
        <span>{label(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}
