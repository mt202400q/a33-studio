import { createFileRoute } from '@tanstack/react-router'

import ImageChatPage from '@renderer/pages/paintings/imageChat/ImageChatPage'

export const Route = createFileRoute('/app/image')({
  component: ImageChatPage
})
