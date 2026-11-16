import './a33Skins.css'
import { ArrowLeft, ArrowUp, Laptop, PanelLeft, PanelRight, Plus, Settings, Square, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Spinner } from '@cherrystudio/ui'
import { modelIconRef, useIcon } from '@cherrystudio/ui/icons'
import { usePreference } from '@data/hooks/usePreference'
import { A33WindowBar } from '@renderer/components/layout/A33WindowBar'
import { showA33Screen } from '@renderer/utils/a33Screen'
import { cn } from '@renderer/utils/style'
import { DEFAULT_SETTINGS_PATH, normalizeSettingsPath } from '@shared/data/types/settingsPath'

import { A33ModelEffortMenu, A33PermissionMenu, useA33ComposerInput } from './A33ComposerParts'
import { A33ComposerSlot, A33ConversationMessages, isConversationEmpty } from './A33Conversation'
import { A33SetupState } from './A33SetupState'
import { A33ChangesList, A33PlanList } from './A33SidePanels'
import { type A33AgentChat, useA33AgentChat } from './useA33AgentChat'

const SKIN = 'a33-skin-claude'
const RENDER_CONFIG = { messageStyle: 'bubble', messageFont: 'system', fontSize: 15, narrowMode: true } as const
const CLAUDE_ICON_REF = modelIconRef('claude')

type ClaudeTab = 'chat' | 'code'

/** Time-of-day greeting, addressed by name when the user has set one. */
function useGreeting(): string {
  const { t } = useTranslation()
  const [userName] = usePreference('app.user.name')
  const hour = new Date().getHours()
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  if (!userName) {
    if (part === 'morning') return t('a33.agent_screen.claude.greeting_morning')
    if (part === 'afternoon') return t('a33.agent_screen.claude.greeting_afternoon')
    return t('a33.agent_screen.claude.greeting_evening')
  }
  if (part === 'morning') return t('a33.agent_screen.claude.greeting_morning_named', { name: userName })
  if (part === 'afternoon') return t('a33.agent_screen.claude.greeting_afternoon_named', { name: userName })
  return t('a33.agent_screen.claude.greeting_evening_named', { name: userName })
}

/**
 * A33 build: Claude in the layout of the current Claude desktop app — a Chat tab and a Code tab,
 * each on its own Claude Code agent so their histories stay apart.
 */
export default function ClaudeScreen() {
  const [tab, setTab] = useState<ClaudeTab>('chat')
  return (
    <div className={`${SKIN} a33-hide-scrollbars flex h-screen w-screen overflow-hidden bg-background text-foreground`}>
      {tab === 'chat' ? <ClaudeChatTab onTab={setTab} /> : <ClaudeCodeTab onTab={setTab} />}
    </div>
  )
}

function TabSwitch({ tab, onTab }: { tab: ClaudeTab; onTab: (tab: ClaudeTab) => void }) {
  const { t } = useTranslation()
  const item = (value: ClaudeTab, label: string) => (
    <button
      type="button"
      onClick={() => onTab(value)}
      aria-pressed={tab === value}
      className={cn(
        'rounded-md px-3 py-1 text-[13px] transition-colors',
        tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}>
      {label}
    </button>
  )
  return (
    <div className="nodrag flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {item('chat', t('a33.agent_screen.claude.tab_chat'))}
      {item('code', t('a33.agent_screen.claude.tab_code'))}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="nodrag flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
      {children}
    </button>
  )
}

function ClaudeSidebar({
  chat,
  title,
  newLabel,
  onCollapse
}: {
  chat: A33AgentChat
  title: string
  newLabel: string
  onCollapse: () => void
}) {
  const { t } = useTranslation()
  const ClaudeIcon = useIcon(CLAUDE_ICON_REF)
  const [userName] = usePreference('app.user.name')
  const displayName = userName || 'A33'
  const row = 'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent'

  return (
    <aside className="flex w-[272px] shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground">
      <A33WindowBar className="gap-2 pr-2 pl-3">
        <IconButton label={t('a33.agent_screen.toggle_sidebar')} onClick={onCollapse}>
          <PanelLeft className="size-[18px]" />
        </IconButton>
        <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-semibold text-[15px] text-foreground">
          {ClaudeIcon && <ClaudeIcon className="size-[18px] shrink-0" />}
          {title}
        </span>
      </A33WindowBar>

      <div className="flex flex-col gap-0.5 px-2 pt-1">
        <button type="button" onClick={() => void chat.newSession()} className={`${row} font-medium text-foreground`}>
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-4" strokeWidth={2.5} />
          </span>
          {newLabel}
        </button>
        <button type="button" onClick={() => showA33Screen({ kind: 'launcher' })} className={row}>
          <span className="flex size-6 items-center justify-center">
            <ArrowLeft className="size-4" />
          </span>
          {t('a33.agent_screen.back')}
        </button>
      </div>

      <div className="mt-4 px-4 pb-1 font-medium text-muted-foreground text-xs">{t('a33.agent_screen.recents')}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {chat.sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'group flex items-center rounded-lg',
              session.id === chat.sessionId
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent'
            )}>
            <button
              type="button"
              onClick={() => chat.selectSession(session.id)}
              className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm">
              {session.name || t('a33.agent_screen.untitled')}
            </button>
            <button
              type="button"
              aria-label={t('a33.agent_screen.delete')}
              onClick={() => void chat.removeSession(session.id)}
              className="mr-1 hidden size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground group-hover:flex">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-sidebar-border border-t px-3 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-foreground font-medium text-background text-sm">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground text-sm">{displayName}</span>
        <IconButton
          label={t('a33.agent_screen.settings')}
          onClick={() => showA33Screen({ kind: 'workspace', route: normalizeSettingsPath(DEFAULT_SETTINGS_PATH) })}>
          <Settings className="size-4" />
        </IconButton>
      </div>
    </aside>
  )
}

/** Sidebar + window bar shared by both tabs; `rail` is an optional right-hand panel. */
function ClaudeFrame({
  chat,
  tab,
  onTab,
  title,
  newLabel,
  barActions,
  rail,
  children
}: {
  chat: A33AgentChat
  tab: ClaudeTab
  onTab: (tab: ClaudeTab) => void
  title: string
  newLabel: string
  barActions?: ReactNode
  rail?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  return (
    <>
      {sidebarOpen && (
        <ClaudeSidebar chat={chat} title={title} newLabel={newLabel} onCollapse={() => setSidebarOpen(false)} />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <A33WindowBar className="relative gap-2 px-3">
          {!sidebarOpen && (
            <IconButton label={t('a33.agent_screen.toggle_sidebar')} onClick={() => setSidebarOpen(true)}>
              <PanelLeft className="size-[18px]" />
            </IconButton>
          )}
          {/* Centred on the whole bar and only as wide as the switch: a full-width layer would inherit the
              drag region and swallow clicks on the buttons under it. */}
          <div className="nodrag absolute left-1/2 -translate-x-1/2">
            <TabSwitch tab={tab} onTab={onTab} />
          </div>
          <div className="flex-1" />
          {barActions}
        </A33WindowBar>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {chat.setup === 'ready' ? children : <A33SetupState chat={chat} kind="claude" />}
          </div>
          {chat.setup === 'ready' && rail}
        </div>
      </main>
    </>
  )
}

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner text={t('common.loading')} />
    </div>
  )
}

// ─── Chat tab ────────────────────────────────────────────────────────────────

function ClaudeChatTab({ onTab }: { onTab: (tab: ClaudeTab) => void }) {
  const { t } = useTranslation()
  const chat = useA33AgentChat('claude')
  const greeting = useGreeting()
  const ClaudeIcon = useIcon(CLAUDE_ICON_REF)

  let body: ReactNode
  if (!chat.sessionId) body = <Loading />
  else if (isConversationEmpty(chat)) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[12vh]">
        <h1 className="m-0 mb-7 flex items-center gap-3 font-semibold text-[32px] text-foreground tracking-tight">
          {ClaudeIcon && <ClaudeIcon className="size-8" />}
          {greeting}
        </h1>
        <div className="w-full max-w-[680px]">
          <A33ComposerSlot chat={chat} composer={<ChatComposer chat={chat} />} />
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <A33ConversationMessages chat={chat} renderConfig={RENDER_CONFIG} />
        </div>
        <div className="mx-auto w-full max-w-[768px] px-4 pb-4">
          <A33ComposerSlot chat={chat} composer={<ChatComposer chat={chat} />} />
        </div>
      </>
    )
  }

  return (
    <ClaudeFrame chat={chat} tab="chat" onTab={onTab} title="Claude" newLabel={t('a33.agent_screen.claude.new_chat')}>
      {body}
    </ClaudeFrame>
  )
}

function SendButton({ input }: { input: ReturnType<typeof useA33ComposerInput> }) {
  const { t } = useTranslation()
  return input.running ? (
    <button
      type="button"
      aria-label={t('a33.agent_screen.stop')}
      onClick={input.stop}
      className="flex size-8 items-center justify-center rounded-full bg-foreground text-background">
      <Square className="size-3 fill-current" />
    </button>
  ) : (
    <button
      type="button"
      aria-label={t('a33.agent_screen.send')}
      disabled={!input.canSubmit}
      onClick={() => void input.submit()}
      className="flex size-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-25">
      <ArrowUp className="size-[18px]" strokeWidth={2.25} />
    </button>
  )
}

function ChatComposer({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  const input = useA33ComposerInput(chat)
  return (
    <div className="rounded-3xl border border-border bg-card px-4 pt-3.5 pb-2.5 shadow-sm focus-within:border-border-strong">
      <textarea
        autoFocus
        rows={2}
        value={input.text}
        onChange={(event) => input.setText(event.target.value)}
        onKeyDown={input.onKeyDown}
        placeholder={t('a33.agent_screen.claude.placeholder')}
        className="max-h-60 min-h-12 w-full resize-none border-0 bg-transparent p-0 text-[15px] text-foreground leading-6 outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-1.5 flex items-center justify-end gap-2">
        <A33ModelEffortMenu
          chat={chat}
          className="flex max-w-64 items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
          contentClassName={SKIN}
        />
        <SendButton input={input} />
      </div>
    </div>
  )
}

// ─── Code tab ────────────────────────────────────────────────────────────────

function ClaudeCodeTab({ onTab }: { onTab: (tab: ClaudeTab) => void }) {
  const { t } = useTranslation()
  const chat = useA33AgentChat('claudeCode')
  const [railOpen, setRailOpen] = useState(true)
  const empty = !chat.sessionId || isConversationEmpty(chat)

  let body: ReactNode
  if (!chat.sessionId) body = <Loading />
  else if (isConversationEmpty(chat)) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[10vh]">
        <h1 className="m-0 mb-7 font-semibold text-[28px] text-foreground tracking-tight">
          {t('a33.agent_screen.claude.code_empty_title')}
        </h1>
        <div className="w-full max-w-[720px]">
          <A33ComposerSlot chat={chat} composer={<CodeComposer chat={chat} />} />
        </div>
      </div>
    )
  } else {
    body = (
      <>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <A33ConversationMessages chat={chat} renderConfig={RENDER_CONFIG} />
        </div>
        <div className="mx-auto w-full max-w-[800px] px-4 pb-4">
          <A33ComposerSlot chat={chat} composer={<CodeComposer chat={chat} />} />
        </div>
      </>
    )
  }

  return (
    <ClaudeFrame
      chat={chat}
      tab="code"
      onTab={onTab}
      title="Claude Code"
      newLabel={t('a33.agent_screen.claude.new_session')}
      barActions={
        !empty && (
          <IconButton label={t('a33.agent_screen.claude.toggle_rail')} onClick={() => setRailOpen((open) => !open)}>
            <PanelRight className="size-[18px]" />
          </IconButton>
        )
      }
      rail={!empty && railOpen && <SessionRail chat={chat} />}>
      {body}
    </ClaudeFrame>
  )
}

function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-card p-3">
      <h3 className="m-0 mb-2 font-medium text-foreground text-xs">{title}</h3>
      {children}
    </section>
  )
}

/** Right-hand session rail of the Code tab: where it runs, the plan, and the changed files. */
function SessionRail({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-border-subtle border-l bg-background-subtle p-3">
      <RailCard title={t('a33.agent_screen.claude.rail_environment')}>
        <div className="flex flex-col gap-1 text-[13px]">
          <span className="flex items-center gap-1.5 text-foreground">
            <Laptop className="size-3.5 text-muted-foreground" />
            {t('a33.agent_screen.claude.environment_local')}
          </span>
          <span className="truncate text-muted-foreground text-xs">{chat.activeModel?.name}</span>
        </div>
      </RailCard>
      <RailCard title={t('a33.agent_screen.plan')}>
        <A33PlanList tasks={chat.status.tasks} completed={chat.status.completedTaskCount} />
      </RailCard>
      <RailCard title={t('a33.agent_screen.changes')}>
        <A33ChangesList files={chat.changes} />
      </RailCard>
    </aside>
  )
}

function CodeComposer({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  const input = useA33ComposerInput(chat)
  const chip =
    'flex max-w-56 items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground'
  return (
    <div>
      <div className="rounded-2xl border border-border bg-card px-4 pt-3.5 pb-2.5 shadow-sm focus-within:border-border-strong">
        <textarea
          autoFocus
          rows={2}
          value={input.text}
          onChange={(event) => input.setText(event.target.value)}
          onKeyDown={input.onKeyDown}
          placeholder={t('a33.agent_screen.claude.code_placeholder')}
          className="max-h-60 min-h-12 w-full resize-none border-0 bg-transparent p-0 text-[14px] text-foreground leading-6 outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-1.5 flex items-center justify-end">
          <SendButton input={input} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 px-1">
        <span className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground text-xs">
          <Laptop className="size-3.5" />
          {t('a33.agent_screen.claude.environment_local')}
        </span>
        <A33PermissionMenu chat={chat} className={chip} contentClassName={SKIN} />
        <div className="ml-auto">
          <A33ModelEffortMenu chat={chat} className={chip} contentClassName={SKIN} />
        </div>
      </div>
    </div>
  )
}
