import { defineProvider } from './types'

// a33.club text groups (sub2api, platform=anthropic) speak Anthropic Messages natively; sub2api also
// serves OpenAI Chat Completions and Responses for them by converting to Anthropic (Responses backs Codex CLI).
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
    },
    'openai-responses': {
      adapterFamily: 'openai',
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
