/**
 * A33 build: the main window shows one of these full-window screens. Only `workspace` is the
 * regular AppShell (sidebar + tabs); the others are standalone.
 */
export type A33AgentKind = 'codex' | 'claude'

export type A33Screen =
  | { kind: 'launcher' }
  /** `route` opens in the shell once it mounts (e.g. settings). */
  | { kind: 'workspace'; route?: string }
  | { kind: 'agent'; agent: A33AgentKind }
  /** a33.club account centre: usage history, top-up, orders. */
  | { kind: 'account'; tab?: A33AccountTab }

export type A33AccountTab = 'usage' | 'recharge' | 'orders'

export const A33_SCREEN_EVENT = 'a33:screen'

export function showA33Screen(screen: A33Screen) {
  window.dispatchEvent(new CustomEvent<A33Screen>(A33_SCREEN_EVENT, { detail: screen }))
}
