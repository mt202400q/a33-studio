import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { Spinner } from '@cherrystudio/ui'
import A33HomePage from '@renderer/pages/home/A33HomePage'
import type { A33Screen } from '@renderer/utils/a33Screen'

const CodexScreen = lazy(() => import('@renderer/pages/agents/a33/CodexScreen'))
const ClaudeScreen = lazy(() => import('@renderer/pages/agents/a33/ClaudeScreen'))
const A33AccountScreen = lazy(() => import('@renderer/pages/home/account/A33AccountScreen'))

/** A33 build: the standalone (non-shell) screens of the main window. */
export function A33ScreenView({ screen }: { screen: Exclude<A33Screen, { kind: 'workspace' }> }) {
  const { t } = useTranslation()
  if (screen.kind === 'launcher') return <A33HomePage />
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center">
          <Spinner text={t('common.loading')} />
        </div>
      }>
      {screen.kind === 'account' ? (
        <A33AccountScreen key={screen.tab ?? 'usage'} initialTab={screen.tab} />
      ) : screen.agent === 'codex' ? (
        <CodexScreen />
      ) : (
        <ClaudeScreen />
      )}
    </Suspense>
  )
}
