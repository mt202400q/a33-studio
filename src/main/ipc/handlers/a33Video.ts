import { pathToFileURL } from 'node:url'

import { shell } from 'electron'

import {
  assertInsideVideoArchive,
  downloadVideo,
  getVideoStatus,
  listVideoModels,
  submitVideo
} from '@main/ai/a33Video'
import type { a33VideoRequestSchemas } from '@shared/ipc/schemas/a33Video'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const a33VideoHandlers: IpcHandlersFor<typeof a33VideoRequestSchemas> = {
  'a33.video.models': () => listVideoModels(),
  'a33.video.submit': (input) => submitVideo(input),
  'a33.video.status': ({ id }) => getVideoStatus(id),
  'a33.video.download': async ({ id, prompt }) => {
    const file = await downloadVideo(id, prompt)
    return { path: file, url: pathToFileURL(file).toString() }
  },
  'a33.video.reveal': async ({ path }) => shell.showItemInFolder(assertInsideVideoArchive(path))
}
