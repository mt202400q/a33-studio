import { LOCAL_EMBEDDING_PROVIDER_ID } from '@shared/data/presets/localEmbedding'
import type { Provider } from '@shared/data/types/provider'
import { isCherryAIProvider } from '@shared/utils/provider'

import { A33_HIDDEN_SETTINGS_PROVIDER_IDS } from './a33'

export function isProviderSettingsListVisibleProvider(provider: Provider): boolean {
  // The local embedding provider is download-managed, so exposing generic
  // edit/disable/delete controls would bypass its weight lifecycle checks.
  return (
    !isCherryAIProvider(provider) &&
    provider.id !== LOCAL_EMBEDDING_PROVIDER_ID &&
    !A33_HIDDEN_SETTINGS_PROVIDER_IDS.has(provider.id)
  )
}
