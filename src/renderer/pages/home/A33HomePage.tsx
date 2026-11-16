import { ArrowUpRight, ChevronRight, LayoutGrid, RefreshCw, Settings, Terminal } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Skeleton } from '@cherrystudio/ui'
import { modelIconRef, useIcon } from '@cherrystudio/ui/icons'
import { loggerService } from '@logger'
import AppLogo from '@renderer/assets/images/logo.png'
import { A33WindowBar } from '@renderer/components/layout/A33WindowBar'
import { toast } from '@renderer/services/toast'
import { openExternalWebsite } from '@renderer/services/website'
import { showA33Screen } from '@renderer/utils/a33Screen'
import { DEFAULT_SETTINGS_PATH, normalizeSettingsPath } from '@shared/data/types/settingsPath'
import type { A33AccountOverview } from '@shared/ipc/schemas/a33Account'

import { A33LoginDialog } from './A33LoginDialog'
import { cnyFormatter } from './money'
import { useA33Account } from './useA33Account'

const logger = loggerService.withContext('A33HomePage')

const A33_REGISTER_URL = 'https://a33.club/register'
const CLAUDE_ICON_REF = modelIconRef('claude')

/** A33 build: the standalone start screen — open Codex / Claude, see the a33.club balance, or enter the workspace. */
export default function A33HomePage() {
  const { t } = useTranslation()
  const ClaudeIcon = useIcon(CLAUDE_ICON_REF)
  const headerButton =
    'nodrag flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background-subtle text-foreground">
      <A33WindowBar className="h-[clamp(52px,8vh,64px)] border-border-subtle border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <img src={AppLogo} alt="" className="size-[clamp(32px,5.5vh,40px)] rounded-xl" />
          <div className="flex flex-col">
            <span className="font-semibold text-base text-foreground">{t('a33.home.brand_name')}</span>
            <span className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
              {t('a33.home.brand_tagline')}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 pr-2">
          <button type="button" className={headerButton} onClick={() => showA33Screen({ kind: 'workspace' })}>
            <LayoutGrid className="size-4" />
            {t('a33.home.enter_workspace')}
          </button>
          <button
            type="button"
            className={headerButton}
            onClick={() => showA33Screen({ kind: 'workspace', route: normalizeSettingsPath(DEFAULT_SETTINGS_PATH) })}>
            <Settings className="size-4" />
            {t('a33.home.settings')}
          </button>
        </div>
      </A33WindowBar>

      {/*
        No scrolling: spacing and type scale with the window height (clamp + vh) so the page always fits,
        from the 960×600 minimum window up; secondary lines drop out only in very short windows.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto my-auto flex w-full max-w-[clamp(880px,72vw,1160px)] animate-in flex-col px-8 py-[clamp(14px,3.2vh,40px)] duration-300 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
          <section className="flex items-end justify-between gap-4">
            <div>
              <h1 className="m-0 font-bold text-[clamp(19px,3.2vh,28px)] text-foreground leading-tight">
                {t('a33.home.hero_title')}
              </h1>
              <p className="mt-[clamp(4px,0.8vh,8px)] mb-0 text-muted-foreground text-sm">
                {t('a33.home.hero_subtitle')}
              </p>
            </div>
            <span className="shrink-0 text-muted-foreground text-xs">{t('a33.home.hero_badge')}</span>
          </section>

          <section className="mt-[clamp(12px,2.6vh,28px)] grid grid-cols-2 gap-[clamp(12px,2vh,20px)]">
            <AgentCard
              icon={<Terminal className="size-5 text-foreground" />}
              title={t('a33.home.codex.title')}
              description={t('a33.home.codex.description')}
              action={t('a33.home.codex.open')}
              onOpen={() => showA33Screen({ kind: 'agent', agent: 'codex' })}
            />
            <AgentCard
              icon={ClaudeIcon ? <ClaudeIcon className="size-[clamp(20px,3.6vh,30px)]" /> : null}
              tint={ClaudeIcon?.colorPrimary}
              title={t('a33.home.claude.title')}
              description={t('a33.home.claude.description')}
              action={t('a33.home.claude.open')}
              onOpen={() => showA33Screen({ kind: 'agent', agent: 'claude' })}
            />
          </section>

          <AccountCard />

          <footer className="flex items-center justify-between pt-[clamp(10px,2.2vh,24px)] text-muted-foreground text-xs [@media(max-height:680px)]:hidden">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {t('a33.home.footer_left')}
            </span>
            <span>{t('a33.home.footer_right')}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

interface AgentCardProps {
  icon: ReactNode
  /** Brand colour from the icon catalog; tints the icon tile. */
  tint?: string
  title: string
  description: string
  action: string
  onOpen: () => void
}

function AgentCard({ icon, tint, title, description, action, onOpen }: AgentCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex cursor-pointer flex-col rounded-2xl border border-border-subtle bg-card p-[clamp(14px,2.6vh,28px)] text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 active:shadow-sm motion-reduce:transform-none">
      <span
        className={`flex size-[clamp(32px,5.4vh,48px)] items-center justify-center rounded-xl ${tint ? '' : 'bg-muted'}`}
        style={tint ? { backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)` } : undefined}>
        {icon}
      </span>
      <span className="mt-[clamp(8px,1.8vh,20px)] font-semibold text-[clamp(18px,3.2vh,28px)] text-card-foreground leading-tight">
        {title}
      </span>
      <span className="mt-1 text-muted-foreground text-sm">{description}</span>
      <span className="mt-[clamp(10px,2.4vh,28px)] flex items-center justify-between font-medium text-card-foreground text-sm">
        {action}
        <ArrowUpRight className="size-4 text-muted-foreground transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground motion-reduce:transform-none" />
      </span>
    </button>
  )
}

function AccountCard() {
  const { t } = useTranslation()
  const { state, refresh, login, loginWith2fa, logout } = useA33Account()
  const [loginOpen, setLoginOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const reload = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const signOut = async () => {
    try {
      await logout()
    } catch (error) {
      logger.error('a33.club logout failed', error as Error)
      toast.error(t('a33.home.account.sign_out_failed'))
    }
  }

  return (
    <section className="mt-[clamp(12px,2.2vh,20px)] rounded-2xl border border-border-subtle bg-card p-[clamp(14px,2.6vh,28px)]">
      {state.phase === 'loading' && <AccountSkeleton />}

      {state.phase === 'error' && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">{t('a33.home.account.load_failed')}</span>
          <Button type="button" variant="outline" size="sm" loading={refreshing} onClick={() => void reload()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {state.phase === 'signed_out' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="m-0 font-semibold text-base text-card-foreground">{t('a33.home.account.sign_in_title')}</h2>
          </div>
          <div className="mt-[clamp(10px,2.2vh,20px)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="m-0 font-medium text-card-foreground text-sm">{t('a33.home.account.pitch')}</p>
              <p className="mt-1.5 mb-0 text-muted-foreground text-sm">{t('a33.home.account.pitch_detail')}</p>
            </div>
            <Button type="button" size="lg" onClick={() => setLoginOpen(true)}>
              {t('a33.home.account.sign_in')}
            </Button>
          </div>
          <div className="mt-[clamp(10px,2.2vh,20px)] flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('a33.home.account.sign_in_hint')}</span>
            <ExternalLink url={A33_REGISTER_URL}>{t('a33.home.account.register')}</ExternalLink>
          </div>
        </>
      )}

      {state.phase === 'signed_in' && (
        <AccountOverview
          overview={state.overview}
          refreshing={refreshing}
          onRefresh={() => void reload()}
          onSignOut={() => void signOut()}
        />
      )}

      <A33LoginDialog open={loginOpen} onOpenChange={setLoginOpen} login={login} loginWith2fa={loginWith2fa} />
    </section>
  )
}

interface AccountOverviewProps {
  overview: A33AccountOverview
  refreshing: boolean
  onRefresh: () => void
  onSignOut: () => void
}

function AccountOverview({ overview, refreshing, onRefresh, onSignOut }: AccountOverviewProps) {
  const { t, i18n } = useTranslation()
  const yuan = cnyFormatter(i18n.language)
  const count = new Intl.NumberFormat(i18n.language)
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 })

  const remaining = Math.max(overview.balance, 0)
  const total = overview.usedCost + remaining
  const usedRatio = total > 0 ? overview.usedCost / total : 0

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-semibold text-base text-card-foreground">{t('a33.home.account.overview_title')}</h2>
          <p className="mt-1 mb-0 text-muted-foreground text-xs">{overview.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => showA33Screen({ kind: 'account', tab: 'recharge' })}>
            {t('a33.home.account.recharge')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('a33.home.account.refresh')}
            onClick={onRefresh}>
            <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSignOut}>
            {t('a33.home.account.sign_out')}
          </Button>
        </div>
      </div>

      <div className="mt-[clamp(10px,2.4vh,24px)] grid grid-cols-3 divide-x divide-border-subtle">
        <Stat label={t('a33.home.account.total')} value={yuan.format(total)} />
        <Stat label={t('a33.home.account.used')} value={yuan.format(overview.usedCost)} />
        <Stat label={t('a33.home.account.remaining')} value={yuan.format(remaining)} />
      </div>

      <div className="mt-[clamp(10px,2.4vh,24px)] flex items-center justify-between text-muted-foreground text-xs">
        <span>{t('a33.home.account.usage_label')}</span>
        <span>
          {t('a33.home.account.usage_ratio', {
            used: percent.format(usedRatio),
            remaining: percent.format(1 - usedRatio)
          })}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={t('a33.home.account.usage_label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(usedRatio * 100)}>
        <div className="h-full rounded-full bg-foreground-tertiary" style={{ width: `${usedRatio * 100}%` }} />
      </div>

      <div className="mt-[clamp(10px,2vh,20px)] flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {t('a33.home.account.formula')} ·{' '}
          {t('a33.home.account.tokens', {
            total: count.format(overview.totalTokens),
            today: count.format(overview.todayTokens)
          })}
        </span>
        <button
          type="button"
          onClick={() => showA33Screen({ kind: 'account', tab: 'usage' })}
          className="flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-medium text-card-foreground text-xs hover:underline">
          {t('a33.home.account.usage_details')}
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </>
  )
}

/** Same footprint as the signed-in overview, so the page does not jump when the data lands. */
function AccountSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-2 h-3.5 w-40" />
      <div className="mt-[clamp(10px,2.4vh,24px)] grid grid-cols-3 gap-6">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-[clamp(24px,4.4vh,40px)] w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-[clamp(14px,3vh,28px)] h-1.5 w-full" />
      <Skeleton className="mt-[clamp(10px,2.4vh,24px)] h-3.5 w-64" />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[clamp(2px,0.6vh,6px)] px-6 first:pl-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate font-semibold text-[clamp(20px,3.8vh,34px)] text-card-foreground leading-tight tabular-nums">
        {value}
      </span>
    </div>
  )
}

function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => void openExternalWebsite(url)}
      className="flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 font-medium text-card-foreground text-xs hover:underline">
      {children}
      <ArrowUpRight className="size-3.5" />
    </button>
  )
}
