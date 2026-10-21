import { useEffect, useRef } from 'react'

import { usePreference } from '@data/hooks/usePreference'
import { loggerService } from '@logger'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useModels } from '@renderer/hooks/useModel'
import { useProvider } from '@renderer/hooks/useProvider'
import { supportsImageGenerationEndpoint } from '@renderer/pages/paintings/model/utils/paintingModelOptions'
import { useProviderModelSync } from '@renderer/pages/settings/ProviderSettings'
import { A33_IMAGE_ASSISTANT_ID } from '@shared/data/presets/a33ImageAssistant'
import type { Model } from '@shared/data/types/model'
import { isNonChatModel } from '@shared/utils/model'

const logger = loggerService.withContext('A33AutoSetup')

const A33_CHAT_PROVIDER_ID = 'a33'
const A33_IMAGE_PROVIDER_ID = 'a33-image'

// First matching pattern wins; within a pattern the highest version wins. Covers every a33.club text group.
const CHAT_MODEL_PRIORITY = [/claude-sonnet/, /claude-opus/, /^gpt-/, /deepseek-v/, /glm-/, /kimi-/, /./]
const FAST_MODEL_PRIORITY = [/claude-haiku/, /flash/, /mini|lite/, ...CHAT_MODEL_PRIORITY]

const modelKey = (model: Model) => model.apiModelId ?? model.id

function pickModel(models: readonly Model[], priority: readonly RegExp[]): Model | undefined {
  for (const pattern of priority) {
    const matches = models.filter((model) => pattern.test(modelKey(model)))
    if (matches.length > 0) {
      return [...matches].sort((a, b) => modelKey(b).localeCompare(modelKey(a), undefined, { numeric: true }))[0]
    }
  }
  return undefined
}

/** Once the user has entered a key, enable the provider and pull its model list (runs once per session). */
function useA33ProviderBootstrap(providerId: string): readonly Model[] {
  const { provider, updateProvider } = useProvider(providerId)
  const { models, isLoading } = useModels({ providerId })
  const { syncProviderModels } = useProviderModelSync(providerId)
  const attemptedRef = useRef(false)
  const hasApiKey = (provider?.apiKeys.length ?? 0) > 0

  useEffect(() => {
    if (!provider || !hasApiKey || isLoading || models.length > 0 || attemptedRef.current) return
    attemptedRef.current = true
    void (async () => {
      try {
        if (!provider.isEnabled) await updateProvider({ isEnabled: true })
        await syncProviderModels()
      } catch (error) {
        logger.warn('A33 model sync failed', { providerId, error })
      }
    })()
  }, [hasApiKey, isLoading, models.length, provider, providerId, syncProviderModels, updateProvider])

  return models
}

/** Fills empty default-model preferences from the a33 / a33-image model lists; never overrides a user choice. */
export function A33AutoSetup() {
  const chatModels = useA33ProviderBootstrap(A33_CHAT_PROVIDER_ID)
  const imageModels = useA33ProviderBootstrap(A33_IMAGE_PROVIDER_ID)
  const [defaultModelId, setDefaultModelId] = usePreference('chat.default_model_id')
  const [quickModelId, setQuickModelId] = usePreference('feature.quick_assistant.model_id')
  const [translateModelId, setTranslateModelId] = usePreference('feature.translate.model_id')
  const [paintingModelId, setPaintingModelId] = usePreference('feature.paintings.default_model_id')
  const [, setPaintingProvider] = usePreference('feature.paintings.default_provider')
  const { assistant: imageAssistant, updateAssistant: updateImageAssistant } = useAssistant(A33_IMAGE_ASSISTANT_ID)

  useEffect(() => {
    const usable = chatModels.filter((model) => model.isEnabled && !model.isHidden && !isNonChatModel(model))
    if (usable.length === 0) return
    const chat = pickModel(usable, CHAT_MODEL_PRIORITY)
    const fast = pickModel(usable, FAST_MODEL_PRIORITY) ?? chat
    if (!defaultModelId && chat) void setDefaultModelId(chat.id)
    if (!quickModelId && fast) void setQuickModelId(fast.id)
    if (!translateModelId && fast) void setTranslateModelId(fast.id)
    // The 生图 assistant only writes prompts and routes edits, so the fast tier is enough.
    if (imageAssistant && !imageAssistant.modelId && fast) void updateImageAssistant({ modelId: fast.id })
  }, [
    chatModels,
    defaultModelId,
    quickModelId,
    translateModelId,
    imageAssistant,
    setDefaultModelId,
    setQuickModelId,
    setTranslateModelId,
    updateImageAssistant
  ])

  useEffect(() => {
    if (paintingModelId) return
    const usable = imageModels.filter(
      (model) => model.isEnabled && !model.isHidden && supportsImageGenerationEndpoint(model)
    )
    const image = pickModel(usable, [/gpt-image/, /./])
    if (!image) return
    void setPaintingProvider(A33_IMAGE_PROVIDER_ID)
    void setPaintingModelId(image.id)
  }, [imageModels, paintingModelId, setPaintingModelId, setPaintingProvider])

  return null
}
