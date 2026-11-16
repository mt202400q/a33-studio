import { useEffect } from 'react'

import { useMultiplePreferences } from '@data/hooks/usePreference'
import { loggerService } from '@logger'

const logger = loggerService.withContext('A33OnboardingSkip')

const KEYS = {
  providerSetupStatus: 'app.onboarding.provider_setup.status',
  dataCollectionEnabled: 'app.privacy.data_collection.enabled',
  policyVersion: 'app.privacy.policy_version'
} as const

/**
 * A33 build: the home page replaces onboarding. Finish it the way onboarding's skip did,
 * including the Cherry data-collection opt-out, so the privacy gate never opens.
 */
export function A33OnboardingSkip() {
  const [{ providerSetupStatus }, update] = useMultiplePreferences(KEYS)

  useEffect(() => {
    if (providerSetupStatus !== 'pending') return
    update({ providerSetupStatus: 'skipped', dataCollectionEnabled: false, policyVersion: '' }).catch((error) =>
      logger.error('Failed to finish onboarding', error as Error)
    )
  }, [providerSetupStatus, update])

  return null
}
