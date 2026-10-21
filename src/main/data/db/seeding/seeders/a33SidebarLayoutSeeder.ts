import { preferenceTable } from '@data/db/schemas/preference'
import { DefaultPreferences } from '@shared/data/preference/preferenceSchemas'

import type { DbType, ISeeder } from '../../types'

const SIDEBAR_SHORTCUT_KEY = 'ui.sidebar_shortcut'

/**
 * A33 build: the shortcut default only reaches fresh databases, and uninstalling keeps
 * AppData, so upgraded installs kept the old sidebar. Reset it to the A33 layout once per
 * version bump; later user customisation is left alone.
 */
export class A33SidebarLayoutSeeder implements ISeeder {
  readonly name = 'a33SidebarLayout'
  readonly description = 'Reset the sidebar shortcuts to the A33 default layout once'
  readonly executionPolicy = 'run-on-change' as const
  readonly version = '1'

  run(db: DbType): void {
    const value = DefaultPreferences.default[SIDEBAR_SHORTCUT_KEY]
    // eslint-disable-next-line no-restricted-syntax -- intentional one-time reset; gated by `version`
    db.insert(preferenceTable)
      .values({ scope: 'default', key: SIDEBAR_SHORTCUT_KEY, value })
      .onConflictDoUpdate({ target: [preferenceTable.scope, preferenceTable.key], set: { value } })
      .run()
  }
}
