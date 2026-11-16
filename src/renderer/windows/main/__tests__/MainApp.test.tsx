import '@testing-library/jest-dom/vitest'
import { MockUsePreferenceUtils } from '@test-mocks/renderer/usePreference'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { showA33Screen } from '@renderer/utils/a33Screen'
import { createSidebarShortcutId, type SidebarShortcutTarget } from '@shared/data/preference/preferenceTypes'

const onboardingModule = vi.hoisted(() => ({ evaluations: 0 }))

vi.mock('../onboarding/OnboardingPage', () => {
  onboardingModule.evaluations += 1
  return { default: () => <div data-testid="onboarding-page">onboarding</div> }
})

vi.mock('../a33/A33AutoSetup', () => ({ A33AutoSetup: () => null }))
vi.mock('../a33/A33ScreenView', () => ({
  A33ScreenView: ({ screen }: { screen: { kind: string } }) => <div data-testid="a33-screen">{screen.kind}</div>
}))
vi.mock('../a33/A33KeyPrompt', () => ({ A33KeyPrompt: () => null }))
vi.mock('../privacy/PrivacyPolicyUpdateGate', () => ({
  PrivacyPolicyUpdateGate: () => <div data-testid="privacy-policy-gate">privacy-policy-gate</div>
}))

const tabsProviderMock = vi.hoisted(() => ({ lastInitialDefaultTab: null as unknown }))

vi.mock('@renderer/components/layout/TabsProvider', () => ({
  TabsProvider: ({ children, initialDefaultTab }: { children: ReactNode; initialDefaultTab?: unknown }) => {
    tabsProviderMock.lastInitialDefaultTab = initialDefaultTab
    return <div data-testid="tabs-provider">{children}</div>
  }
}))

vi.mock('@renderer/components/layout/AppShell', () => ({
  AppShell: () => <div data-testid="app-shell">app-shell</div>
}))

vi.mock('@renderer/hooks/useWindowRuntime', () => ({ useWindowRuntime: () => {} }))
vi.mock('@renderer/hooks/tab', () => ({ useMainWindowNavigation: () => {} }))
vi.mock('@renderer/hooks/useStorageMonitorNotification', () => ({ useStorageMonitorNotification: () => {} }))
vi.mock('@renderer/components/ConversationNotificationRuntime', () => ({
  ConversationNotificationRuntime: () => null
}))
vi.mock('../hooks/useAutoBackupEvents', () => ({ useAutoBackupEvents: () => {} }))
vi.mock('../hooks/useTopicNamingErrorNotification', () => ({ useTopicNamingErrorNotification: () => {} }))
vi.mock('../hooks/useAppUpdateHandler', () => ({ useAppUpdateHandler: () => {} }))
vi.mock('@renderer/components/PopupHost', () => ({ PopupHost: () => null }))
vi.mock('@renderer/components/ToastHost', () => ({ default: () => null }))
vi.mock('@renderer/components/ThemeProvider', () => ({
  ThemeProvider: () => {
    throw new Error('theme provider boom')
  }
}))

import MainApp, { MainWindowContent } from '../MainApp'

function appendBootSpinner() {
  const spinner = document.createElement('div')
  spinner.id = 'spinner'
  document.body.appendChild(spinner)
}

function appShortcut(resourceId: string) {
  const target: SidebarShortcutTarget = { kind: 'resource', locator: { providerId: 'core.app', resourceId } }
  return { type: 'shortcut' as const, id: createSidebarShortcutId(target), target }
}

describe('MainWindowContent', () => {
  beforeEach(() => {
    MockUsePreferenceUtils.resetMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('A33 build: every start opens the launcher, and the workspace shell only on request', () => {
    for (const status of ['completed', 'skipped'] as const) {
      MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', status)

      const view = render(<MainWindowContent />)

      expect(screen.getByTestId('tabs-provider')).toBeInTheDocument()
      expect(screen.getByTestId('a33-screen')).toHaveTextContent('launcher')
      expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
      expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument()
      expect(screen.getByTestId('privacy-policy-gate')).toBeInTheDocument()

      act(() => showA33Screen({ kind: 'workspace' }))
      expect(screen.getByTestId('app-shell')).toBeInTheDocument()
      expect(screen.queryByTestId('a33-screen')).not.toBeInTheDocument()

      act(() => showA33Screen({ kind: 'agent', agent: 'claude' }))
      expect(screen.getByTestId('a33-screen')).toHaveTextContent('agent')
      expect(onboardingModule.evaluations).toBe(0)
      view.unmount()
    }
  })

  it('A33 build: first run shows the launcher instead of onboarding and opts out of Cherry data collection', async () => {
    MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', 'pending')
    MockUsePreferenceUtils.setPreferenceValue('app.privacy.data_collection.enabled', true)
    appendBootSpinner()

    render(<MainWindowContent />)

    expect(screen.getByTestId('a33-screen')).toHaveTextContent('launcher')
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument()
    expect(onboardingModule.evaluations).toBe(0)
    await waitFor(() =>
      expect(MockUsePreferenceUtils.getPreferenceValue('app.onboarding.provider_setup.status')).toBe('skipped')
    )
    expect(MockUsePreferenceUtils.getPreferenceValue('app.privacy.data_collection.enabled')).toBe(false)
    expect(MockUsePreferenceUtils.getPreferenceValue('app.privacy.policy_version')).toBe('')
    expect(document.getElementById('spinner')).toBeNull()
  })

  it('passes the first visible sidebar app as the startup landing tab', () => {
    MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', 'completed')
    MockUsePreferenceUtils.setPreferenceValue('ui.sidebar_shortcut', [appShortcut('agents'), appShortcut('translate')])
    MockUsePreferenceUtils.setPreferenceValue('feature.paintings.default_provider', 'zhipu')

    render(<MainWindowContent />)

    expect(tabsProviderMock.lastInitialDefaultTab).toMatchObject({ url: '/app/agents' })
  })

  it('falls back to launchpad when no sidebar app is visible', () => {
    MockUsePreferenceUtils.setPreferenceValue('app.onboarding.provider_setup.status', 'completed')
    MockUsePreferenceUtils.setPreferenceValue('ui.sidebar_shortcut', [])
    MockUsePreferenceUtils.setPreferenceValue('feature.paintings.default_provider', 'zhipu')

    render(<MainWindowContent />)

    expect(tabsProviderMock.lastInitialDefaultTab).toMatchObject({ url: '/app/launchpad' })
  })
})

describe('MainApp top-level error boundary', () => {
  it('shows the window fatal fallback instead of a white screen when a provider throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    appendBootSpinner()

    render(<MainApp />)

    expect(screen.getByRole('alert')).toHaveTextContent('theme provider boom')
    expect(document.getElementById('spinner')).toBeNull()
    consoleError.mockRestore()
  })
})
