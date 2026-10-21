import { ImagePlus, Loader2, MessageSquarePlus, Send, Trash2, X } from 'lucide-react'
import { type ClipboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, EmptyState, PageHeader, Scrollbar, Switch, Textarea } from '@cherrystudio/ui'
import { cn } from '@cherrystudio/ui/lib/utils'
import { usePreference } from '@data/hooks/usePreference'
import { usePaintings } from '@renderer/hooks/usePaintings'
import { toast } from '@renderer/services/toast'

import { usePaintingProviderRuntime } from '../hooks/usePaintingProviderRuntime'
import { generatePainting } from '../model/generatePainting'
import { getPaintingFileUrl } from '../utils/paintingFileUrl'

/** A33 build: chat-style 生图 that talks to the image model only (gpt-image-2 generate/edit). */

const PROVIDER_ID = 'a33-image'
const STORAGE_KEY = 'a33.image-chat.sessions'

interface OutputImage {
  id: string
  name: string
  path: string
  ext: string
}

interface Turn {
  id: string
  prompt: string
  references: string[]
  outputs: OutputImage[]
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

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${mime};base64,${btoa(binary)}`
}

async function outputToDataUrl(image: OutputImage): Promise<string> {
  const { data, mime } = await window.api.file.binaryImage(image.name)
  return bytesToDataUrl(new Uint8Array(data), mime)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const newSession = (): Session => ({ id: crypto.randomUUID(), title: '', turns: [], updatedAt: Date.now() })

export default function ImageChatPage() {
  const { t } = useTranslation()
  const { provider } = usePaintingProviderRuntime(PROVIDER_ID)
  const [paintingModelId] = usePreference('feature.paintings.default_model_id')
  const { createPainting } = usePaintings()
  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = loadSessions()
    return stored.length > 0 ? stored : [newSession()]
  })
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  const [prompt, setPrompt] = useState('')
  const [references, setReferences] = useState<string[]>([])
  const [freshImage, setFreshImage] = useState(false)
  const [baseImageId, setBaseImageId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const session = sessions.find((s) => s.id === activeId) ?? sessions[0]
  // The image model must come from the a33-image provider; a chat default never qualifies here.
  const modelId = paintingModelId?.startsWith(`${PROVIDER_ID}::`) ? paintingModelId.split('::')[1] : 'gpt-image-2'
  const allOutputs = useMemo(() => session.turns.flatMap((turn) => turn.outputs), [session])
  const baseImage = freshImage
    ? undefined
    : (allOutputs.find((image) => image.id === baseImageId) ?? allOutputs[allOutputs.length - 1])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.turns.length, busy])

  const updateSession = (id: string, update: (s: Session) => Session) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? update(s) : s)))

  const startNewSession = () => {
    const created = newSession()
    setSessions((prev) => [created, ...prev])
    setActiveId(created.id)
    setBaseImageId(null)
    setFreshImage(false)
  }

  const deleteSession = (id: string) => {
    const remaining = sessions.filter((s) => s.id !== id)
    const next = remaining.length > 0 ? remaining : [newSession()]
    setSessions(next)
    if (id === activeId) setActiveId(next[0].id)
  }

  const addReferenceFiles = async (files: Iterable<File>) => {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    const urls = await Promise.all(images.map(readFileAsDataUrl))
    setReferences((prev) => [...prev, ...urls].slice(0, 4))
  }

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.some((file) => file.type.startsWith('image/'))) {
      event.preventDefault()
      void addReferenceFiles(files)
    }
  }

  const send = async () => {
    const text = prompt.trim()
    if (!text || busy) return
    const sessionId = session.id
    const turn: Turn = { id: crypto.randomUUID(), prompt: text, references, outputs: [], createdAt: Date.now() }
    updateSession(sessionId, (s) => ({
      ...s,
      title: s.title || text.slice(0, 30),
      turns: [...s.turns, turn],
      updatedAt: Date.now()
    }))
    setPrompt('')
    setReferences([])
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const inputImages = [...(baseImage ? [await outputToDataUrl(baseImage)] : []), ...references]
      const files = await generatePainting({
        provider,
        signal: controller.signal,
        modelId,
        prompt: text,
        mode: inputImages.length > 0 ? 'edit' : 'generate',
        paramValues: {},
        ...(inputImages.length > 0 && { inputImages })
      })
      const outputs = files.map(({ id, name, path, ext }) => ({ id, name, path, ext }))
      // A painting row references the files so cleanup keeps them; it also lists them in 高级生图 history.
      await createPainting({
        providerId: PROVIDER_ID,
        modelId,
        prompt: text,
        files: { output: outputs.map((o) => o.id), input: [] }
      })
      updateSession(sessionId, (s) => ({
        ...s,
        turns: s.turns.map((item) => (item.id === turn.id ? { ...item, outputs } : item))
      }))
      setBaseImageId(null)
      setFreshImage(false)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : String(error)
      updateSession(sessionId, (s) => ({
        ...s,
        turns: s.turns.map((item) => (item.id === turn.id ? { ...item, error: message } : item))
      }))
      toast.error(t('a33.image_chat.failed'))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="flex w-56 shrink-0 flex-col border-border border-r">
        <PageHeader
          title={t('a33.image_chat.title')}
          action={
            <Button size="sm" variant="ghost" onClick={startNewSession} aria-label={t('a33.image_chat.new_session')}>
              <MessageSquarePlus size={14} />
            </Button>
          }
        />
        <Scrollbar className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 px-2 pb-2">
            {sessions.map((item) => {
              const thumb = item.turns.flatMap((turn) => turn.outputs)[0]
              return (
                <div
                  key={item.id}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                    item.id === session.id && 'bg-muted'
                  )}
                  onClick={() => {
                    setActiveId(item.id)
                    setBaseImageId(null)
                  }}>
                  <div className="size-8 shrink-0 overflow-hidden rounded bg-muted-foreground/10">
                    {thumb && <img src={getPaintingFileUrl(thumb)} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <span className="min-w-0 flex-1 truncate">{item.title || t('a33.image_chat.untitled')}</span>
                  <button
                    type="button"
                    className="invisible cursor-pointer border-0 bg-transparent p-0 text-muted-foreground group-hover:visible"
                    aria-label={t('a33.image_chat.delete_session')}
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteSession(item.id)
                    }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </Scrollbar>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <Scrollbar className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
            {session.turns.length === 0 && (
              <EmptyState title={t('a33.image_chat.empty_title')} description={t('a33.image_chat.empty_hint')} />
            )}
            {session.turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary/10 px-4 py-2 text-sm">
                    {turn.prompt}
                  </div>
                  {turn.references.length > 0 && (
                    <div className="flex gap-1">
                      {turn.references.map((ref, i) => (
                        <img key={i} src={ref} alt="" className="size-12 rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                {turn.error ? (
                  <div className="text-destructive text-sm">{turn.error}</div>
                ) : turn.outputs.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    {t('a33.image_chat.generating')}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {turn.outputs.map((image) => (
                      <div key={image.id} className="group relative">
                        <img
                          src={getPaintingFileUrl(image)}
                          alt=""
                          className={cn(
                            'max-h-80 max-w-full rounded-lg border border-border',
                            baseImage?.id === image.id && 'ring-2 ring-primary'
                          )}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            setBaseImageId(image.id)
                            setFreshImage(false)
                          }}>
                          {t('a33.image_chat.continue_from')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </Scrollbar>

        <div className="mx-auto w-full max-w-3xl px-6 pb-5">
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
            {(references.length > 0 || baseImage) && (
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                {baseImage && (
                  <span className="flex items-center gap-1">
                    <img src={getPaintingFileUrl(baseImage)} alt="" className="size-8 rounded object-cover" />
                    {t('a33.image_chat.editing_base')}
                  </span>
                )}
                {references.map((ref, i) => (
                  <span key={i} className="relative">
                    <img src={ref} alt="" className="size-8 rounded object-cover" />
                    <button
                      type="button"
                      className="-top-1 -right-1 absolute cursor-pointer rounded-full border-0 bg-background p-0"
                      onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Textarea
              value={prompt}
              rows={2}
              placeholder={t(baseImage ? 'a33.image_chat.placeholder_edit' : 'a33.image_chat.placeholder_new')}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={onPaste}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={14} />
                {t('a33.image_chat.add_reference')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  if (event.target.files) void addReferenceFiles(event.target.files)
                  event.target.value = ''
                }}
              />
              {allOutputs.length > 0 && (
                <label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Switch size="sm" checked={freshImage} onCheckedChange={setFreshImage} />
                  {t('a33.image_chat.fresh_image')}
                </label>
              )}
              <div className="flex-1" />
              {busy ? (
                <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
                  {t('a33.image_chat.stop')}
                </Button>
              ) : (
                <Button size="sm" disabled={!prompt.trim()} onClick={() => void send()}>
                  <Send size={14} />
                  {t('a33.image_chat.send')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
