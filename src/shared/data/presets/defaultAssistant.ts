import { DEFAULT_ASSISTANT_SETTINGS } from '@shared/data/types/assistant'

import { CHERRYAI_DEFAULT_UNIQUE_MODEL_ID } from './cherryai'

export const DEFAULT_ASSISTANT_NAME = 'A33 Assistant' as const
export const DEFAULT_ASSISTANT_NAME_ZH = 'A33 助手' as const
export const DEFAULT_ASSISTANT_EMOJI = '😀' as const
export const DEFAULT_ASSISTANT_PROMPT = '' as const

export function getDefaultAssistantNameForLocale(locale?: string | null): string {
  return locale?.toLowerCase().startsWith('zh') ? DEFAULT_ASSISTANT_NAME_ZH : DEFAULT_ASSISTANT_NAME
}

export const DEFAULT_ASSISTANT_SEED = {
  name: DEFAULT_ASSISTANT_NAME,
  emoji: DEFAULT_ASSISTANT_EMOJI,
  prompt: DEFAULT_ASSISTANT_PROMPT,
  description: '',
  modelId: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID,
  settings: DEFAULT_ASSISTANT_SETTINGS
} as const
