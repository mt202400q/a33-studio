import { useTranslation } from 'react-i18next'

import { Button, Spinner } from '@cherrystudio/ui'
import { requestA33KeyPrompt } from '@renderer/utils/a33'
import { type A33AgentKind, showA33Screen } from '@renderer/utils/a33Screen'

import type { A33AgentChat } from './useA33AgentChat'

/** Shown instead of the conversation until the skin's agent is ready. */
export function A33SetupState({ chat, kind }: { chat: A33AgentChat; kind: A33AgentKind }) {
  const { t } = useTranslation()

  if (chat.setup === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner text={t('common.loading')} />
      </div>
    )
  }

  const name = kind === 'codex' ? t('a33.home.codex.title') : t('a33.home.claude.title')
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="m-0 max-w-md text-muted-foreground text-sm">
        {chat.setup === 'no_model' ? t('a33.home.no_model', { name }) : t('a33.home.open_failed')}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => showA33Screen({ kind: 'launcher' })}>
          {t('a33.agent_screen.back')}
        </Button>
        {chat.setup === 'no_model' && (
          <Button type="button" onClick={() => requestA33KeyPrompt('chat')}>
            {t('a33.agent_screen.set_key')}
          </Button>
        )}
      </div>
    </div>
  )
}
