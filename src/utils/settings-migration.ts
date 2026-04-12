import { DateHelpersSettings } from '@/types/settings';

/**
 * Phase 5 settings interface (for migration purposes)
 */
interface Phase5Settings {
  enableDailyNotesIntegration?: boolean;
  showTextCommands?: boolean;
  showDailyNotesCommands?: boolean;
  [key: string]: unknown;
}

/**
 * Phase 6 settings interface (for migration purposes)
 */
interface Phase6Settings {
  mode?: 'text' | 'daily-notes';
  [key: string]: unknown;
}

/**
 * Migrate settings across all phases
 *
 * Supported migrations:
 * - Phase 5 → Phase 7.2 (direct)
 * - Phase 6 → Phase 7.2
 *
 * Phase 5 → Phase 6 changes:
 * - Remove: enableDailyNotesIntegration, showTextCommands, showDailyNotesCommands
 * - Add: mode ('text' | 'daily-notes')
 *
 * Phase 6 → Phase 7.2 changes:
 * - Remove: mode
 * - Add: lastUsedAction ('insert-text' | 'insert-daily-note' | 'open-daily-note')
 *
 * Migration logic:
 * - If lastUsedAction exists (Phase 7.2) → no migration
 * - If mode exists (Phase 6) → migrate to Phase 7.2
 * - If enableDailyNotesIntegration exists (Phase 5) → migrate directly to Phase 7.2
 *
 * @param settings - Partial settings (may be Phase 5, Phase 6, or Phase 7.2)
 * @returns Migrated settings with old fields removed
 */
export function migrateSettings(
  settings: Partial<DateHelpersSettings>
): Partial<DateHelpersSettings> {
  const phase5 = settings as Phase5Settings;
  const phase6 = settings as Phase6Settings;

  // Check if already migrated to Phase 7.2
  if ('lastUsedAction' in settings && !('mode' in settings)) {
    // Already Phase 7.2, no action needed
    return settings;
  }

  // Create migrated settings
  const migrated: Partial<DateHelpersSettings> = { ...settings };

  // Phase 6 → Phase 7.2 migration
  if ('mode' in phase6 && phase6.mode !== undefined) {
    // Map mode to lastUsedAction
    if (phase6.mode === 'daily-notes') {
      migrated.lastUsedAction = 'insert-daily-note';
    } else if (phase6.mode === 'text') {
      migrated.lastUsedAction = 'insert-text';
    }

    // Remove Phase 6 mode field
    delete (migrated as Phase6Settings).mode;
  }

  // Phase 5 → Phase 7.2 migration (skip Phase 6)
  if ('enableDailyNotesIntegration' in phase5) {
    // Map old setting directly to Phase 7.2
    if (phase5.enableDailyNotesIntegration === true) {
      migrated.lastUsedAction = 'insert-daily-note';
    } else if (phase5.enableDailyNotesIntegration === false) {
      migrated.lastUsedAction = 'insert-text';
    }

    // Remove Phase 5 fields
    delete (migrated as Phase5Settings).enableDailyNotesIntegration;
    delete (migrated as Phase5Settings).showTextCommands;
    delete (migrated as Phase5Settings).showDailyNotesCommands;

    // Also remove mode if it was added during intermediate migration
    delete (migrated as Phase6Settings).mode;
  }

  return migrated;
}
