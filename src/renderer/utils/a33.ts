/**
 * A33 Studio build: features with no a33.club backing service (or that talk to
 * Cherry's own cloud) are hidden from navigation. Code stays intact so upstream
 * merges remain cheap.
 */

/** Sidebar / launchpad apps hidden in the A33 build. */
export const A33_HIDDEN_SIDEBAR_APPS: ReadonlySet<string> = new Set(['knowledge', 'mini_app'])

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
