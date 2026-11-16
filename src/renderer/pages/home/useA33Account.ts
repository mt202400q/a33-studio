import { useCallback, useEffect, useState } from 'react'

import { loggerService } from '@logger'
import { useProvider } from '@renderer/hooks/useProvider'
import { ipcApi } from '@renderer/ipc'
import type { A33AccountOverview, A33LoginResult } from '@shared/ipc/schemas/a33Account'

const logger = loggerService.withContext('useA33Account')

export type A33AccountState =
  | { phase: 'loading' }
  | { phase: 'signed_out' }
  | { phase: 'signed_in'; overview: A33AccountOverview }
  | { phase: 'error' }

/** a33.club account session for the home page; a fresh login fills the a33 provider key when it has none. */
export function useA33Account() {
  const [state, setState] = useState<A33AccountState>({ phase: 'loading' })
  const { provider, addApiKey, updateProvider } = useProvider('a33')
  const needsApiKey = provider !== undefined && provider.apiKeys.length === 0

  const refresh = useCallback(async () => {
    try {
      const status = await ipcApi.request('a33.account.status')
      setState(status.signedIn ? { phase: 'signed_in', overview: status.overview } : { phase: 'signed_out' })
    } catch (error) {
      logger.warn('Failed to load a33.club account status', error as Error)
      setState({ phase: 'error' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const completeLogin = useCallback(
    async (result: A33LoginResult): Promise<A33LoginResult> => {
      if (result.status !== 'signed_in') return result
      if (result.apiKey && needsApiKey) {
        await addApiKey(result.apiKey, 'A33')
        if (!provider?.isEnabled) await updateProvider({ isEnabled: true })
      }
      await refresh()
      return result
    },
    [addApiKey, needsApiKey, provider?.isEnabled, refresh, updateProvider]
  )

  const login = useCallback(
    async (email: string, password: string) =>
      completeLogin(await ipcApi.request('a33.account.login', { email, password, wantApiKey: needsApiKey })),
    [completeLogin, needsApiKey]
  )

  const loginWith2fa = useCallback(
    async (tempToken: string, code: string) =>
      completeLogin(await ipcApi.request('a33.account.login_2fa', { tempToken, code, wantApiKey: needsApiKey })),
    [completeLogin, needsApiKey]
  )

  const logout = useCallback(async () => {
    await ipcApi.request('a33.account.logout')
    setState({ phase: 'signed_out' })
  }, [])

  return { state, refresh, login, loginWith2fa, logout }
}
