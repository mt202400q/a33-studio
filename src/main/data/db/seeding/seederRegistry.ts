import type { ISeeder } from '../types'
import { A33ImageAssistantSeeder } from './seeders/a33ImageAssistantSeeder'
import { A33SidebarLayoutSeeder } from './seeders/a33SidebarLayoutSeeder'
import { BrowserCapabilityUpgradeSeeder } from './seeders/browserCapabilityUpgradeSeeder'
import { BuiltinMcpServerSeeder } from './seeders/builtinMcpServerSeeder'
import { CherryAiDefaultModelSeeder } from './seeders/cherryaiDefaultModelSeeder'
import { CherryAssistantInstructionsUpgradeSeeder } from './seeders/CherryAssistantInstructionsUpgradeSeeder'
import { CherryAssistantSeeder } from './seeders/cherryAssistantSeeder'
import { CherrySupportSeeder } from './seeders/cherrySupportSeeder'
import { DefaultAssistantSeeder } from './seeders/defaultAssistantSeeder'
import { KnowledgeBaseOrderSeeder } from './seeders/knowledgeBaseOrderSeeder'
import { LegacyFileCleanupPolicySeeder } from './seeders/legacyFileCleanupPolicySeeder'
import { LocalModelSeeder } from './seeders/LocalModelSeeder'
import { LongTextPastePreferenceUpgradeSeeder } from './seeders/longTextPastePreferenceUpgradeSeeder'
import { MiniAppSeeder } from './seeders/miniAppSeeder'
import { PreferenceSeeder } from './seeders/preferenceSeeder'
import { PresetProviderSeeder } from './seeders/presetProviderSeeder'
import { RetiredAgentRuntimeSeeder } from './seeders/RetiredAgentRuntimeSeeder'
import { SidebarShortcutMigrationSeeder } from './seeders/sidebarShortcutMigrationSeeder'
import { TranslateLanguageSeeder } from './seeders/translateLanguageSeeder'
import { WebSearchPreferenceUpgradeSeeder } from './seeders/WebSearchPreferenceUpgradeSeeder'

/**
 * All seeders in execution order.
 *
 * Keep CherryAiDefaultModelSeeder before DefaultAssistantSeeder because the
 * seeded assistant references the CherryAI default model (FK to user_model).
 *
 * To add a new seeder: create an ISeeder class, add it to this array.
 * No changes to DbService needed.
 */
export const seeders: ISeeder[] = [
  new RetiredAgentRuntimeSeeder(),
  new KnowledgeBaseOrderSeeder(),
  new BrowserCapabilityUpgradeSeeder(),
  new LegacyFileCleanupPolicySeeder(),
  new PresetProviderSeeder(),
  new CherryAiDefaultModelSeeder(),
  new CherryAssistantSeeder(),
  new CherryAssistantInstructionsUpgradeSeeder(),
  new CherrySupportSeeder(),
  new DefaultAssistantSeeder(),
  new A33ImageAssistantSeeder(),
  new LongTextPastePreferenceUpgradeSeeder(),
  new WebSearchPreferenceUpgradeSeeder(),
  new SidebarShortcutMigrationSeeder(),
  new A33SidebarLayoutSeeder(),
  new PreferenceSeeder(),
  new TranslateLanguageSeeder(),
  new LocalModelSeeder(),
  new MiniAppSeeder(),
  new BuiltinMcpServerSeeder()
]
