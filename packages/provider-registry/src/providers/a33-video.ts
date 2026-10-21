import { defineProvider } from './types'

// a33.club video group (sub2api, platform=grok): needs a key from the 生视频 group. The 生视频 page calls
// /v1/videos directly from the main process; the chat endpoint is only here so the model list can sync.
export default defineProvider({
  id: 'a33-video',
  name: 'A33 生视频',
  availableInEditions: ['global', 'cn'],
  defaultChatEndpoint: 'openai-chat-completions',
  endpointConfigs: {
    'openai-chat-completions': {
      adapterFamily: 'openai-compatible',
      baseUrl: 'https://a33.club'
    }
  },
  metadata: {
    website: {
      apiKey: 'https://a33.club/keys',
      docs: 'https://a33.club',
      models: 'https://a33.club',
      official: 'https://a33.club'
    }
  }
})
