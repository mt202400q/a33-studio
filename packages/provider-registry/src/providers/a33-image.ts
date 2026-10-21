import { defineProvider } from './types'

// a33.club image group (sub2api, platform=openai): needs a key from the 生图 group.
export default defineProvider({
  id: 'a33-image',
  name: 'A33 生图',
  availableInEditions: ['global', 'cn'],
  defaultChatEndpoint: 'openai-chat-completions',
  endpointConfigs: {
    'openai-chat-completions': {
      adapterFamily: 'openai-compatible',
      baseUrl: 'https://a33.club'
    },
    'openai-image-generation': {
      adapterFamily: 'openai-compatible',
      baseUrl: 'https://a33.club'
    },
    'openai-image-edit': {
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
