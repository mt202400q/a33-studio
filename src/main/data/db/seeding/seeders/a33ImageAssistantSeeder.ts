import { eq, isNull } from 'drizzle-orm'
import { app } from 'electron'

import { assistantTable } from '@data/db/schemas/assistant'
import { insertWithOrderKey } from '@data/services/utils/orderKey'
import {
  A33_IMAGE_ASSISTANT_ID,
  A33_IMAGE_ASSISTANT_SEED,
  getA33ImageAssistantNameForLocale
} from '@shared/data/presets/a33ImageAssistant'

import type { DbType, ISeeder } from '../../types'

/** A33 build: the 生图 sidebar entry is a chat with this image-generation assistant. */
export class A33ImageAssistantSeeder implements ISeeder {
  readonly name = 'a33ImageAssistant'
  readonly description = 'Insert the A33 image-generation assistant once (a user deletion is respected)'
  readonly executionPolicy = 'run-on-change' as const
  readonly version = '1'

  run(db: DbType): void {
    db.transaction((tx) => {
      const [existing] = tx
        .select({ id: assistantTable.id })
        .from(assistantTable)
        .where(eq(assistantTable.id, A33_IMAGE_ASSISTANT_ID))
        .limit(1)
        .all()
      if (existing) return

      let locale: string | undefined
      try {
        locale = app.getPreferredSystemLanguages()[0]
      } catch {
        locale = undefined
      }

      insertWithOrderKey(
        tx,
        assistantTable,
        {
          ...A33_IMAGE_ASSISTANT_SEED,
          name: getA33ImageAssistantNameForLocale(locale),
          settings: { ...A33_IMAGE_ASSISTANT_SEED.settings }
        },
        { pkColumn: assistantTable.id, scope: isNull(assistantTable.deletedAt) }
      )
    })
  }
}
