import type { FC } from 'react'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { usePreference } from '@data/hooks/usePreference'
import { getQuickPanelSearchAliases } from '@renderer/components/composer/quickPanel'
import { GENERATE_IMAGE_TOOLBAR_MANIFEST } from '@renderer/components/composer/tools/toolbarManifests'
import { defineTool, type ToolLauncherApi } from '@renderer/components/composer/tools/types'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { requestA33KeyPrompt } from '@renderer/utils/a33'

interface Props {
  assistantId: string
  launcher: ToolLauncherApi
}

/**
 * Toggle that flips `assistant.settings.enableGenerateImage`, which gates the `generate_image`
 * builtin tool on the main side (see `PaintingTool.ts`'s `applies`). The actual image is produced
 * by a separate painting model configured in Settings › Default Model; until one is set the toggle
 * opens the A33 生图 key prompt (A33AutoSetup picks the model once the key lands).
 */
const useGenerateImageToolController = ({ assistantId, launcher }: Props) => {
  const { t } = useTranslation()
  const { assistant, updateAssistant } = useAssistant(assistantId)
  const [paintingModelId] = usePreference('feature.paintings.default_model_id')

  // A33 build: with no image model yet, the toggle asks for a 生图 key instead of being disabled.
  const needsKey = !paintingModelId
  const enabled = !needsKey && (assistant?.settings.enableGenerateImage ?? false)

  const handleToggle = useCallback(() => {
    if (needsKey) {
      requestA33KeyPrompt('image')
      return
    }
    if (!assistant) return
    void updateAssistant({ settings: { enableGenerateImage: !enabled } })
  }, [assistant, enabled, needsKey, updateAssistant])

  useEffect(() => {
    return launcher.registerLaunchers([
      {
        ...GENERATE_IMAGE_TOOLBAR_MANIFEST.toolbar,
        sources: ['popover'],
        label: t('chat.input.generate_image'),
        description: needsKey ? t('a33.generate_image.need_key') : '',
        searchAliases: getQuickPanelSearchAliases(t, 'chat.input.generate_image', ['generate image']),
        active: enabled,
        action: handleToggle
      }
    ])
  }, [enabled, handleToggle, launcher, needsKey, t])

  return { enabled, handleToggle }
}

const GenerateImageComposerRuntime: FC<Props> = (props) => {
  useGenerateImageToolController(props)
  return null
}

const generateImageTool = defineTool({
  key: 'generate_image',
  label: GENERATE_IMAGE_TOOLBAR_MANIFEST.label,
  visibleInScopes: GENERATE_IMAGE_TOOLBAR_MANIFEST.visibleInScopes,
  condition: ({ assistant }) => Boolean(assistant),
  composer: {
    runtime: ({ context }) => (
      <GenerateImageComposerRuntime assistantId={context.assistant!.id} launcher={context.launcher} />
    )
  }
})

export default generateImageTool
