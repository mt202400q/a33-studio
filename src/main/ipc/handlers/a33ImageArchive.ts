import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { clipboard, ClipboardItem, nativeImage, shell } from 'electron'

import { assertInsideArchive, getImageArchiveRoot, listArchivedImages } from '@main/ai/a33ImageArchive'
import type { a33ImageArchiveRequestSchemas } from '@shared/ipc/schemas/a33ImageArchive'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const a33ImageArchiveHandlers: IpcHandlersFor<typeof a33ImageArchiveRequestSchemas> = {
  'a33.image_archive.list': async () => {
    const { root, days } = await listArchivedImages()
    return {
      root,
      days: days.map((day) => ({
        date: day.date,
        images: day.images.map((image) => ({ ...image, url: pathToFileURL(image.path).toString() }))
      }))
    }
  },
  'a33.image_archive.open_root': async () => {
    const root = getImageArchiveRoot()
    await fs.mkdir(root, { recursive: true })
    await shell.openPath(root)
  },
  'a33.image_archive.reveal': async ({ path }) => shell.showItemInFolder(assertInsideArchive(path)),
  'a33.image_archive.trash': async ({ path }) => shell.trashItem(assertInsideArchive(path)),
  'a33.image_archive.copy': async ({ path }) => {
    const image = nativeImage.createFromPath(assertInsideArchive(path))
    if (image.isEmpty()) return false
    const png = new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' })
    await clipboard.write([new ClipboardItem({ 'image/png': png })])
    return true
  }
}
