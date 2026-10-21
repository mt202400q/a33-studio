import { createFileRoute } from '@tanstack/react-router'

import GalleryPage from '@renderer/pages/gallery/GalleryPage'

export const Route = createFileRoute('/app/gallery')({
  component: GalleryPage
})
