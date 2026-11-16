import { setupTestDatabase } from '@test-helpers/db'
import { eq, sql } from 'drizzle-orm'
import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { agentTable } from '@data/db/schemas/agent'
import { agentSessionTable } from '@data/db/schemas/agentSession'
import { assistantTable } from '@data/db/schemas/assistant'
import { A33AssistantCleanupSeeder } from '@data/db/seeding/seeders/a33AssistantCleanupSeeder'
import { CherryAiDefaultModelSeeder } from '@data/db/seeding/seeders/cherryaiDefaultModelSeeder'
import { CherryAssistantSeeder } from '@data/db/seeding/seeders/cherryAssistantSeeder'
import { CherrySupportSeeder } from '@data/db/seeding/seeders/cherrySupportSeeder'
import { DefaultAssistantSeeder } from '@data/db/seeding/seeders/defaultAssistantSeeder'

describe('A33AssistantCleanupSeeder', () => {
  const dbh = setupTestDatabase()

  beforeEach(() => {
    vi.mocked(app.getLocale).mockReturnValue('zh-CN')
    vi.mocked(app.getPreferredSystemLanguages).mockReturnValue(['zh-CN'])
  })

  it('renames the legacy default assistant in place and leaves user-named assistants alone', () => {
    new CherryAiDefaultModelSeeder().run(dbh.db)
    new DefaultAssistantSeeder().run(dbh.db)
    const [seeded] = dbh.db.select().from(assistantTable).all()
    dbh.db.update(assistantTable).set({ name: 'Cherry 助手' }).where(eq(assistantTable.id, seeded.id)).run()

    new A33AssistantCleanupSeeder().run(dbh.db)

    const [renamed] = dbh.db.select().from(assistantTable).where(eq(assistantTable.id, seeded.id)).all()
    expect(renamed.name).toBe('A33 助手')
    expect(renamed.deletedAt).toBeNull()

    dbh.db.update(assistantTable).set({ name: '我的助手' }).where(eq(assistantTable.id, seeded.id)).run()
    new A33AssistantCleanupSeeder().run(dbh.db)
    expect(dbh.db.select().from(assistantTable).where(eq(assistantTable.id, seeded.id)).all()[0].name).toBe('我的助手')
  })

  it('moves the builtin Cherry agents and their sessions to the trash', () => {
    new CherryAiDefaultModelSeeder().run(dbh.db)
    new CherryAssistantSeeder().run(dbh.db)
    new CherrySupportSeeder().run(dbh.db)
    const builtin = dbh.db
      .select()
      .from(agentTable)
      .where(sql`json_extract(${agentTable.configuration}, '$.builtin_role') IS NOT NULL`)
      .all()
    expect(builtin).toHaveLength(2)

    new A33AssistantCleanupSeeder().run(dbh.db)

    for (const agent of builtin) {
      const [row] = dbh.db.select().from(agentTable).where(eq(agentTable.id, agent.id)).all()
      expect(row.deletedAt).not.toBeNull()
      const sessions = dbh.db.select().from(agentSessionTable).where(eq(agentSessionTable.agentId, agent.id)).all()
      expect(sessions.length).toBeGreaterThan(0)
      expect(sessions.every((session) => session.deletedAt !== null)).toBe(true)
    }
  })
})
