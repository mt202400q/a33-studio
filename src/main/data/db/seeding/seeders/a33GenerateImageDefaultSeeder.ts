import { eq, isNull } from 'drizzle-orm'

import { assistantTable } from '@data/db/schemas/assistant'

import type { DbType, ISeeder } from '../../types'

/**
 * A33 build: the chat 生图 toggle used to default to off, so assistants answered "no image interface".
 * Turn it on once for every existing assistant; users who switch it off afterwards keep their choice.
 */
export class A33GenerateImageDefaultSeeder implements ISeeder {
  readonly name = 'a33GenerateImageDefault'
  readonly description = 'Enable the generate_image tool on existing assistants once'
  readonly executionPolicy = 'run-on-change' as const
  readonly version = '1'

  run(db: DbType): void {
    const rows = db
      .select({ id: assistantTable.id, settings: assistantTable.settings })
      .from(assistantTable)
      .where(isNull(assistantTable.deletedAt))
      .all()
    for (const row of rows) {
      if (row.settings.enableGenerateImage) continue
      db.update(assistantTable)
        .set({ settings: { ...row.settings, enableGenerateImage: true } })
        .where(eq(assistantTable.id, row.id))
        .run()
    }
  }
}
