import './a33Skins.css'
import { type TFunction } from 'i18next'
import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  GitCompare,
  Laptop,
  LayoutGrid,
  Search,
  Settings,
  Square,
  SquarePen,
  Terminal,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Spinner } from '@cherrystudio/ui'
import { A33WindowBar } from '@renderer/components/layout/A33WindowBar'
import { showA33Screen } from '@renderer/utils/a33Screen'
import { cn } from '@renderer/utils/style'
import { DEFAULT_SETTINGS_PATH, normalizeSettingsPath } from '@shared/data/types/settingsPath'

import { A33EffortMenu, A33ModelMenu, useA33ComposerInput } from './A33ComposerParts'
import { A33ComposerSlot, A33ConversationMessages, isConversationEmpty } from './A33Conversation'
import { A33SetupState } from './A33SetupState'
import { A33ChangesList, A33PlanList } from './A33SidePanels'
import { type A33AgentChat, useA33AgentChat } from './useA33AgentChat'

const SKIN = 'a33-skin-codex'
const RENDER_CONFIG = { messageStyle: 'bubble', messageFont: 'system', fontSize: 14, narrowMode: true } as const

/** Compact age like the Codex thread list ("now", "5m", "3h", "2d", "4w"). */
function compactAge(t: TFunction, iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return t('a33.agent_screen.codex.age_now')
  if (minutes < 60) return t('a33.agent_screen.codex.age_minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('a33.agent_screen.codex.age_hours', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('a33.agent_screen.codex.age_days', { n: days })
  return t('a33.agent_screen.codex.age_weeks', { n: Math.floor(days / 7) })
}

/**
 * A33 build: Codex in the layout of the current Codex view of the ChatGPT desktop app — app switcher,
 * project-grouped threads with search, a review pane — on the Pi agent with an a33 GPT model.
 */
export default function CodexScreen() {
  const chat = useA33AgentChat('codex')
  const [reviewOpen, setReviewOpen] = useState(false)
  const showReview = reviewOpen && chat.setup === 'ready' && !isConversationEmpty(chat)

  return (
    <div className={`${SKIN} a33-hide-scrollbars flex h-screen w-screen overflow-hidden bg-background text-foreground`}>
      <CodexSidebar chat={chat} />
      <main className="flex min-w-0 flex-1 flex-col">
        <A33WindowBar className="gap-2 px-4">
          <CodexTitle chat={chat} />
          {chat.setup === 'ready' && !isConversationEmpty(chat) && (
            <ReviewToggle count={chat.changes.length} open={reviewOpen} onToggle={() => setReviewOpen((v) => !v)} />
          )}
        </A33WindowBar>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {chat.setup === 'ready' ? <CodexBody chat={chat} /> : <A33SetupState chat={chat} kind="codex" />}
          </div>
          {showReview && <ReviewPane chat={chat} />}
        </div>
      </main>
    </div>
  )
}

function CodexTitle({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  const session = chat.sessions.find((item) => item.id === chat.sessionId)
  if (!session || isConversationEmpty(chat)) return <span className="flex-1" />
  return (
    <span className="nodrag min-w-0 flex-1 truncate font-medium text-foreground text-sm">
      {session.name || t('a33.agent_screen.untitled')}
    </span>
  )
}

function ReviewToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={onToggle}
      className={cn(
        'nodrag flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[13px] transition-colors',
        open ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}>
      <GitCompare className="size-3.5" />
      {t('a33.agent_screen.codex.review')}
      {count > 0 && <span className="rounded bg-muted px-1 text-xs tabular-nums">{count}</span>}
    </button>
  )
}

/** Right-hand review pane: the task plan and the files Codex changed. */
function ReviewPane({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  return (
    <aside className="flex w-[340px] shrink-0 flex-col gap-5 overflow-y-auto border-border border-l bg-background-subtle p-4">
      <section>
        <h3 className="m-0 mb-2 font-medium text-foreground text-xs">{t('a33.agent_screen.changes')}</h3>
        <A33ChangesList files={chat.changes} />
      </section>
      <section>
        <h3 className="m-0 mb-2 font-medium text-foreground text-xs">{t('a33.agent_screen.plan')}</h3>
        <A33PlanList tasks={chat.status.tasks} completed={chat.status.completedTaskCount} />
      </section>
    </aside>
  )
}

/** Top-left app switcher, standing in for ChatGPT's ChatGPT / Codex switcher. */
function AppSwitcher() {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="nodrag flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-foreground text-sm hover:bg-sidebar-accent">
          <Terminal className="size-4" />
          Codex
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={SKIN}>
        <DropdownMenuItem onSelect={() => showA33Screen({ kind: 'launcher' })}>
          <ArrowLeft className="size-4" />
          {t('a33.agent_screen.back')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => showA33Screen({ kind: 'workspace' })}>
          <LayoutGrid className="size-4" />
          {t('a33.home.enter_workspace')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CodexSidebar({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [projectOpen, setProjectOpen] = useState(true)
  const now = Date.now()
  const needle = query.trim().toLowerCase()
  const threads = needle
    ? chat.sessions.filter((session) => (session.name || t('a33.agent_screen.untitled')).toLowerCase().includes(needle))
    : chat.sessions

  const row = 'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-sidebar-accent'

  return (
    <aside className="flex w-[268px] shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground">
      <A33WindowBar className="pl-2">
        <AppSwitcher />
      </A33WindowBar>

      <div className="flex flex-col gap-0.5 px-2 pt-1">
        <button type="button" onClick={() => void chat.newSession()} className={row}>
          <SquarePen className="size-4" />
          {t('a33.agent_screen.codex.new_thread')}
        </button>
        <button type="button" onClick={() => showA33Screen({ kind: 'launcher' })} className={row}>
          <ArrowLeft className="size-4" />
          {t('a33.agent_screen.back')}
        </button>
        <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground focus-within:bg-sidebar-accent">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('a33.agent_screen.codex.search')}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="mt-4 px-4 pb-1 font-medium text-muted-foreground text-xs">
        {t('a33.agent_screen.codex.threads')}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <button
          type="button"
          onClick={() => setProjectOpen((open) => !open)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-sidebar-accent">
          <ChevronRight
            className={cn('size-3.5 text-muted-foreground transition-transform', projectOpen && 'rotate-90')}
          />
          <Folder className="size-4 text-muted-foreground" />
          <span className="truncate">{t('a33.agent_screen.codex.default_project')}</span>
        </button>
        {projectOpen &&
          threads.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group ml-5 flex items-center rounded-md',
                session.id === chat.sessionId
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent'
              )}>
              <button
                type="button"
                onClick={() => chat.selectSession(session.id)}
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px]">
                {session.name || t('a33.agent_screen.untitled')}
              </button>
              <span className="pr-2 text-muted-foreground text-xs tabular-nums group-hover:hidden">
                {compactAge(t, session.lastActivityAt, now)}
              </span>
              <button
                type="button"
                aria-label={t('a33.agent_screen.delete')}
                onClick={() => void chat.removeSession(session.id)}
                className="mr-1 hidden size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground group-hover:flex">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
      </div>

      <div className="border-sidebar-border border-t p-2">
        <button
          type="button"
          onClick={() => showA33Screen({ kind: 'workspace', route: normalizeSettingsPath(DEFAULT_SETTINGS_PATH) })}
          className={row}>
          <Settings className="size-4" />
          {t('a33.agent_screen.settings')}
        </button>
      </div>
    </aside>
  )
}

function CodexBody({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()

  if (!chat.sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner text={t('common.loading')} />
      </div>
    )
  }

  if (isConversationEmpty(chat)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[10vh]">
        <span className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-border bg-card">
          <Terminal className="size-6 text-foreground" />
        </span>
        <h1 className="m-0 font-semibold text-[28px] text-foreground tracking-tight">
          {t('a33.agent_screen.codex.empty_title')}
        </h1>
        <p className="mt-2 mb-8 text-muted-foreground text-sm">{t('a33.agent_screen.codex.empty_subtitle')}</p>
        <div className="w-full max-w-[720px]">
          <A33ComposerSlot chat={chat} composer={<CodexComposer chat={chat} />} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <A33ConversationMessages chat={chat} renderConfig={RENDER_CONFIG} />
      </div>
      <div className="mx-auto w-full max-w-[800px] px-4 pb-4">
        <A33ComposerSlot chat={chat} composer={<CodexComposer chat={chat} />} />
      </div>
    </>
  )
}

function CodexComposer({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  const input = useA33ComposerInput(chat)
  const chip = 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-muted-foreground text-xs'

  return (
    <div>
      <div className="rounded-3xl border border-border bg-card px-4 pt-3.5 pb-2.5 focus-within:border-border-strong">
        <textarea
          autoFocus
          rows={2}
          value={input.text}
          onChange={(event) => input.setText(event.target.value)}
          onKeyDown={input.onKeyDown}
          placeholder={t('a33.agent_screen.codex.placeholder')}
          className="max-h-60 min-h-11 w-full resize-none border-0 bg-transparent p-0 text-foreground text-sm leading-6 outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-0.5">
            <A33ModelMenu
              chat={chat}
              className={`${chip} max-w-60 hover:bg-accent hover:text-foreground`}
              contentClassName={SKIN}
            />
            <A33EffortMenu
              chat={chat}
              className={`${chip} hover:bg-accent hover:text-foreground`}
              contentClassName={SKIN}
            />
          </div>
          {input.running ? (
            <button
              type="button"
              aria-label={t('a33.agent_screen.stop')}
              onClick={input.stop}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={t('a33.agent_screen.send')}
              disabled={!input.canSubmit}
              onClick={() => void input.submit()}
              className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30">
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 px-2">
        <span className={chip}>
          <Laptop className="size-3.5" />
          {t('a33.agent_screen.codex.environment_local')}
        </span>
      </div>
    </div>
  )
}
