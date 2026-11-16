import type { ReactNode } from 'react'

import { ChatLayoutModeProvider } from '@renderer/components/chat/layout/ChatLayoutModeContext'
import {
  type MessageRenderConfigOverride,
  MessageRenderConfigOverrideContext
} from '@renderer/components/chat/messages/hooks/useMessageListRenderConfig'
import ConversationComposerSlot from '@renderer/components/composer/ConversationComposerSlot'

import { ClaudeCodeDownloadStatus } from '../ClaudeCodeDownloadStatus'
import AgentSessionMessages from '../components/AgentSessionMessages'
import type { A33AgentChat } from './useA33AgentChat'

/** The live conversation of the selected session, rendered by the app's own message list. */
export function A33ConversationMessages({
  chat,
  renderConfig
}: {
  chat: A33AgentChat
  renderConfig: MessageRenderConfigOverride
}) {
  const { runtime, agent, agentId, sessionId } = chat
  if (!sessionId) return null
  return (
    <MessageRenderConfigOverrideContext value={renderConfig}>
      <ChatLayoutModeProvider>
        <AgentSessionMessages
          agentId={agentId}
          sessionId={sessionId}
          messages={runtime.uiMessages}
          activeAgent={agent}
          partsByMessageId={runtime.partsByMessageId}
          streamingLayers={runtime.streamingLayers}
          optimisticAskUserQuestionInputsByToolCallId={runtime.optimisticAskUserQuestionInputsByToolCallId}
          isLoading={runtime.isLoading}
          hasOlder={runtime.hasOlder}
          loadOlder={runtime.loadOlder}
          deleteMessage={runtime.deleteMessage}
          startEditing={runtime.startEditing}
          editBusy={runtime.editBusy}
          respondToolApproval={runtime.respondToolApproval}
        />
      </ChatLayoutModeProvider>
    </MessageRenderConfigOverrideContext>
  )
}

/**
 * The skin's composer, swapped for the runtime's own prompts when a run waits on the user
 * (tool permission, AskUserQuestion) so a run never hangs behind a custom input.
 */
export function A33ComposerSlot({ chat, composer }: { chat: A33AgentChat; composer: ReactNode }) {
  return (
    <>
      {chat.binary.blocked && <ClaudeCodeDownloadStatus status={chat.binary.status} onRetry={chat.binary.retry} />}
      <ConversationComposerSlot composerContext={chat.runtime.composerContext} fallback={composer} />
    </>
  )
}

export function isConversationEmpty(chat: A33AgentChat): boolean {
  return !chat.runtime.isLoading && chat.runtime.uiMessages.length === 0
}
