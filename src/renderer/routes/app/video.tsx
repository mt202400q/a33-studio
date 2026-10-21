import { createFileRoute } from '@tanstack/react-router'

import VideoChatPage from '@renderer/pages/video/VideoChatPage'

export const Route = createFileRoute('/app/video')({
  component: VideoChatPage
})
