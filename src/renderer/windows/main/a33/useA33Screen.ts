import { useEffect, useState } from 'react'

import { openRoute } from '@renderer/services/mainWindowNavigation'
import { A33_SCREEN_EVENT, type A33Screen } from '@renderer/utils/a33Screen'

/** Current A33 main-window screen. Every app start opens on the launcher. */
export function useA33Screen(): A33Screen {
  const [screen, setScreen] = useState<A33Screen>({ kind: 'launcher' })

  useEffect(() => {
    const onShow = (event: Event) => setScreen((event as CustomEvent<A33Screen>).detail)
    window.addEventListener(A33_SCREEN_EVENT, onShow)
    return () => window.removeEventListener(A33_SCREEN_EVENT, onShow)
  }, [])

  // Parent effects run after the freshly mounted AppShell's, so its route listener is ready here.
  const pendingRoute = screen.kind === 'workspace' ? screen.route : undefined
  useEffect(() => {
    if (pendingRoute) openRoute(pendingRoute)
  }, [pendingRoute])

  return screen
}
