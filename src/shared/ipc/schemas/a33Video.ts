import * as z from 'zod'

import { defineRoute } from '../define'

const videoModelSchema = z.strictObject({
  id: z.string(),
  // resolution → ¥ per second; empty when a33.club has no price for the model
  prices: z.record(z.string(), z.number())
})

const jobSchema = z.strictObject({ id: z.string().min(1) })

const statusSchema = z.strictObject({
  status: z.enum(['pending', 'done', 'failed']),
  error: z.string().optional()
})

const savedVideoSchema = z.strictObject({ path: z.string(), url: z.string() })

export type A33VideoModel = z.infer<typeof videoModelSchema>
export type A33VideoStatus = z.infer<typeof statusSchema>

/** A33 build: the 生视频 page talks to a33.club /v1/videos with the a33-video provider key from main. */
export const a33VideoRequestSchemas = {
  'a33.video.models': defineRoute({ input: z.void(), output: z.array(videoModelSchema) }),
  'a33.video.submit': defineRoute({
    input: z.strictObject({
      model: z.string().min(1),
      prompt: z.string().min(1),
      resolution: z.string().min(1),
      duration: z.number().int().min(1).max(15),
      aspectRatio: z.string().min(1)
    }),
    output: jobSchema
  }),
  'a33.video.status': defineRoute({ input: jobSchema, output: statusSchema }),
  'a33.video.download': defineRoute({
    input: z.strictObject({ id: z.string().min(1), prompt: z.string() }),
    output: savedVideoSchema
  }),
  'a33.video.reveal': defineRoute({ input: z.strictObject({ path: z.string().min(1) }), output: z.void() })
}
