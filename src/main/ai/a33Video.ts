import fs from 'node:fs/promises'
import path from 'node:path'

import { application } from '@application'
import { getDataService } from '@main/data/services/dataServiceRegistry'
import type { A33VideoModel, A33VideoStatus } from '@shared/ipc/schemas/a33Video'

const PROVIDER_ID = 'a33-video'
const BASE_URL = 'https://a33.club'
// Published hourly by a33.club: { video: { models: { <model>: { <resolution>: ¥ per second } } } }
const PRICING_URL = `${BASE_URL}/pricing.json`

/** A33 build: generated videos are saved to `Documents/A33 Studio/视频/<YYYY-MM-DD>/`. */
export function getVideoArchiveRoot(): string {
  return path.join(application.getPath('sys.documents'), 'A33 Studio', '视频')
}

function apiKey(): string {
  // Always the first enabled key: a job must be polled with the key (group) that created it.
  const key = getDataService('ProviderService').getApiKeys(PROVIDER_ID, { enabled: true })[0]?.key
  if (!key) throw new Error('No A33 生视频 API key')
  return key
}

async function call(pathname: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(BASE_URL + pathname, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json', ...init.headers }
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed?.error?.message ?? parsed?.message ?? body
    } catch {
      // not JSON
    }
    throw new Error(`HTTP ${response.status}${message ? `: ${String(message).slice(0, 300)}` : ''}`)
  }
  return response
}

async function fetchVideoPrices(): Promise<Record<string, Record<string, number>> | null> {
  try {
    const response = await fetch(PRICING_URL)
    if (!response.ok) return null
    const data = await response.json()
    return data?.video?.models ?? null
  } catch {
    return null
  }
}

/**
 * Video models the key can use: the key's /v1/models list matched against a33.club's video price list.
 * Without the price list, fall back to model ids that look like video models (no estimate shown).
 */
export async function listVideoModels(): Promise<A33VideoModel[]> {
  const [models, prices] = await Promise.all([
    call('/v1/models').then(async (r) => ((await r.json())?.data ?? []) as { id: string }[]),
    fetchVideoPrices()
  ])
  const ids = [...new Set(models.map((m) => m.id))]
  const matched = prices
    ? ids.filter((id) => id in prices)
    : ids.filter((id) => /video|seedance|veo|sora|kling/i.test(id))
  return matched.sort().map((id) => ({ id, prices: prices?.[id] ?? {} }))
}

export async function submitVideo(input: {
  model: string
  prompt: string
  resolution: string
  duration: number
  aspectRatio: string
}): Promise<{ id: string }> {
  const response = await call('/v1/videos/generations', {
    method: 'POST',
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      resolution: input.resolution,
      duration: input.duration,
      aspect_ratio: input.aspectRatio
    })
  })
  const data = await response.json()
  const id = data?.request_id ?? data?.id
  if (!id) throw new Error('No job id in response')
  return { id: String(id) }
}

export async function getVideoStatus(id: string): Promise<A33VideoStatus> {
  const data = await (await call(`/v1/videos/${encodeURIComponent(id)}`)).json()
  if (data?.status === 'done') return { status: 'done' }
  if (data?.status === 'failed' || data?.status === 'expired') {
    return { status: 'failed', error: data?.error?.message ?? String(data.status) }
  }
  return { status: 'pending' }
}

const pad = (n: number) => String(n).padStart(2, '0')

async function uniquePath(dir: string, base: string, ext: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, `${base}${n > 1 ? `-${n}` : ''}${ext}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
}

export async function downloadVideo(id: string, prompt: string): Promise<string> {
  const response = await call(`/v1/videos/${encodeURIComponent(id)}/content`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const now = new Date()
  const dir = path.join(getVideoArchiveRoot(), `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  await fs.mkdir(dir, { recursive: true })
  const slug = Array.from(prompt.replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim())
    .slice(0, 16)
    .join('')
    .trim()
  const base = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${slug ? `-${slug}` : ''}`
  const file = await uniquePath(dir, base, '.mp4')
  await fs.writeFile(file, bytes)
  return file
}

/** Guards renderer-supplied paths: only files inside the video archive may be touched. */
export function assertInsideVideoArchive(filePath: string): string {
  const root = path.resolve(getVideoArchiveRoot())
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(root + path.sep)) throw new Error('Path is outside the video archive')
  return resolved
}
