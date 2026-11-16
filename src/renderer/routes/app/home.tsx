import { createFileRoute, redirect } from '@tanstack/react-router'

// A33 build: 首页 is the standalone launcher screen; a tab left on /app/home from older builds lands on chat.
export const Route = createFileRoute('/app/home')({
  beforeLoad: () => {
    throw redirect({ to: '/app/chat', replace: true })
  }
})
