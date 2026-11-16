import { ArrowLeft, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Spinner } from '@cherrystudio/ui'
import { A33WindowBar } from '@renderer/components/layout/A33WindowBar'
import { type A33AccountTab, showA33Screen } from '@renderer/utils/a33Screen'
import { cn } from '@renderer/utils/style'

import { A33LoginDialog } from '../A33LoginDialog'
import { cnyFormatter } from '../money'
import { useA33Account } from '../useA33Account'
import { OrdersPanel } from './OrdersPanel'
import { RechargePanel } from './RechargePanel'
import { UsagePanel } from './UsagePanel'

const TAB_KEYS: Record<A33AccountTab, string> = {
  usage: 'a33.account.tab_usage',
  recharge: 'a33.account.tab_recharge',
  orders: 'a33.account.tab_orders'
}

/** A33 build: the a33.club account centre — usage history, top-up and orders, all inside the client. */
export default function A33AccountScreen({ initialTab = 'usage' }: { initialTab?: A33AccountTab }) {
  const { t, i18n } = useTranslation()
  const account = useA33Account()
  const [tab, setTab] = useState<A33AccountTab>(initialTab)
  const [loginOpen, setLoginOpen] = useState(false)
  const yuan = cnyFormatter(i18n.language)
  const { state } = account

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background-subtle text-foreground">
      <A33WindowBar className="relative h-14 gap-3 border-border-subtle border-b bg-background px-4">
        <button
          type="button"
          onClick={() => showA33Screen({ kind: 'launcher' })}
          className="nodrag flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t('a33.agent_screen.back')}
        </button>
        <span className="font-semibold text-foreground text-sm">{t('a33.account.title')}</span>
        {state.phase === 'signed_in' && (
          <div className="nodrag absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {(Object.keys(TAB_KEYS) as A33AccountTab[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    'rounded-md px-3 py-1 text-[13px] transition-colors',
                    tab === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}>
                  {t(TAB_KEYS[value])}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1" />
        {state.phase === 'signed_in' && (
          <span className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[13px] tabular-nums">
            <Wallet className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{t('a33.account.balance')}</span>
            <b className="font-semibold text-foreground">{yuan.format(Math.max(state.overview.balance, 0))}</b>
          </span>
        )}
      </A33WindowBar>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto w-full max-w-[1000px] px-8 py-6">
          {state.phase === 'loading' && (
            <div className="flex justify-center py-24">
              <Spinner text={t('common.loading')} />
            </div>
          )}
          {(state.phase === 'signed_out' || state.phase === 'error') && (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <p className="m-0 text-muted-foreground text-sm">
                {state.phase === 'error' ? t('a33.home.account.load_failed') : t('a33.account.sign_in_required')}
              </p>
              {state.phase === 'error' ? (
                <Button type="button" variant="outline" onClick={() => void account.refresh()}>
                  {t('common.retry')}
                </Button>
              ) : (
                <Button type="button" onClick={() => setLoginOpen(true)}>
                  {t('a33.home.account.sign_in')}
                </Button>
              )}
            </div>
          )}
          {state.phase === 'signed_in' && (
            <>
              {tab === 'usage' && <UsagePanel />}
              {tab === 'recharge' && <RechargePanel onPaid={() => void account.refresh()} />}
              {tab === 'orders' && <OrdersPanel />}
            </>
          )}
        </div>
      </div>

      <A33LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        login={account.login}
        loginWith2fa={account.loginWith2fa}
      />
    </div>
  )
}
