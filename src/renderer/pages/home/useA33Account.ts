import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { loggerService } from '@logger'
import { useProvider } from '@renderer/hooks/useProvider'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import type { A33AccountOverview, A33ApiKeys, A33KeyKind, A33LoginResult } from '@shared/ipc/schemas/a33Account'

const logger = loggerService.withContext('useA33Account')

export type A33AccountState =
  | { phase: 'loading' }
  | { phase: 'signed_out' }
  | { phase: 'signed_in'; overview: A33AccountOverview }
  | { phase: 'error' }

const KIND_LABEL_KEYS: Record<A33KeyKind, string> = {
  chat: 'a33.home.account.key_kind_chat',
  image: 'a33.home.account.key_kind_image',
  video: 'a33.home.account.key_kind_video'
}

/** Signed-in accounts top up missing provider keys at most once per app run (several screens use this hook). */
let autoProvisionAttempted = false

/**
 * a33.club account session for the launcher and the account centre. Signing in — and, once per run, being
 * signed in — binds the account's 对话 / 生图 / 生视频 keys to the a33, a33-image and a33-video providers that
 * still have none; keys the user already set are never replaced.
 */
export function useA33Account() {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<A33AccountState>({ phase: 'loading' })
  const chat = useProvider('a33')
  const image = useProvider('a33-image')
  const video = useProvider('a33-video')
  const providersLoading = chat.isLoading || image.isLoading || video.isLoading

  const missingKinds = useMemo(() => {
    const byKind = { chat: chat.provider, image: image.provider, video: video.provider }
    return (Object.keys(byKind) as A33KeyKind[]).filter((kind) => byKind[kind]?.apiKeys.length === 0)
  }, [chat.provider, image.provider, video.provider])

  // The latest provider handles, so async key binding never acts on a stale render.
  const targetsRef = useRef({ chat, image, video })
  targetsRef.current = { chat, image, video }

  const bindKeys = useCallback(
    async (keys: A33ApiKeys) => {
      const bound: A33KeyKind[] = []
      for (const kind of Object.keys(keys) as A33KeyKind[]) {
        const key = keys[kind]
        const target = targetsRef.current[kind]
        if (!key || !target.provider || target.provider.apiKeys.length > 0) continue
        await target.addApiKey(key, 'A33')
        if (!target.provider.isEnabled) await target.updateProvider({ isEnabled: true })
        bound.push(kind)
      }
      if (bound.length > 0) {
        const kinds = new Intl.ListFormat(i18n.language).format(bound.map((kind) => t(KIND_LABEL_KEYS[kind])))
        toast.success(t('a33.home.account.keys_bound', { kinds }))
      }
    },
    [i18n.language, t]
  )

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

  // Already signed in (earlier run, older version, or a key was deleted): fill the gaps once.
  useEffect(() => {
    if (state.phase !== 'signed_in' || providersLoading || missingKinds.length === 0 || autoProvisionAttempted) return
    autoProvisionAttempted = true
    ipcApi
      .request('a33.account.provision_keys', { keyKinds: missingKinds })
      .then(bindKeys)
      .catch((error) => logger.warn('Could not bind a33.club keys', error as Error))
  }, [bindKeys, missingKinds, providersLoading, state.phase])

  const completeLogin = useCallback(
    async (result: A33LoginResult): Promise<A33LoginResult> => {
      if (result.status !== 'signed_in') return result
      // The login already provisioned keys; the provider lists refresh only afterwards, so skip the top-up pass.
      autoProvisionAttempted = true
      await bindKeys(result.apiKeys).catch((error) => logger.warn('Could not bind a33.club keys', error as Error))
      await refresh()
      return result
    },
    [bindKeys, refresh]
  )

  const login = useCallback(
    async (email: string, password: string) =>
      completeLogin(await ipcApi.request('a33.account.login', { email, password, keyKinds: missingKinds })),
    [completeLogin, missingKinds]
  )

  const loginWith2fa = useCallback(
    async (tempToken: string, code: string) =>
      completeLogin(await ipcApi.request('a33.account.login_2fa', { tempToken, code, keyKinds: missingKinds })),
    [completeLogin, missingKinds]
  )

  const logout = useCallback(async () => {
    await ipcApi.request('a33.account.logout')
    setState({ phase: 'signed_out' })
  }, [])

  return { state, refresh, login, loginWith2fa, logout }
}
