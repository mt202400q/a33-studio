import { Check, ChevronDown, ShieldCheck } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@cherrystudio/ui'
import { loggerService } from '@logger'
import { AGENT_RUNTIME_CAPABILITIES } from '@shared/ai/agentRuntimeCapabilities'
import type { AgentPermissionMode } from '@shared/data/api/schemas/agents'
import type { ReasoningEffortOption } from '@shared/types/aiSdk'

import type { A33AgentChat } from './useA33AgentChat'

const logger = loggerService.withContext('A33Composer')

/** Plain-text composer behaviour shared by the skins: Enter sends, Shift+Enter breaks the line. */
export function useA33ComposerInput(chat: A33AgentChat) {
  const [text, setText] = useState('')
  const running = chat.runtime.isPending
  const canSubmit = chat.canSend && text.trim().length > 0

  const submit = async () => {
    if (!canSubmit) return
    const draft = text
    setText('')
    try {
      if (!(await chat.send(draft))) setText(draft)
    } catch (error) {
      logger.error('Failed to send message', error as Error)
      setText(draft)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void submit()
  }

  return { text, setText, onKeyDown, submit, canSubmit, running, stop: () => void chat.runtime.stop() }
}

/** Model picker over the skin's a33 models; `contentClassName` keeps the skin palette inside the portal. */
export function A33ModelMenu({
  chat,
  className,
  contentClassName
}: {
  chat: A33AgentChat
  className: string
  contentClassName: string
}) {
  const { activeModel, skinModels } = chat
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={className} disabled={skinModels.length === 0}>
          <span className="truncate">{activeModel?.name ?? chat.agent?.model ?? ''}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        <ModelItems chat={chat} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelItems({ chat }: { chat: A33AgentChat }) {
  return chat.skinModels.map((model) => (
    <DropdownMenuItem key={model.id} onSelect={() => void chat.changeModel(model.id)}>
      <span className="flex-1 truncate">{model.name}</span>
      {model.id === chat.activeModel?.id && <Check className="size-4" />}
    </DropdownMenuItem>
  ))
}

const EFFORT_LABEL_KEYS: Record<ReasoningEffortOption, string> = {
  default: 'assistants.settings.reasoning_effort.default',
  none: 'assistants.settings.reasoning_effort.off',
  minimal: 'assistants.settings.reasoning_effort.minimal',
  low: 'assistants.settings.reasoning_effort.low',
  medium: 'assistants.settings.reasoning_effort.medium',
  high: 'assistants.settings.reasoning_effort.high',
  xhigh: 'assistants.settings.reasoning_effort.xhigh',
  max: 'assistants.settings.reasoning_effort.max',
  ultra: 'assistants.settings.reasoning_effort.ultra',
  auto: 'assistants.settings.reasoning_effort.auto'
}

function EffortItems({ chat }: { chat: A33AgentChat }) {
  const { t } = useTranslation()
  return chat.effortOptions.map((option) => (
    <DropdownMenuItem key={option} onSelect={() => void chat.changeEffort(option)}>
      <span className="flex-1">{t(EFFORT_LABEL_KEYS[option])}</span>
      {option === chat.effort && <Check className="size-4" />}
    </DropdownMenuItem>
  ))
}

/** Reasoning-effort picker; hidden when the model declares no selectable efforts. */
export function A33EffortMenu({
  chat,
  className,
  contentClassName
}: {
  chat: A33AgentChat
  className: string
  contentClassName: string
}) {
  const { t } = useTranslation()
  if (chat.effortOptions.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={className}>
          <span className="truncate">{t(EFFORT_LABEL_KEYS[chat.effort])}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={contentClassName}>
        <EffortItems chat={chat} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One menu for model and effort, as in the current Claude app. */
export function A33ModelEffortMenu({
  chat,
  className,
  contentClassName
}: {
  chat: A33AgentChat
  className: string
  contentClassName: string
}) {
  const { t } = useTranslation()
  const label = chat.activeModel?.name ?? chat.agent?.model ?? ''
  const showEffort = chat.effortOptions.length > 0 && chat.effort !== 'default'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={className} disabled={chat.skinModels.length === 0}>
          <span className="truncate">
            {label}
            {showEffort && <span className="opacity-70"> · {t(EFFORT_LABEL_KEYS[chat.effort])}</span>}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        <DropdownMenuLabel>{t('a33.agent_screen.model')}</DropdownMenuLabel>
        <ModelItems chat={chat} />
        {chat.effortOptions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('assistants.settings.reasoning_effort.label')}</DropdownMenuLabel>
            <EffortItems chat={chat} />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const PERMISSION_LABEL_KEYS: Record<AgentPermissionMode, string> = {
  default: 'agent.settings.tooling.permissionMode.default.title',
  plan: 'agent.settings.tooling.permissionMode.plan.title',
  acceptEdits: 'agent.settings.tooling.permissionMode.acceptEdits.title',
  auto: 'agent.settings.tooling.permissionMode.auto.title',
  bypassPermissions: 'agent.settings.tooling.permissionMode.bypassPermissions.title'
}

/** Permission mode of the agent, limited to the modes its runtime supports. */
export function A33PermissionMenu({
  chat,
  className,
  contentClassName
}: {
  chat: A33AgentChat
  className: string
  contentClassName: string
}) {
  const { t } = useTranslation()
  const modes = chat.agent ? AGENT_RUNTIME_CAPABILITIES[chat.agent.type].permissionModes : []
  const current =
    chat.permissionMode ??
    (chat.agent ? AGENT_RUNTIME_CAPABILITIES[chat.agent.type].createDefaults.permissionMode : undefined)
  if (!current || modes.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={className}>
          <ShieldCheck className="size-3.5 shrink-0" />
          <span className="truncate">{t(PERMISSION_LABEL_KEYS[current])}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={contentClassName}>
        {modes.map((mode) => (
          <DropdownMenuItem key={mode} onSelect={() => void chat.changePermissionMode(mode)}>
            <span className="flex-1">{t(PERMISSION_LABEL_KEYS[mode])}</span>
            {mode === current && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
