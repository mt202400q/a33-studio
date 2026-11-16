/**
 * A33 Studio build: features with no a33.club backing service (or that talk to
 * Cherry's own cloud) are hidden from navigation. Code stays intact so upstream
 * merges remain cheap.
 */

import type { Model } from '@shared/data/types/model'

const modelKey = (model: Model) => model.apiModelId ?? model.id

/** First matching pattern wins; within a pattern the highest version wins. */
export function pickModel(models: readonly Model[], priority: readonly RegExp[]): Model | undefined {
  for (const pattern of priority) {
    const matches = models.filter((model) => pattern.test(modelKey(model)))
    if (matches.length > 0) {
      return [...matches].sort((a, b) => modelKey(b).localeCompare(modelKey(a), undefined, { numeric: true }))[0]
    }
  }
  return undefined
}

/**
 * Sidebar / launchpad apps hidden in the A33 build. 高级生图 (paintings) is folded into 生图 and stays
 * reachable from the 生图 page's 高级模式 button for one release.
 */
export const A33_HIDDEN_SIDEBAR_APPS: ReadonlySet<string> = new Set(['knowledge', 'mini_app', 'paintings', 'translate'])

/**
 * Apps kept registered (other code resolves them) but left off the launchpad: 首页 is the launcher screen,
 * and the workspace offers 智能体 instead of plain 对话.
 */
export const A33_LAUNCHPAD_HIDDEN_APPS: ReadonlySet<string> = new Set(['home', 'assistants'])

/**
 * The builtin Cherry Assistant / Support / Doctor agents are not provided: entry points that would
 * (re)create them (agent-made tasks, skill try-out, Doctor agent) are hidden.
 */
export const A33_HIDE_BUILTIN_AGENTS = true

/** The bundled Cherry 助手库 presets are not offered (picker, assistant library). */
export const A33_HIDE_ASSISTANT_PRESETS = true

/** Translation (page, message action, selection action, quick assistant, translate model) is removed. */
export const A33_HIDE_TRANSLATE = true

/** Settings sections hidden in the A33 build. */
export const A33_HIDDEN_SETTINGS_ROUTES: ReadonlySet<string> = new Set([
  '/settings/local-models',
  '/settings/websearch',
  '/settings/file-processing',
  '/settings/ocr',
  '/settings/voice',
  '/settings/channels',
  '/settings/device-connections'
])

/** Login-based CLI providers hidden from Settings → 模型服务; still enabled in main to power agent runtimes. */
export const A33_HIDDEN_SETTINGS_PROVIDER_IDS: ReadonlySet<string> = new Set([
  'claude-code',
  'openai-codex',
  'grok-cli'
])

/**
 * Providers 编码工具 (code tools) may configure CLIs with. The built-in API gateway and the CLIs'
 * own-login cards are hidden as well, so every CLI runs on the user's a33.club key.
 */
export const A33_CODE_TOOL_PROVIDER_IDS: ReadonlySet<string> = new Set(['a33'])
export const A33_CODE_TOOLS_A33_ONLY = true

/** The standalone launcher (with Codex / Claude screens) is the start screen and replaces the provider onboarding. */
export const A33_LAUNCHER = true

/** Cherry-hosted subscription, docs, release notes and feedback entry points. */
export const A33_HIDE_CHERRY_SERVICES = true

export type A33KeyPromptKind = 'chat' | 'image' | 'video'
export const A33_KEY_PROMPT_EVENT = 'a33:key-prompt'

/** Opens the A33 key prompt on demand (e.g. the chat 生图 toggle with no image key yet), even if dismissed before. */
export function requestA33KeyPrompt(kind: A33KeyPromptKind) {
  window.dispatchEvent(new CustomEvent<A33KeyPromptKind>(A33_KEY_PROMPT_EVENT, { detail: kind }))
}
