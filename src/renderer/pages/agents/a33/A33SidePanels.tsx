import { CheckCircle2, Circle, CircleDot, FileCode2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AgentStatusTask } from '../components/AgentRightPane'
import type { ChangedFile } from './agentChanges'

const TASK_ICONS = {
  pending: Circle,
  in_progress: CircleDot,
  completed: CheckCircle2,
  error: XCircle
} as const

/** The agent's live plan (to-do list), with done / total. */
export function A33PlanList({ tasks, completed }: { tasks: readonly AgentStatusTask[]; completed: number }) {
  const { t } = useTranslation()
  if (tasks.length === 0) {
    return <p className="m-0 text-muted-foreground text-xs">{t('a33.agent_screen.plan_empty')}</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs tabular-nums">
        {t('a33.agent_screen.plan_progress', { done: completed, total: tasks.length })}
      </span>
      {tasks.map((task) => {
        const Icon = TASK_ICONS[task.status]
        return (
          <div key={task.id} className="flex items-start gap-2 text-[13px]">
            <Icon
              className={`mt-0.5 size-3.5 shrink-0 ${task.status === 'completed' ? 'text-success' : task.status === 'error' ? 'text-error' : 'text-muted-foreground'}`}
            />
            <span className={task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}>
              {task.status === 'in_progress' ? (task.activeText ?? task.title) : task.title}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function splitPath(path: string): { name: string; dir: string } {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index < 0 ? { name: path, dir: '' } : { name: path.slice(index + 1), dir: path.slice(0, index) }
}

/** Files the agent changed, with added / removed line counts. */
export function A33ChangesList({ files }: { files: readonly ChangedFile[] }) {
  const { t } = useTranslation()
  if (files.length === 0) {
    return <p className="m-0 text-muted-foreground text-xs">{t('a33.agent_screen.changes_empty')}</p>
  }
  const added = files.reduce((sum, file) => sum + file.additions, 0)
  const removed = files.reduce((sum, file) => sum + file.deletions, 0)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs tabular-nums">
        {t('a33.agent_screen.changes_summary', { n: files.length })} <span className="text-success">+{added}</span>{' '}
        <span className="text-error">−{removed}</span>
      </span>
      {files.map((file) => {
        const { name, dir } = splitPath(file.path)
        return (
          <div key={file.path} title={file.path} className="flex items-center gap-2 rounded-md py-1 text-[13px]">
            <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-foreground">{name}</span>
              {dir && <span className="ml-1.5 text-muted-foreground text-xs">{dir}</span>}
            </span>
            <span className="shrink-0 text-xs tabular-nums">
              <span className="text-success">+{file.additions}</span>{' '}
              <span className="text-error">−{file.deletions}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
