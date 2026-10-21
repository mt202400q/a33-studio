import fs from 'node:fs/promises'
import path from 'node:path'

import { application } from '@application'
import { loggerService } from '@logger'
import type { FileEntryId } from '@shared/data/types/file'

const logger = loggerService.withContext('A33ImageArchive')

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/

/** A33 build: generated images are also copied to `<root>/<YYYY-MM-DD>/` so users can find them on disk. */
export function getImageArchiveRoot(): string {
  const custom = application.get('PreferenceService').get('feature.paintings.archive.dir')
  return custom || path.join(application.getPath('sys.documents'), 'A33 Studio', '图')
}

const pad = (n: number) => String(n).padStart(2, '0')

function promptSlug(prompt: string | undefined): string {
  const cleaned = (prompt ?? '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim()
  return Array.from(cleaned).slice(0, 16).join('').trim()
}

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

/** Best-effort copy of freshly generated images; never throws into the generation path. */
export async function archiveGeneratedImages(files: readonly { id: FileEntryId }[], prompt?: string): Promise<void> {
  try {
    if (files.length === 0 || !application.get('PreferenceService').get('feature.paintings.archive.enabled')) return
    const now = new Date()
    const dir = path.join(
      getImageArchiveRoot(),
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    )
    await fs.mkdir(dir, { recursive: true })
    const slug = promptSlug(prompt)
    const base = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${slug ? `-${slug}` : ''}`
    const fileManager = application.get('FileManager')
    for (const file of files) {
      const source = fileManager.getPhysicalPath(file.id)
      const ext = path.extname(source).toLowerCase() || '.png'
      await fs.copyFile(source, await uniquePath(dir, base, ext))
    }
  } catch (error) {
    logger.warn('Failed to archive generated images', error as Error)
  }
}

export interface ArchivedImage {
  path: string
  name: string
  mtimeMs: number
}

export interface ArchivedImageDay {
  date: string
  images: ArchivedImage[]
}

/** Lists the archive newest-first; only `YYYY-MM-DD` folders and image files are included. */
export async function listArchivedImages(): Promise<{ root: string; days: ArchivedImageDay[] }> {
  const root = getImageArchiveRoot()
  let dayNames: string[]
  try {
    dayNames = (await fs.readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && DATE_DIR.test(entry.name))
      .map((entry) => entry.name)
  } catch {
    return { root, days: [] }
  }
  const days: ArchivedImageDay[] = []
  for (const date of dayNames.sort().reverse()) {
    const dir = path.join(root, date)
    const images: ArchivedImage[] = []
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue
      const filePath = path.join(dir, entry.name)
      const stat = await fs.stat(filePath)
      images.push({ path: filePath, name: entry.name, mtimeMs: stat.mtimeMs })
    }
    if (images.length > 0) days.push({ date, images: images.sort((a, b) => b.mtimeMs - a.mtimeMs) })
  }
  return { root, days }
}

/** Guards renderer-supplied paths: only files inside the archive root may be touched. */
export function assertInsideArchive(filePath: string): string {
  const root = path.resolve(getImageArchiveRoot())
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(root + path.sep)) throw new Error('Path is outside the image archive')
  return resolved
}
