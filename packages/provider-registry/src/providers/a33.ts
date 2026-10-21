import { defineProvider } from './types'

// a33.club text groups (sub2api, platform=anthropic) only speak Anthropic Messages.
export default defineProvider({
  id: 'a33',
  name: 'A33',
  availableInEditions: ['global', 'cn'],
  defaultChatEndpoint: 'anthropic-messages',
  endpointConfigs: {
    'anthropic-messages': {
      adapterFamily: 'anthropic',
      baseUrl: 'https://a33.club'
    },
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
