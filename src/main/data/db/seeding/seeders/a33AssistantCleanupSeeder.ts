import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { agentTable } from '@data/db/schemas/agent'
import { agentSessionTable } from '@data/db/schemas/agentSession'
import { assistantTable } from '@data/db/schemas/assistant'
import { BUILTIN_AGENT_ROLE } from '@shared/ai/builtinAgent'
import { DEFAULT_ASSISTANT_NAME, DEFAULT_ASSISTANT_NAME_ZH } from '@shared/data/presets/defaultAssistant'

import type { DbType, ISeeder } from '../../types'

const LEGACY_ASSISTANT_NAMES = { 'Cherry Assistant': DEFAULT_ASSISTANT_NAME, 'Cherry 助手': DEFAULT_ASSISTANT_NAME_ZH }

/**
 * A33 build, once: the seeded 「Cherry 助手」 becomes 「A33 助手」 (topics kept), and the builtin
 * Cherry Assistant / Support / Doctor agents go to the trash together with their sessions.
 */
export class A33AssistantCleanupSeeder implements ISeeder {
  readonly name = 'a33AssistantCleanup'
  readonly description = 'Rename the default assistant to A33 and trash the builtin Cherry agents'
  readonly executionPolicy = 'run-on-change' as const
  readonly version = '1'

  run(db: DbType): void {
    db.transaction((tx) => {
      for (const [legacy, name] of Object.entries(LEGACY_ASSISTANT_NAMES)) {
        tx.update(assistantTable).set({ name }).where(eq(assistantTable.name, legacy)).run()
      }

      // Same timestamp on agent and sessions, as the trash does, so restoring the agent brings its sessions back.
      const trashedAt = Date.now()
      const builtinIds = tx
        .select({ id: agentTable.id })
        .from(agentTable)
        .where(
          and(
            isNull(agentTable.deletedAt),
            inArray(sql`json_extract(${agentTable.configuration}, '$.builtin_role')`, Object.values(BUILTIN_AGENT_ROLE))
          )
        )
        .all()
        .map((row) => row.id)
      if (builtinIds.length === 0) return
      tx.update(agentTable).set({ deletedAt: trashedAt }).where(inArray(agentTable.id, builtinIds)).run()
      tx.update(agentSessionTable)
        .set({ deletedAt: trashedAt })
        .where(and(inArray(agentSessionTable.agentId, builtinIds), isNull(agentSessionTable.deletedAt)))
        .run()
    })
  }
}
