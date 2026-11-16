import { useCallback, useEffect, useMemo, useState } from 'react'

import { dataApiService } from '@data/DataApiService'
import { useInvalidateCache } from '@data/hooks/useDataApi'
import { loggerService } from '@logger'
import { createComposerUserMessageParts } from '@renderer/components/composer/composerDraft'
import { useAgent, useUpdateAgent } from '@renderer/hooks/agent/useAgent'
import { useSessions } from '@renderer/hooks/agent/useSession'
import { useModels } from '@renderer/hooks/useModel'
import { ipcApi } from '@renderer/ipc'
import { pickModel } from '@renderer/utils/a33'
import { deriveThinkingOptions } from '@shared/ai/reasoning'
import type { AgentPermissionMode, AgentType } from '@shared/data/api/schemas/agents'
import type { CherryUIMessage } from '@shared/data/types/message'
import type { Model, UniqueModelId } from '@shared/data/types/model'
import type { ReasoningEffortOption } from '@shared/types/aiSdk'
import { getRawModelId, isNonChatModel } from '@shared/utils/model'

import { buildAgentRightPaneStatus } from '../components/AgentRightPane'
import { useAgentChatRuntimeState } from '../useAgentChatRuntimeState'
import { useClaudeCodeBinary } from '../useClaudeCodeBinary'
import { collectChangedFiles } from './agentChanges'

const logger = loggerService.withContext('useA33AgentChat')

const A33_PROVIDER_ID = 'a33'
const EMPTY_MESSAGES: CherryUIMessage[] = []

const CLAUDE_MODELS = [/claude-sonnet/, /claude-opus/, /claude/]

/** Each screen (and Claude's Chat / Code tabs) has its own agent, so their histories stay apart. */
const AGENT_SPECS = {
  claude: { name: 'Claude', type: 'claude-code', models: CLAUDE_MODELS },
  claudeCode: { name: 'Claude Code', type: 'claude-code', models: CLAUDE_MODELS },
  // There is no Codex agent runtime; Codex runs as a Pi agent on an a33 GPT model.
  codex: { name: 'Codex', type: 'pi', models: [/codex/, /^gpt-/] }
} as const satisfies Record<string, { name: string; type: AgentType; models: readonly RegExp[] }>

export type A33AgentSpecKey = keyof typeof AGENT_SPECS

export type A33AgentSetup = 'loading' | 'ready' | 'no_model' | 'failed'

/** Models of the a33 provider this skin offers in its model picker. */
function useSkinModels(kind: A33AgentSpecKey) {
  const { models, isLoading } = useModels({ providerId: A33_PROVIDER_ID, enabled: true })
  const family = AGENT_SPECS[kind].models
  const skinModels = useMemo(
    () =>
      models.filter(
        (model) =>
          !model.isHidden && !isNonChatModel(model) && family.some((pattern) => pattern.test(getRawModelId(model)))
      ),
    [family, models]
  )
  return { skinModels, isLoading }
}

/** Finds the skin's agent, creating it on first use with the newest matching a33 model. */
function useEnsureAgent(kind: A33AgentSpecKey, skinModels: readonly Model[], modelsLoading: boolean) {
  const [agentId, setAgentId] = useState<string>()
  const [setup, setSetup] = useState<A33AgentSetup>('loading')
  const invalidate = useInvalidateCache()

  useEffect(() => {
    if (agentId || modelsLoading) return
    let cancelled = false
    const spec = AGENT_SPECS[kind]
    void (async () => {
      try {
        const { items } = await dataApiService.get('/agents', { query: { search: spec.name, limit: 100 } })
        let id = items.find((agent) => agent.name === spec.name && agent.type === spec.type)?.id
        if (!id) {
          const model = pickModel(skinModels, spec.models)
          if (!model) {
            if (!cancelled) setSetup('no_model')
            return
          }
          id = (await ipcApi.request('ai.agent.create', { name: spec.name, type: spec.type, model: model.id })).id
          await invalidate(['/agents', '/agents/*'])
        }
        if (cancelled) return
        setAgentId(id)
        setSetup('ready')
      } catch (error) {
        logger.error('Failed to prepare A33 agent', error as Error)
        if (!cancelled) setSetup('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentId, invalidate, kind, modelsLoading, skinModels])

  return { agentId, setup }
}

/**
 * Everything a full-window Codex / Claude skin needs: the agent, its sessions, the live
 * conversation runtime of the selected session, and send / stop / new / model actions.
 */
export function useA33AgentChat(kind: A33AgentSpecKey) {
  const { skinModels, isLoading: modelsLoading } = useSkinModels(kind)
  const { agentId, setup } = useEnsureAgent(kind, skinModels, modelsLoading)
  const { agent } = useAgent(agentId ?? null)
  const { updateAgent, updateModel } = useUpdateAgent()
  const { sessions, deleteSession } = useSessions(agentId, { loadAll: true, enabled: !!agentId })
  const [sessionId, setSessionId] = useState<string>()

  const runtime = useAgentChatRuntimeState({
    sessionId: sessionId ?? '',
    modelId: agent?.model ?? undefined,
    agentType: agent?.type,
    sessionMessagesEnabled: !!sessionId,
    sessionHistoryFetchOnMount: true,
    reservedMessages: EMPTY_MESSAGES
  })

  const binary = useClaudeCodeBinary(agent?.type === 'claude-code')
  useEffect(() => {
    if (!sessionId || agent?.type !== 'claude-code' || binary.status?.phase !== 'ready') return
    void ipcApi.request('ai.agent.session.prewarm', { sessionId }).catch((error) => {
      logger.warn('Failed to warm Claude runtime', { error })
    })
  }, [agent?.type, binary.status?.phase, sessionId])

  /** Opens an empty session (reusing an existing empty one) and selects it. */
  const newSession = useCallback(async (): Promise<string | undefined> => {
    if (!agentId) return undefined
    const { session } = await ipcApi.request('ai.agent.session.reuse_or_create', {
      agentId,
      workspace: { type: 'system' }
    })
    setSessionId(session.id)
    return session.id
  }, [agentId])

  // Land on a fresh conversation once the agent is ready.
  useEffect(() => {
    if (agentId && !sessionId) void newSession()
  }, [agentId, newSession, sessionId])

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim()
      if (!trimmed || !agentId || !sessionId) return false
      return runtime.sendMessage(
        { text: trimmed },
        {
          body: {
            agentId,
            sessionId,
            userMessageParts: createComposerUserMessageParts({ text: trimmed, tokens: [] })
          }
        }
      )
    },
    [agentId, runtime, sessionId]
  )

  const removeSession = useCallback(
    async (id: string) => {
      if (!(await deleteSession(id))) return
      if (id === sessionId) setSessionId(undefined)
    },
    [deleteSession, sessionId]
  )

  const changeModel = useCallback(
    async (modelId: UniqueModelId) => {
      if (agentId && modelId !== agent?.model) await updateModel({ agentId, modelId }, { showSuccessToast: false })
    },
    [agent?.model, agentId, updateModel]
  )

  const activeModel = skinModels.find((model) => model.id === agent?.model)
  const effortOptions = useMemo(() => (activeModel ? (deriveThinkingOptions(activeModel) ?? []) : []), [activeModel])
  const effort: ReasoningEffortOption = agent?.configuration?.reasoning_effort ?? 'default'
  const permissionMode: AgentPermissionMode | undefined = agent?.configuration?.permission_mode

  const changeEffort = useCallback(
    async (reasoningEffort: ReasoningEffortOption) => {
      if (agentId && agent?.model) {
        await updateModel({ agentId, modelId: agent.model, reasoningEffort }, { showSuccessToast: false })
      }
    },
    [agent?.model, agentId, updateModel]
  )

  const changePermissionMode = useCallback(
    async (mode: AgentPermissionMode) => {
      if (agentId)
        await updateAgent({ id: agentId, configuration: { permission_mode: mode } }, { showSuccessToast: false })
    },
    [agentId, updateAgent]
  )

  // The plan (to-do list) and the files the agent touched, for the side panels.
  const status = useMemo(
    () => buildAgentRightPaneStatus(runtime.uiMessages, runtime.partsByMessageId),
    [runtime.partsByMessageId, runtime.uiMessages]
  )
  const changes = useMemo(
    () => collectChangedFiles(runtime.uiMessages, runtime.partsByMessageId),
    [runtime.partsByMessageId, runtime.uiMessages]
  )

  return {
    setup,
    agent,
    agentId,
    skinModels,
    activeModel,
    changeModel,
    effortOptions,
    effort,
    changeEffort,
    permissionMode,
    changePermissionMode,
    status,
    changes,
    sessions,
    sessionId,
    selectSession: setSessionId,
    newSession,
    removeSession,
    runtime,
    send,
    binary,
    canSend: !!sessionId && !binary.blocked && !runtime.isPending && !runtime.editBusy
  }
}

export type A33AgentChat = ReturnType<typeof useA33AgentChat>
