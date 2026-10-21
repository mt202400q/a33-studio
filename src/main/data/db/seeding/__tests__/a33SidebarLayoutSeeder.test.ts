import { setupTestDatabase } from '@test-helpers/db'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { preferenceTable } from '@data/db/schemas/preference'
import { A33SidebarLayoutSeeder } from '@data/db/seeding/seeders/a33SidebarLayoutSeeder'
import { DefaultPreferences } from '@shared/data/preference/preferenceSchemas'

describe('A33SidebarLayoutSeeder', () => {
  const dbh = setupTestDatabase()

  const readShortcuts = () =>
    dbh.db
      .select({ value: preferenceTable.value })
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, 'default'), eq(preferenceTable.key, 'ui.sidebar_shortcut')))
      .get()?.value

  it('replaces a stored pre-A33 sidebar with the A33 default layout', () => {
    dbh.db.insert(preferenceTable).values({ scope: 'default', key: 'ui.sidebar_shortcut', value: [] }).run()

    new A33SidebarLayoutSeeder().run(dbh.db)

    expect(readShortcuts()).toEqual(DefaultPreferences.default['ui.sidebar_shortcut'])
  })

  it('writes the A33 layout when nothing is stored yet', () => {
    new A33SidebarLayoutSeeder().run(dbh.db)

    expect(readShortcuts()).toEqual(DefaultPreferences.default['ui.sidebar_shortcut'])
  })
})
