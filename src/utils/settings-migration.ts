import { DateHelpersSettings, TriggerConfig, TriggerMode } from '@/types/settings';
import { LEGACY_TEXT_SOURCE, SELECTED_TEXT_SOURCE } from '@/types/alias-source';

/**
 * Keys the plugin no longer keeps. Most were stored, validated and sometimes
 * displayed, but no code path ever read them: each described an architecture
 * the plugin no longer has (a category-wide default format for commands that
 * each carry their own preset, a configurable NLP language list for hardcoded
 * chrono instances, a parsing warning for notices that no longer exist).
 * `nlpDefaultPresetId` is the exception: it had a reader and no writer.
 * Purged from stored data so none of them linger in data.json forever.
 */
const REMOVED_KEYS = [
  'defaultFormat',
  'nlpFallbackBehavior',
  'showParsingWarning',
  'defaultTimePresetId',
  'defaultDateTimePresetId',
  'nlpLanguages',
  'nlpWithDatePicker',
  'pickerDefaultPresetId',
  'pickerShowFormatSelector',
  'nlpUseDateTimePreset',
  'nlpDefaultDateTimePresetId',
  'nlpDefaultPresetId',
] as const;

/**
 * Give a stored trigger string the mode the code used to derive from it.
 *
 * One character opened the inline popup, two or more opened the picker. Any
 * other choice would change behaviour on upgrade for triggers the user set up
 * long ago — the one thing this migration must not do. Entries that are already
 * objects pass through untouched, modes included, so a user who has since
 * reassigned a mode does not get it re-derived away on the next load.
 */
function migrateTriggers(stored: unknown): unknown {
  if (!Array.isArray(stored)) return stored; // the validator resets it

  return stored.map((entry: unknown) => {
    if (typeof entry !== 'string') return entry;

    const mode: TriggerMode = entry.length > 1 ? 'picker' : 'inline';
    return { sequence: entry, mode };
  });
}

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
  // Purge every key the plugin no longer reads (see REMOVED_KEYS). Runs before
  // the Phase 7.2 early return so already-migrated data is cleaned too;
  // loadSettings re-saves after validation, so users' data.json self-cleans on
  // next load. The copy is unconditional: the caller keeps reading the object it
  // passed in (main.ts:352), so this function must never write to it.
  settings = { ...settings };
  for (const key of REMOVED_KEYS) {
    delete (settings as Record<string, unknown>)[key];
  }

  // 'original-text' no longer names a single source: the selection and the NLP
  // field are two options now. The selection is the closer match — it is what
  // the option produced for a user who had selected text. Runs before the
  // Phase 7.2 early return so already-migrated data is rewritten too.
  if (settings.dailyNotesAliasPresetId === LEGACY_TEXT_SOURCE) {
    settings = { ...settings, dailyNotesAliasPresetId: SELECTED_TEXT_SOURCE };
  }

  // A trigger carries its mode now. Runs before the Phase 7.2 early return for
  // the same reason as the alias source: already-migrated data still stores the
  // old `string[]`.
  if ('triggerCharacters' in settings) {
    settings = {
      ...settings,
      triggerCharacters: migrateTriggers(settings.triggerCharacters) as TriggerConfig[],
    };
  }

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
