import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
import { useProvider } from '@renderer/hooks/useProvider'
import { type A33KeyPromptKind, requestA33KeyPrompt } from '@renderer/utils/a33'

const PROVIDER_BY_KIND = { chat: 'a33', image: 'a33-image', video: 'a33-video' } as const
const TEXT_BY_KIND = {
  chat: 'a33.key_banner.chat',
  image: 'a33.key_banner.image',
  video: 'a33.key_banner.video'
} as const

/** Whether the A33 provider for `kind` has a key; undefined while the provider row loads. */
export function useA33HasKey(kind: A33KeyPromptKind): boolean | undefined {
  const { provider } = useProvider(PROVIDER_BY_KIND[kind])
  return provider ? provider.apiKeys.length > 0 : undefined
}

/** A33 build: inline notice on the 生图 / 生视频 pages until their a33.club key is set. */
export function A33KeyBanner({ kind }: { kind: A33KeyPromptKind }) {
  const { t } = useTranslation()
  const hasKey = useA33HasKey(kind)
  if (hasKey !== false) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
      <KeyRound size={14} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{t(TEXT_BY_KIND[kind])}</span>
      <Button size="sm" onClick={() => requestA33KeyPrompt(kind)}>
        {t('a33.key_banner.action')}
      </Button>
    </div>
  )
}
