/**
 * A33 Studio build: features with no a33.club backing service (or that talk to
 * Cherry's own cloud) are hidden from navigation. Code stays intact so upstream
 * merges remain cheap.
 */

/**
 * Sidebar / launchpad apps hidden in the A33 build. 高级生图 (paintings) is folded into 生图 and stays
 * reachable from the 生图 page's 高级模式 button for one release.
 */
export const A33_HIDDEN_SIDEBAR_APPS: ReadonlySet<string> = new Set(['knowledge', 'mini_app', 'paintings'])

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

/** Cherry-hosted subscription, docs, release notes and feedback entry points. */
export const A33_HIDE_CHERRY_SERVICES = true

export type A33KeyPromptKind = 'chat' | 'image' | 'video'
export const A33_KEY_PROMPT_EVENT = 'a33:key-prompt'

/** Opens the A33 key prompt on demand (e.g. the chat 生图 toggle with no image key yet), even if dismissed before. */
export function requestA33KeyPrompt(kind: A33KeyPromptKind) {
  window.dispatchEvent(new CustomEvent<A33KeyPromptKind>(A33_KEY_PROMPT_EVENT, { detail: kind }))
}
