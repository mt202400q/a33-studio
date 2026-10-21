import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from '@cherrystudio/ui'
import { useTabs } from '@renderer/hooks/tab'
import { useModels } from '@renderer/hooks/useModel'
import { useProvider } from '@renderer/hooks/useProvider'
import { supportsImageGenerationEndpoint } from '@renderer/pages/paintings/model/utils/paintingModelOptions'
import { toast } from '@renderer/services/toast'
import { A33_KEY_PROMPT_EVENT, type A33KeyPromptKind } from '@renderer/utils/a33'
import { resolveSidebarActiveItem } from '@renderer/utils/sidebar'
import { isNonChatModel } from '@shared/utils/model'

type PromptKind = A33KeyPromptKind

const CHAT_APPS = new Set(['assistants', 'translate', 'agents', 'code_tools'])
const PROVIDER_BY_KIND: Record<PromptKind, string> = { chat: 'a33', image: 'a33-image', video: 'a33-video' }
const TEXT_BY_KIND = {
  chat: { title: 'a33.key_prompt.chat_title', description: 'a33.key_prompt.chat_description' },
  image: { title: 'a33.key_prompt.image_title', description: 'a33.key_prompt.image_description' },
  video: { title: 'a33.key_prompt.video_title', description: 'a33.key_prompt.video_description' }
} as const

/**
 * Opening a model-backed app with no usable model asks for an a33.club key; the A33 provider
 * already points at https://a33.club, and A33AutoSetup syncs models once the key lands.
 */
export function A33KeyPrompt() {
  const { t } = useTranslation()
  const { activeTab } = useTabs()
  const { models: enabledModels, isLoading } = useModels({ enabled: true })
  const chatProvider = useProvider(PROVIDER_BY_KIND.chat)
  const imageProvider = useProvider(PROVIDER_BY_KIND.image)
  const videoProvider = useProvider(PROVIDER_BY_KIND.video)
  const [kind, setKind] = useState<PromptKind | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const dismissedRef = useRef(new Set<PromptKind>())

  const activeApp = activeTab?.url ? resolveSidebarActiveItem(activeTab.url) : ''
  const wanted: PromptKind | null =
    activeApp === 'paintings' || activeApp === 'image_chat'
      ? 'image'
      : activeApp === 'video_chat'
        ? 'video'
        : CHAT_APPS.has(activeApp)
          ? 'chat'
          : null
  const targetByKind = { chat: chatProvider, image: imageProvider, video: videoProvider }
  const hasChatModel = enabledModels.some((model) => !isNonChatModel(model))
  const hasImageModel = enabledModels.some((model) => supportsImageGenerationEndpoint(model))
  const wantedProvider = wanted ? targetByKind[wanted].provider : undefined
  // Undefined until the provider row loads — never prompt on a not-yet-known state.
  const wantedHasKey = wantedProvider ? wantedProvider.apiKeys.length > 0 : undefined
  // The 生视频 page lists its models straight from a33.club, so only the key matters there.
  const wantedHasModel = wanted === 'image' ? hasImageModel : wanted === 'chat' ? hasChatModel : false

  useEffect(() => {
    if (!wanted || kind || isLoading || wantedHasKey !== false || wantedHasModel) return
    if (dismissedRef.current.has(wanted)) return
    setApiKey('')
    setKind(wanted)
  }, [wanted, kind, isLoading, wantedHasKey, wantedHasModel])

  useEffect(() => {
    const onRequest = (event: Event) => {
      setApiKey('')
      setKind((event as CustomEvent<PromptKind>).detail)
    }
    window.addEventListener(A33_KEY_PROMPT_EVENT, onRequest)
    return () => window.removeEventListener(A33_KEY_PROMPT_EVENT, onRequest)
  }, [])

  const close = () => {
    if (kind) dismissedRef.current.add(kind)
    setKind(null)
  }

  const save = async () => {
    const key = apiKey.trim()
    if (!kind || !key) return
    const target = targetByKind[kind]
    setSaving(true)
    try {
      await target.addApiKey(key)
      if (!target.provider?.isEnabled) await target.updateProvider({ isEnabled: true })
      toast.success(t('a33.key_prompt.saved'))
      setKind(null)
    } catch {
      toast.error(t('a33.key_prompt.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{t(TEXT_BY_KIND[kind ?? 'chat'].title)}</DialogTitle>
          <DialogDescription className="leading-6">{t(TEXT_BY_KIND[kind ?? 'chat'].description)}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          type="password"
          value={apiKey}
          placeholder={t('a33.key_prompt.placeholder')}
          onChange={(event) => setApiKey(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void save()}
        />
        <a className="text-link text-xs hover:underline" href="https://a33.club/keys" target="_blank" rel="noreferrer">
          {t('a33.key_prompt.get_key')}
        </a>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('a33.key_prompt.later')}
          </Button>
          <Button type="button" loading={saving} disabled={!apiKey.trim()} onClick={() => void save()}>
            {t('a33.key_prompt.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
