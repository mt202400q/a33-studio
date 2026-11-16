import type { ReactNode } from 'react'

import { WindowControls } from '@renderer/components/WindowControls'
import { isWin } from '@renderer/utils/platform'
import { cn } from '@renderer/utils/style'

/** A33 build: top bar for the standalone screens — draggable, with the OS window controls on the right. */
export function A33WindowBar({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn('drag flex h-[var(--app-top-chrome-height)] shrink-0 items-center', className)}
      style={isWin ? { minHeight: 'env(titlebar-area-height, 0px)' } : undefined}>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
      <div className="nodrag flex items-center">
        <WindowControls />
      </div>
    </div>
  )
}
