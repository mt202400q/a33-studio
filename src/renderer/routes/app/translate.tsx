import { createFileRoute, redirect } from '@tanstack/react-router'

import TranslatePage from '@renderer/pages/translate/TranslatePage'
import { A33_HIDE_TRANSLATE } from '@renderer/utils/a33'

export const Route = createFileRoute('/app/translate')({
  // A33 build: translation is removed; links, deep links and the navigate tool land on 智能体.
  beforeLoad: () => {
    if (A33_HIDE_TRANSLATE) throw redirect({ to: '/app/agents', replace: true })
  },
  component: TranslatePage
})
