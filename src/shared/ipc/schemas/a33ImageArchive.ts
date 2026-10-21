import * as z from 'zod'

import { defineRoute } from '../define'

const archivedImageSchema = z.strictObject({
  path: z.string(),
  name: z.string(),
  url: z.string(),
  mtimeMs: z.number()
})

const archiveListingSchema = z.strictObject({
  root: z.string(),
  days: z.array(z.strictObject({ date: z.string(), images: z.array(archivedImageSchema) }))
})

export type ArchivedImageListing = z.infer<typeof archiveListingSchema>
export type ArchivedImageItem = z.infer<typeof archivedImageSchema>

const imagePathSchema = z.strictObject({ path: z.string().min(1) })

/** A33 build: the 图库 page reads the dated image archive (Documents/A33 Studio/图/YYYY-MM-DD). */
export const a33ImageArchiveRequestSchemas = {
  'a33.image_archive.list': defineRoute({ input: z.void(), output: archiveListingSchema }),
  'a33.image_archive.open_root': defineRoute({ input: z.void(), output: z.void() }),
  'a33.image_archive.reveal': defineRoute({ input: imagePathSchema, output: z.void() }),
  'a33.image_archive.trash': defineRoute({ input: imagePathSchema, output: z.void() }),
  'a33.image_archive.copy': defineRoute({ input: imagePathSchema, output: z.boolean() })
}
