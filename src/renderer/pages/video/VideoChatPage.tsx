import { FolderOpen, Loader2, MessageSquarePlus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  EmptyState,
  PageHeader,
  Scrollbar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from '@cherrystudio/ui'
import { cn } from '@cherrystudio/ui/lib/utils'
import { A33KeyBanner } from '@renderer/components/a33/A33KeyBanner'
import { useProvider } from '@renderer/hooks/useProvider'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import { requestA33KeyPrompt } from '@renderer/utils/a33'
import type { A33VideoModel } from '@shared/ipc/schemas/a33Video'

/** A33 build: chat-style 生视频 against a33.club /v1/videos (submit → poll → save to Documents/A33 Studio/视频). */

const PROVIDER_ID = 'a33-video'
const STORAGE_KEY = 'a33.video-chat.sessions'
const POLL_INTERVAL_MS = 5000
const JOB_TIMEOUT_MS = 30 * 60 * 1000
const DURATIONS = [5, 8, 10, 15]
const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4']
const RESOLUTION_ORDER = ['480p', '720p', '1080p']

interface Turn {
  id: string
  prompt: string
  model: string
  resolution: string
  duration: number
  aspectRatio: string
  jobId?: string
  video?: { path: string; url: string }
  error?: string
  createdAt: number
}

interface Session {
  id: string
  title: string
  turns: Turn[]
  updatedAt: number
}

function loadSessions(): Session[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const newSession = (): Session => ({ id: crypto.randomUUID(), title: '', turns: [], updatedAt: Date.now() })

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const sortResolutions = (resolutions: string[]) =>
  [...resolutions].sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b))

const isPending = (turn: Turn) => !turn.video && !turn.error

export default function VideoChatPage() {
  const { t } = useTranslation()
  const { provider } = useProvider(PROVIDER_ID)
  const keyCount = provider?.apiKeys.length ?? 0
  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = loadSessions()
    return stored.length > 0 ? stored : [newSession()]
  })
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<A33VideoModel[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelId, setModelId] = useState('')
  const [resolution, setResolution] = useState('480p')
  const [duration, setDuration] = useState(5)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [submitting, setSubmitting] = useState(false)
  const inflightRef = useRef(new Set<string>())
  const bottomRef = useRef<HTMLDivElement>(null)

  const session = sessions.find((s) => s.id === activeId) ?? sessions[0]
  const model = models.find((m) => m.id === modelId)
  const resolutions = useMemo(
    () =>
      model && Object.keys(model.prices).length > 0 ? sortResolutions(Object.keys(model.prices)) : RESOLUTION_ORDER,
    [model]
  )
  const pricePerSecond = model?.prices[resolution]
  const estimate = pricePerSecond !== undefined ? pricePerSecond * duration : undefined

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.turns.length])

  const loadModels = useCallback(async () => {
    if (keyCount === 0) return
    setLoadingModels(true)
    try {
      const list = await ipcApi.request('a33.video.models')
      setModels(list)
      setModelsError(null)
      setModelId((current) => (list.some((m) => m.id === current) ? current : (list[0]?.id ?? '')))
    } catch (error) {
      setModelsError(errorMessage(error))
    } finally {
      setLoadingModels(false)
    }
  }, [keyCount])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  // Keep the chosen resolution valid for the selected model.
  useEffect(() => {
    if (!resolutions.includes(resolution)) setResolution(resolutions[0])
  }, [resolutions, resolution])

  const updateTurn = useCallback((turnId: string, patch: Partial<Turn>) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.turns.some((turn) => turn.id === turnId)
          ? { ...s, turns: s.turns.map((turn) => (turn.id === turnId ? { ...turn, ...patch } : turn)) }
          : s
      )
    )
  }, [])

  // Poll every pending job across all sessions; jobs survive page switches and app restarts.
  useEffect(() => {
    const pending = sessions.flatMap((s) => s.turns).filter((turn) => turn.jobId && isPending(turn))
    if (pending.length === 0) return
    const timer = setInterval(() => {
      for (const turn of pending) {
        const jobId = turn.jobId!
        if (inflightRef.current.has(turn.id)) continue
        inflightRef.current.add(turn.id)
        void (async () => {
          try {
            const status = await ipcApi.request('a33.video.status', { id: jobId })
            if (status.status === 'done') {
              const video = await ipcApi.request('a33.video.download', { id: jobId, prompt: turn.prompt })
              updateTurn(turn.id, { video })
            } else if (status.status === 'failed') {
              updateTurn(turn.id, { error: status.error || t('a33.video_chat.failed') })
            } else if (Date.now() - turn.createdAt > JOB_TIMEOUT_MS) {
              updateTurn(turn.id, { error: t('a33.video_chat.timeout') })
            }
          } catch (error) {
            // Network hiccups are retried on the next tick; give up only after the job timeout.
            if (Date.now() - turn.createdAt > JOB_TIMEOUT_MS) updateTurn(turn.id, { error: errorMessage(error) })
          } finally {
            inflightRef.current.delete(turn.id)
          }
        })()
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [sessions, t, updateTurn])

  const startNewSession = () => {
    const created = newSession()
    setSessions((prev) => [created, ...prev])
    setActiveId(created.id)
  }

  const deleteSession = (id: string) => {
    const remaining = sessions.filter((s) => s.id !== id)
    const next = remaining.length > 0 ? remaining : [newSession()]
    setSessions(next)
    if (id === activeId) setActiveId(next[0].id)
  }

  const send = async () => {
    const text = prompt.trim()
    if (keyCount === 0) {
      requestA33KeyPrompt('video')
      return
    }
    if (!text || !modelId || submitting) return
    const sessionId = session.id
    const turn: Turn = {
      id: crypto.randomUUID(),
      prompt: text,
      model: modelId,
      resolution,
      duration,
      aspectRatio,
      createdAt: Date.now()
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, title: s.title || text.slice(0, 30), turns: [...s.turns, turn], updatedAt: Date.now() }
          : s
      )
    )
    setPrompt('')
    setSubmitting(true)
    try {
      const { id } = await ipcApi.request('a33.video.submit', {
        model: modelId,
        prompt: text,
        resolution,
        duration,
        aspectRatio
      })
      updateTurn(turn.id, { jobId: id, createdAt: Date.now() })
    } catch (error) {
      updateTurn(turn.id, { error: errorMessage(error) })
      toast.error(t('a33.video_chat.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const noModels = keyCount > 0 && !loadingModels && !modelsError && models.length === 0

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="flex w-56 shrink-0 flex-col border-border border-r">
        <PageHeader
          title={t('a33.video_chat.title')}
          action={
            <Button size="sm" variant="ghost" onClick={startNewSession} aria-label={t('a33.video_chat.new_session')}>
              <MessageSquarePlus size={14} />
            </Button>
          }
        />
        <Scrollbar className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 px-2 pb-2">
            {sessions.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                  item.id === session.id && 'bg-muted'
                )}
                onClick={() => setActiveId(item.id)}>
                {item.turns.some((turn) => turn.jobId && isPending(turn)) && (
                  <Loader2 size={12} className="shrink-0 animate-spin text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.title || t('a33.video_chat.untitled')}</span>
                <button
                  type="button"
                  className="invisible cursor-pointer border-0 bg-transparent p-0 text-muted-foreground group-hover:visible"
                  aria-label={t('a33.video_chat.delete_session')}
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteSession(item.id)
                  }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Scrollbar>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <Scrollbar className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
            {session.turns.length === 0 && (
              <EmptyState title={t('a33.video_chat.empty_title')} description={t('a33.video_chat.empty_hint')} />
            )}
            {session.turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary/10 px-4 py-2 text-sm">
                    {turn.prompt}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {turn.model} · {turn.resolution} · {turn.duration}s · {turn.aspectRatio}
                  </span>
                </div>
                {turn.error ? (
                  <div className="text-destructive text-sm">{turn.error}</div>
                ) : turn.video ? (
                  <div className="flex flex-col items-start gap-1">
                    <video
                      src={turn.video.url}
                      controls
                      className="max-h-96 max-w-full rounded-lg border border-border"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void ipcApi.request('a33.video.reveal', { path: turn.video!.path })}>
                      <FolderOpen size={14} />
                      {t('a33.video_chat.reveal')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    {t(turn.jobId ? 'a33.video_chat.generating' : 'a33.video_chat.submitting')}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </Scrollbar>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 pb-5">
          <A33KeyBanner kind="video" />
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <Textarea.Input
              value={prompt}
              rows={2}
              placeholder={t('a33.video_chat.placeholder')}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={modelId} onValueChange={setModelId} disabled={models.length === 0}>
                <SelectTrigger aria-label={t('a33.video_chat.model')} className="h-8 w-auto min-w-40 text-xs">
                  <SelectValue
                    placeholder={t(
                      loadingModels
                        ? 'a33.video_chat.loading_models'
                        : noModels
                          ? 'a33.video_chat.no_models'
                          : 'a33.video_chat.model'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger aria-label={t('a33.video_chat.resolution')} className="h-8 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutions.map((res) => (
                    <SelectItem key={res} value={res}>
                      {res}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
                <SelectTrigger aria-label={t('a33.video_chat.duration')} className="h-8 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((seconds) => (
                    <SelectItem key={seconds} value={String(seconds)}>
                      {t('a33.video_chat.seconds', { seconds })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger aria-label={t('a33.video_chat.aspect_ratio')} className="h-8 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {ratio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelsError && (
                <Button size="sm" variant="ghost" onClick={() => void loadModels()} title={modelsError}>
                  <RefreshCw size={14} />
                  {t('a33.video_chat.retry_models')}
                </Button>
              )}
              <div className="flex-1" />
              {estimate !== undefined && (
                <span className="text-muted-foreground text-xs">
                  {t('a33.video_chat.estimate', { amount: estimate.toFixed(2) })}
                </span>
              )}
              <Button
                size="sm"
                loading={submitting}
                disabled={!prompt.trim() || (keyCount > 0 && !modelId)}
                onClick={() => void send()}>
                <Send size={14} />
                {t('a33.video_chat.send')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
