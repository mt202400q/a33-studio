import { and, eq, isNull } from 'drizzle-orm'

import { assistantTable } from '@data/db/schemas/assistant'
import { A33_IMAGE_ASSISTANT_ID } from '@shared/data/presets/a33ImageAssistant'

import type { DbType, ISeeder } from '../../types'

/**
 * A33 build: 2.1.8/2.1.9 seeded a chat assistant for 生图. 生图 now has its own page that talks to
 * the image model directly, so the assistant is soft-deleted to keep it out of the 对话 list.
 */
export class A33ImageAssistantSeeder implements ISeeder {
  readonly name = 'a33ImageAssistant'
  readonly description = 'Soft-delete the retired A33 image-generation chat assistant'
  readonly executionPolicy = 'run-on-change' as const
  readonly version = '2'

  run(db: DbType): void {
    db.update(assistantTable)
      .set({ deletedAt: Date.now() })
      .where(and(eq(assistantTable.id, A33_IMAGE_ASSISTANT_ID), isNull(assistantTable.deletedAt)))
      .run()
  }
}
