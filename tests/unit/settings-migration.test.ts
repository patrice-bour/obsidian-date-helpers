import { migrateSettings } from '@/utils/settings-migration';
import { validateSettings } from '@/utils/settings-validator';
import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { FormatPreset } from '@/types/format-preset';

/**
 * The keys removed by `remove-inert-settings`: stored and validated for phases,
 * never read by any code path. `nlpDefaultPresetId` joins them with
 * `fix-nlp-preset-persistence`: the picker now keeps one memory,
 * `defaultDatePresetId`. Listed here rather than imported from the migration so
 * the test pins the names independently of the purge list.
 */
const REMOVED_KEYS = [
  'nlpDefaultPresetId',
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
] as const;

describe('Settings Migration (Phase 5 → Phase 7.2)', () => {
  describe('migrateSettings', () => {
    it('should migrate enableDailyNotesIntegration=true to lastUsedAction=insert-daily-note', () => {
      const phase5Settings = {
        enableDailyNotesIntegration: true,
        showTextCommands: false,
        showDailyNotesCommands: true,
        locale: 'fr-FR',
        weekStart: 1,
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase5Settings);

      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated).not.toHaveProperty('mode');
      expect(migrated).not.toHaveProperty('enableDailyNotesIntegration');
      expect(migrated).not.toHaveProperty('showTextCommands');
      expect(migrated).not.toHaveProperty('showDailyNotesCommands');

      // Ensure other settings are preserved
      expect(migrated.locale).toBe('fr-FR');
      expect(migrated.weekStart).toBe(1);
    });

    it('should migrate enableDailyNotesIntegration=false to lastUsedAction=insert-text', () => {
      const phase5Settings = {
        enableDailyNotesIntegration: false,
        showTextCommands: true,
        showDailyNotesCommands: false,
        locale: 'en-US',
        weekStart: 0,
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase5Settings);

      expect(migrated.lastUsedAction).toBe('insert-text');
      expect(migrated).not.toHaveProperty('mode');
      expect(migrated).not.toHaveProperty('enableDailyNotesIntegration');
      expect(migrated).not.toHaveProperty('showTextCommands');
      expect(migrated).not.toHaveProperty('showDailyNotesCommands');

      // Ensure other settings are preserved
      expect(migrated.locale).toBe('en-US');
      expect(migrated.weekStart).toBe(0);
    });

    it('should migrate Phase 6 mode=daily-notes to lastUsedAction=insert-daily-note', () => {
      const phase6Settings = {
        mode: 'daily-notes',
        locale: 'fr-FR',
        weekStart: 1,
      } as unknown as Partial<DateHelpersSettings>;

      const result = migrateSettings(phase6Settings);

      expect(result.lastUsedAction).toBe('insert-daily-note');
      expect(result).not.toHaveProperty('mode');
      expect(result.locale).toBe('fr-FR');
      expect(result.weekStart).toBe(1);
    });

    it('should migrate Phase 6 mode=text to lastUsedAction=insert-text', () => {
      const phase6Settings = {
        mode: 'text',
        locale: 'en-US',
        weekStart: 0,
      } as unknown as Partial<DateHelpersSettings>;

      const result = migrateSettings(phase6Settings);

      expect(result.lastUsedAction).toBe('insert-text');
      expect(result).not.toHaveProperty('mode');
      expect(result.locale).toBe('en-US');
      expect(result.weekStart).toBe(0);
    });

    it('should strip the deprecated defaultFormat key from legacy data', () => {
      const legacySettings = {
        defaultFormat: 'yyyy-MM-dd',
        locale: 'auto',
        enableDailyNotesIntegration: true,
      } as Partial<DateHelpersSettings>;

      const result = migrateSettings(legacySettings);

      expect(result).not.toHaveProperty('defaultFormat');
      expect(result.lastUsedAction).toBe('insert-daily-note');
    });

    it('should strip defaultFormat even from already-migrated (Phase 7.2) data', () => {
      const phase72Settings = {
        defaultFormat: 'yyyy-MM-dd',
        locale: 'auto',
        lastUsedAction: 'insert-text',
      } as Partial<DateHelpersSettings>;

      const result = migrateSettings(phase72Settings);

      expect(result).not.toHaveProperty('defaultFormat');
      expect(result.lastUsedAction).toBe('insert-text');
    });

    it('should strip removed keys from Phase 5 data too, alongside the phase migration', () => {
      const legacySettings = {
        showParsingWarning: false,
        nlpLanguages: ['en'],
        enableDailyNotesIntegration: true,
        locale: 'auto',
      } as unknown as Partial<DateHelpersSettings>;

      const result = migrateSettings(legacySettings);

      expect(result).not.toHaveProperty('showParsingWarning');
      expect(result).not.toHaveProperty('nlpLanguages');
      expect(result.lastUsedAction).toBe('insert-daily-note');
    });

    it('should not mutate the object it was given', () => {
      // loadSettings keeps reading loadedData after the call (main.ts:352), so a
      // purge that wrote through would strip keys from under the caller.
      const stored = {
        showParsingWarning: true,
        lastUsedAction: 'insert-text',
      } as unknown as Partial<DateHelpersSettings>;

      const result = migrateSettings(stored);

      expect(stored).toHaveProperty('showParsingWarning');
      expect(result).not.toHaveProperty('showParsingWarning');
    });

    it('should keep every key the plugin still reads', () => {
      // The mirror of the purge, and the only thing standing between a typo in
      // REMOVED_KEYS and silent data loss. formatPresets is the dangerous one:
      // purging it makes validateSettings reseed the defaults, so every test
      // stays green while the user loses their custom presets and their
      // showInSuggest pins.
      const stored = {
        ...DEFAULT_SETTINGS,
        lastUsedAction: 'insert-text',
      } as Partial<DateHelpersSettings>;

      const result = migrateSettings(stored);

      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        expect(result).toHaveProperty(key);
      }
    });

    it('should not migrate when neither mode nor Phase 5 settings exist (new user)', () => {
      const incompleteSettings = {
        locale: 'auto',
        weekStart: 1,
      } as Partial<DateHelpersSettings>;

      const result = migrateSettings(incompleteSettings);

      // When neither mode nor enableDailyNotesIntegration exists,
      // assume new user → defaults will be applied later
      expect(result).not.toHaveProperty('mode');
      expect(result.lastUsedAction).toBeUndefined();
    });

    it('should handle edge case: enableDailyNotesIntegration exists but showCommands missing', () => {
      const phase5Settings = {
        enableDailyNotesIntegration: true,
        locale: 'auto',
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase5Settings);

      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated).not.toHaveProperty('mode');
      expect(migrated).not.toHaveProperty('enableDailyNotesIntegration');
      expect(migrated).not.toHaveProperty('showTextCommands');
      expect(migrated).not.toHaveProperty('showDailyNotesCommands');
    });

    it('should preserve all Phase 5 settings during migration to Phase 7.2', () => {
      const phase5Settings = {
        enableDailyNotesIntegration: true,
        showTextCommands: false,
        showDailyNotesCommands: true,
        locale: 'fr-FR',
        weekStart: 1,
        enableNLP: true,
        enableDatePicker: true,
        defaultDatePresetId: 'iso8601',
        dailyNotesAliasPresetId: 'locale-long',
        dailyNotesAliasFallbackPresetId: 'locale-long',
        dailyNotesCreateIfMissing: false,
        nlpAutoDetectLanguage: true,
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase5Settings);

      // Migrated to Phase 7.2
      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated).not.toHaveProperty('mode');

      // All other settings preserved
      expect(migrated.locale).toBe('fr-FR');
      expect(migrated.weekStart).toBe(1);
      expect(migrated.enableNLP).toBe(true);
      expect(migrated.enableDatePicker).toBe(true);
      expect(migrated.defaultDatePresetId).toBe('iso8601');
      expect(migrated.dailyNotesAliasPresetId).toBe('locale-long');
      expect(migrated.dailyNotesCreateIfMissing).toBe(false);
      expect(migrated.nlpAutoDetectLanguage).toBe(true);

      // Phase 5 fields removed
      expect(migrated).not.toHaveProperty('enableDailyNotesIntegration');
      expect(migrated).not.toHaveProperty('showTextCommands');
      expect(migrated).not.toHaveProperty('showDailyNotesCommands');
    });

    it('should handle complex migration scenario with all Phase 5 settings', () => {
      const phase5Settings = {
        enableDailyNotesIntegration: false, // Text mode user
        showTextCommands: true,
        showDailyNotesCommands: false,
        locale: 'en-US',
        weekStart: 0,
        enableNLP: false,
        enableDatePicker: true,
        defaultDatePresetId: 'locale-short',
        defaultTimePresetId: 'time-12h',
        pickerDefaultPresetId: 'locale-short',
        pickerShowFormatSelector: false,
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase5Settings);

      // Migrated to Phase 7.2
      expect(migrated.lastUsedAction).toBe('insert-text');
      expect(migrated).not.toHaveProperty('mode');

      // Text mode settings preserved — except the inert ones, which are purged
      expect(migrated.defaultDatePresetId).toBe('locale-short');
      expect(migrated).not.toHaveProperty('defaultTimePresetId');
      expect(migrated).not.toHaveProperty('pickerDefaultPresetId');
      expect(migrated).not.toHaveProperty('pickerShowFormatSelector');

      // Common settings preserved
      expect(migrated.locale).toBe('en-US');
      expect(migrated.weekStart).toBe(0);
      expect(migrated.enableNLP).toBe(false);
      expect(migrated.enableDatePicker).toBe(true);
    });
  });

  describe('Phase 6 → Phase 7.2 Migration', () => {
    it('should migrate mode=daily-notes to lastUsedAction=insert-daily-note', () => {
      const phase6Settings = {
        mode: 'daily-notes',
        locale: 'fr-FR',
        weekStart: 1,
        defaultDatePresetId: 'iso8601',
        dailyNotesAliasPresetId: 'locale-long',
        dailyNotesAliasFallbackPresetId: 'locale-long',
      } as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase6Settings);

      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated).not.toHaveProperty('mode');

      // Ensure other settings are preserved
      expect(migrated.locale).toBe('fr-FR');
      expect(migrated.weekStart).toBe(1);
      expect(migrated.defaultDatePresetId).toBe('iso8601');
      expect(migrated.dailyNotesAliasPresetId).toBe('locale-long');
    });

    it('should migrate mode=text to lastUsedAction=insert-text', () => {
      const phase6Settings = {
        mode: 'text',
        locale: 'en-US',
        weekStart: 0,
        defaultDatePresetId: 'locale-short',
        dailyNotesCreateIfMissing: true,
      } as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase6Settings);

      expect(migrated.lastUsedAction).toBe('insert-text');
      expect(migrated).not.toHaveProperty('mode');

      // Ensure other settings are preserved
      expect(migrated.locale).toBe('en-US');
      expect(migrated.weekStart).toBe(0);
      expect(migrated.defaultDatePresetId).toBe('locale-short');
      expect(migrated.dailyNotesCreateIfMissing).toBe(true);
    });

    it('should not migrate Phase 7.2 settings (already migrated)', () => {
      const phase7_2Settings = {
        lastUsedAction: 'insert-daily-note',
        defaultDatePresetId: 'iso8601',
        dailyNotesAliasPresetId: 'locale-long',
        dailyNotesAliasFallbackPresetId: 'locale-long',
        locale: 'fr-FR',
        weekStart: 1,
      } as Partial<DateHelpersSettings>;

      const result = migrateSettings(phase7_2Settings);

      expect(result.lastUsedAction).toBe('insert-daily-note');
      expect(result.defaultDatePresetId).toBe('iso8601');
      expect(result.dailyNotesAliasPresetId).toBe('locale-long');
      expect(result).not.toHaveProperty('mode');
      // Should not have modified settings
      expect(result).toEqual(phase7_2Settings);
    });

    it('should handle Phase 5 → Phase 7.2 double migration', () => {
      // User upgrading directly from Phase 5 to Phase 7.2
      const phase5Settings = {
        enableDailyNotesIntegration: true,
        showTextCommands: false,
        showDailyNotesCommands: true,
        locale: 'auto',
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase5Settings);

      // Should skip Phase 6 and go directly to Phase 7.2
      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated).not.toHaveProperty('mode');
      expect(migrated).not.toHaveProperty('enableDailyNotesIntegration');
      expect(migrated).not.toHaveProperty('showTextCommands');
      expect(migrated).not.toHaveProperty('showDailyNotesCommands');
    });

    it('should handle empty settings (new user)', () => {
      const emptySettings = {} as Partial<DateHelpersSettings>;

      const result = migrateSettings(emptySettings);

      // Should not add any migration fields for new users
      expect(result).not.toHaveProperty('mode');
      expect(result.lastUsedAction).toBeUndefined();
    });

    it('should preserve all settings during Phase 6 → 7.2 migration', () => {
      const phase6Settings = {
        mode: 'daily-notes',
        locale: 'fr-FR',
        weekStart: 1,
        triggerCharacters: ['@@'],
        enableNLP: true,
        nlpLanguages: ['en', 'fr'],
        nlpStrictMode: false,
        nlpDefaultPresetId: 'iso8601',
        showParsingWarning: false,
        nlpWithDatePicker: false,
        enableDatePicker: true,
        defaultDatePresetId: 'iso8601',
        defaultTimePresetId: 'time-24h',
        defaultDateTimePresetId: 'datetime-standard',
        pickerDefaultPresetId: 'iso8601',
        pickerShowFormatSelector: true,
        nlpAutoDetectLanguage: true,
        nlpUseDateTimePreset: true,
        dailyNotesAliasPresetId: 'locale-long',
        dailyNotesAliasFallbackPresetId: 'locale-long',
        dailyNotesCreateIfMissing: false,
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase6Settings);

      // Mode migrated to lastUsedAction
      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated).not.toHaveProperty('mode');

      // The settings with a reader are preserved
      expect(migrated.locale).toBe('fr-FR');
      expect(migrated.weekStart).toBe(1);
      // Converted in passing: two characters meant the picker
      expect(migrated.triggerCharacters).toEqual([{ sequence: '@@', mode: 'picker' }]);
      expect(migrated.enableNLP).toBe(true);
      expect(migrated.nlpStrictMode).toBe(false);
      expect(migrated.enableDatePicker).toBe(true);
      expect(migrated.defaultDatePresetId).toBe('iso8601');
      expect(migrated.nlpAutoDetectLanguage).toBe(true);
      expect(migrated.dailyNotesAliasPresetId).toBe('locale-long');
      expect(migrated.dailyNotesCreateIfMissing).toBe(false);

      // The inert ones are purged by the same pass
      for (const key of REMOVED_KEYS) {
        expect(migrated).not.toHaveProperty(key);
      }
    });
  });

  describe('legacy nlpFallbackBehavior key', () => {
    it('should purge nlpFallbackBehavior without resurrecting a parsing-warning setting', () => {
      const oldSettings = {
        nlpFallbackBehavior: 'error',
        lastUsedAction: 'insert-text',
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(oldSettings);

      expect(migrated).not.toHaveProperty('nlpFallbackBehavior');
      expect(migrated).not.toHaveProperty('showParsingWarning');
    });
  });

  describe('the load path a user actually goes through', () => {
    it('should leave no removed key in the settings that get re-persisted', () => {
      // What loadSettings does: migrate, then validate, then save the result.
      const storedData = {
        nlpDefaultPresetId: 'iso8601',
        nlpFallbackBehavior: 'error',
        showParsingWarning: true,
        defaultTimePresetId: 'time-12h',
        defaultDateTimePresetId: 'datetime-iso',
        nlpLanguages: ['en', 'fr'],
        nlpWithDatePicker: true,
        pickerDefaultPresetId: 'locale-long',
        pickerShowFormatSelector: false,
        nlpUseDateTimePreset: false,
        nlpDefaultDateTimePresetId: 'datetime-standard',
        defaultFormat: 'yyyy-MM-dd',
        locale: 'fr-FR',
        defaultDatePresetId: 'locale-long',
        lastUsedAction: 'insert-daily-note',
      } as unknown as Partial<DateHelpersSettings>;

      const persisted = validateSettings(migrateSettings(storedData));

      for (const key of REMOVED_KEYS) {
        expect(persisted).not.toHaveProperty(key);
      }
      expect(persisted).not.toHaveProperty('defaultFormat');
      expect(persisted.locale).toBe('fr-FR');
      expect(persisted.defaultDatePresetId).toBe('locale-long');
      expect(persisted.lastUsedAction).toBe('insert-daily-note');
    });
  });

  describe('original-text to selected-text alias source migration', () => {
    it('should rewrite a stored dailyNotesAliasPresetId of "original-text" to "selected-text"', () => {
      const stored = {
        lastUsedAction: 'insert-daily-note',
        dailyNotesAliasPresetId: 'original-text',
        dailyNotesAliasFallbackPresetId: 'locale-long',
        locale: 'fr-FR',
        weekStart: 1,
        triggerCharacters: ['@@'],
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(stored);

      expect(migrated.dailyNotesAliasPresetId).toBe('selected-text');

      // Every other stored value is preserved
      expect(migrated.dailyNotesAliasFallbackPresetId).toBe('locale-long');
      expect(migrated.lastUsedAction).toBe('insert-daily-note');
      expect(migrated.locale).toBe('fr-FR');
      expect(migrated.weekStart).toBe(1);
      expect(migrated.triggerCharacters).toEqual([{ sequence: '@@', mode: 'picker' }]);
    });

    it('should leave any other stored alias preset id untouched', () => {
      const stored = {
        lastUsedAction: 'insert-daily-note',
        dailyNotesAliasPresetId: 'iso8601',
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).dailyNotesAliasPresetId).toBe('iso8601');
    });

    it('should migrate "original-text" even on settings that need no other migration', () => {
      // The Phase 7.2 early return must not skip this migration
      const stored = {
        lastUsedAction: 'insert-text',
        dailyNotesAliasPresetId: 'original-text',
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).dailyNotesAliasPresetId).toBe('selected-text');
    });

    it('should survive validation: "selected-text" and "typed-text" are valid alias sources', () => {
      const selected = validateSettings({
        dailyNotesAliasPresetId: 'selected-text',
      } as Partial<DateHelpersSettings>);
      expect(selected.dailyNotesAliasPresetId).toBe('selected-text');

      const typed = validateSettings({
        dailyNotesAliasPresetId: 'typed-text',
      } as Partial<DateHelpersSettings>);
      expect(typed.dailyNotesAliasPresetId).toBe('typed-text');
    });

    it('should reject an alias source in the fallback setting', () => {
      const validated = validateSettings({
        dailyNotesAliasPresetId: 'selected-text',
        dailyNotesAliasFallbackPresetId: 'selected-text',
      } as Partial<DateHelpersSettings>);

      expect(validated.dailyNotesAliasFallbackPresetId).toBe(
        DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId
      );
    });

    it('should pin the default popup presets on a data.json that predates the flag', () => {
      // 0.1.6 stored the eleven presets without `showInSuggest`. Left alone, the
      // inline popup would open with nothing but its two fixed entries — for
      // every installed user, while a fresh install got two pinned formats.
      const storedPresets = DEFAULT_SETTINGS.formatPresets.map(preset => {
        const { showInSuggest: _dropped, ...withoutFlag } = preset;
        return withoutFlag;
      });

      const validated = validateSettings({
        formatPresets: storedPresets,
      } as Partial<DateHelpersSettings>);

      const pinned = validated.formatPresets.filter(p => p.showInSuggest).map(p => p.id);
      expect(pinned).toEqual(['iso8601', 'locale-long']);
    });

    it('should leave an explicit choice alone, including "nothing pinned"', () => {
      // Unpinning everything is a decision; re-applying the defaults over it
      // would undo the user's choice on every load.
      const storedPresets = DEFAULT_SETTINGS.formatPresets.map(preset => ({
        ...preset,
        showInSuggest: preset.id === 'date-verbose',
      }));

      const validated = validateSettings({
        formatPresets: storedPresets,
      } as Partial<DateHelpersSettings>);

      expect(validated.formatPresets.filter(p => p.showInSuggest).map(p => p.id)).toEqual([
        'date-verbose',
      ]);
    });

    it('should keep the pinning choice when a builtin preset gets a new format', () => {
      // The format is ours to correct; whether the preset shows in the popup is
      // the user's to keep.
      const storedPresets = DEFAULT_SETTINGS.formatPresets.map(preset =>
        preset.id === 'iso8601'
          ? { ...preset, format: 'yyyy/MM/dd', showInSuggest: false }
          : { ...preset }
      );

      const validated = validateSettings({
        formatPresets: storedPresets,
      } as Partial<DateHelpersSettings>);

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.format).toBe('yyyy-MM-dd'); // updated
      expect(iso?.showInSuggest).toBe(false); // the user's call, preserved
    });

    it('should default a fresh install to "selected-text"', () => {
      expect(DEFAULT_SETTINGS.dailyNotesAliasPresetId).toBe('selected-text');
      expect(DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId).toBe('locale-long');
    });
  });

  describe('a shipped format correction meets a stored preset', () => {
    /**
     * The plugin owns exactly one field on a preset it ships: the format
     * string. Everything else in `data.json` is data the plugin did not write.
     *
     * Until this change the diverged-format branch replaced the stored entry
     * wholesale, so `type` and `builtin` were realigned on the shipped values —
     * or left alone — depending on whether the format had diverged, a criterion
     * unrelated to either. `stripBuiltinLabels`, which knows that a preset
     * marked `builtin: false` keeps its labels, was never consulted there.
     */
    const storedWithIso = (overrides: Partial<FormatPreset>): Partial<DateHelpersSettings> =>
      ({
        formatPresets: DEFAULT_SETTINGS.formatPresets.map(preset =>
          preset.id === 'iso8601'
            ? { ...preset, format: 'yyyy/MM/dd', ...overrides }
            : { ...preset }
        ),
      }) as Partial<DateHelpersSettings>;

    it('should keep a stored type when the format is corrected', () => {
      const validated = validateSettings(storedWithIso({ type: 'datetime' }));

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.format).toBe('yyyy-MM-dd');
      expect(iso?.type).toBe('datetime');
    });

    it('should keep a stored builtin flag when the format is corrected', () => {
      const validated = validateSettings(storedWithIso({ builtin: false }));

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.format).toBe('yyyy-MM-dd');
      expect(iso?.builtin).toBe(false);
    });

    it('should restore a builtin flag the stored entry never carried', () => {
      // Phase 1 does not require `builtin`, the type does, and the validated
      // settings are saved straight back to data.json — so dropping the field
      // would persist an entry that cannot be read as a FormatPreset.
      const iso8601 = DEFAULT_SETTINGS.formatPresets.find(p => p.id === 'iso8601')!;
      const { builtin: _absent, ...withoutFlag } = iso8601;
      const validated = validateSettings({
        formatPresets: [{ ...withoutFlag, format: 'yyyy/MM/dd' } as FormatPreset],
      } as Partial<DateHelpersSettings>);

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.format).toBe('yyyy-MM-dd');
      expect(iso?.builtin).toBe(true);
    });

    it('should replace a builtin flag that is not a boolean', () => {
      // `data.json` is user-editable text: `"true"` and `0` are as reachable
      // as an absent field, and `0` is falsy everywhere while failing the
      // `=== false` test that decides whether labels are the user's own.
      const validated = validateSettings(
        storedWithIso({ builtin: 0 as unknown as boolean, name: 'Mon ISO' })
      );

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.builtin).toBe(true);
      expect(iso?.name).toBeUndefined();
    });

    it('should keep all three entries when three presets share one id', () => {
      // The de-duplicator used to name the replacement `${id}-${Date.now()}`.
      // The loop is synchronous over an array in memory, so three entries
      // sharing an id land in the same millisecond and produce the same new id
      // twice; the Map keyed by id then kept only the last, and B was gone from
      // `data.json` on the next save.
      //
      // The clock is pinned here on purpose: the outcome must not depend on it.
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_755_000_000_000);
      try {
        const mine = (name: string): FormatPreset => ({
          id: 'm',
          name,
          format: 'dd/MM',
          type: 'date',
          builtin: false,
        });

        const validated = validateSettings({
          formatPresets: [...DEFAULT_SETTINGS.formatPresets, mine('A'), mine('B'), mine('C')],
        } as Partial<DateHelpersSettings>);

        const theirs = validated.formatPresets.filter(p => p.id.startsWith('m'));
        expect(theirs.map(p => p.name)).toEqual(['A', 'B', 'C']);
      } finally {
        now.mockRestore();
      }
    });

    it('should not take an id a later preset already owns', () => {
      // A repair reads `seenIds`, which only knows what the loop has passed.
      // Naming the duplicate `m-1` when the array holds a real `m-1` further
      // down does not lose an entry — but it moves one: a stored
      // `defaultDatePresetId` of `m-1` would then resolve to the duplicate
      // instead of the preset the user pointed it at, and the id check finds
      // nothing to warn about.
      const mine = (id: string, name: string): FormatPreset => ({
        id,
        name,
        format: 'dd/MM',
        type: 'date',
        builtin: false,
      });

      const validated = validateSettings({
        formatPresets: [mine('m', 'A'), mine('m', 'B'), mine('m-1', 'C')],
        defaultDatePresetId: 'm-1',
      } as Partial<DateHelpersSettings>);

      const byId = new Map(validated.formatPresets.map(preset => [preset.id, preset.name]));
      expect(byId.get('m-1')).toBe('C');
      expect(validated.defaultDatePresetId).toBe('m-1');
    });

    it('should leave the order of the preset list alone', () => {
      // The order is read: the settings sections render the array as it comes,
      // and the picker's list is a filter over it.
      const mine: FormatPreset = {
        id: 'mon-format',
        format: 'dd/MM',
        type: 'date',
        builtin: false,
      };
      const validated = validateSettings({
        formatPresets: [mine, ...DEFAULT_SETTINGS.formatPresets],
      } as Partial<DateHelpersSettings>);

      expect(validated.formatPresets.map(p => p.id)).toEqual([
        ...DEFAULT_SETTINGS.formatPresets.map(p => p.id),
        'mon-format',
      ]);
    });

    it('should keep the labels of a preset the user marked as their own', () => {
      const validated = validateSettings(
        storedWithIso({ builtin: false, name: 'Mon ISO', description: 'À moi' })
      );

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.format).toBe('yyyy-MM-dd');
      expect(iso?.name).toBe('Mon ISO');
      expect(iso?.description).toBe('À moi');
    });

    it('should strip the labels of a built-in whose format is corrected', () => {
      // The same rule as the matching-format path: a built-in reads from its
      // id through i18n, so a stored English label must not outlive the load.
      const validated = validateSettings(storedWithIso({ name: 'ISO 8601', description: 'Old' }));

      const iso = validated.formatPresets.find(p => p.id === 'iso8601');
      expect(iso?.format).toBe('yyyy-MM-dd');
      expect(iso?.name).toBeUndefined();
      expect(iso?.description).toBeUndefined();
    });
  });

  describe('a reset to the shipped presets hands out copies', () => {
    // The trigger list learned this rule first: `copyTriggers` exists because a
    // shared reference lets a legitimate edit rewrite the module's defaults, so
    // the next reset restores the user's last edit as what the plugin ships.
    // The preset reset never got the same treatment.

    it('should share no object with the shipped presets', () => {
      const validated = validateSettings({
        formatPresets: 'not an array' as unknown as FormatPreset[],
      } as Partial<DateHelpersSettings>);

      const shared = validated.formatPresets.filter(preset =>
        DEFAULT_FORMAT_PRESETS.some(shipped => shipped === preset)
      );
      expect(shared).toEqual([]);
      expect(validated.formatPresets).toHaveLength(DEFAULT_FORMAT_PRESETS.length);
    });

    it('should leave the shipped presets untouched when a reset preset is edited', () => {
      // This is the reachable failure: the settings tab writes
      // `stored.showInSuggest = value` in place on the object the reset handed
      // it (`presets-list-section.ts`).
      const validated = validateSettings({
        formatPresets: [],
      } as Partial<DateHelpersSettings>);

      const shipped = DEFAULT_FORMAT_PRESETS[0];
      const before = shipped.showInSuggest;
      const edited = validated.formatPresets.find(preset => preset.id === shipped.id);
      expect(edited).toBeDefined();

      try {
        edited!.showInSuggest = !before;
        expect(shipped.showInSuggest).toBe(before);
      } finally {
        shipped.showInSuggest = before;
      }
    });
  });

  describe('trigger characters gain a mode', () => {
    it('should convert stored strings by the rule the code used until now', () => {
      // One character opened the inline popup, two or more opened the picker.
      // Migrating by that rule is what keeps every existing user's behaviour.
      const stored = {
        lastUsedAction: 'insert-text',
        triggerCharacters: ['@@', '@'],
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).triggerCharacters).toEqual([
        { sequence: '@@', mode: 'picker' },
        { sequence: '@', mode: 'inline' },
      ]);
    });

    it('should convert a three-character trigger to picker mode', () => {
      const stored = {
        lastUsedAction: 'insert-text',
        triggerCharacters: ['//d'],
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).triggerCharacters).toEqual([
        { sequence: '//d', mode: 'picker' },
      ]);
    });

    it('should migrate even on settings that need no other migration', () => {
      // The Phase 7.2 early return must not skip this conversion
      const stored = {
        lastUsedAction: 'insert-daily-note',
        triggerCharacters: ['@'],
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).triggerCharacters).toEqual([
        { sequence: '@', mode: 'inline' },
      ]);
    });

    it('should leave an already-migrated list alone', () => {
      const stored = {
        lastUsedAction: 'insert-text',
        triggerCharacters: [
          { sequence: '@@', mode: 'inline' },
          { sequence: '@', mode: 'picker' },
        ],
      } as unknown as Partial<DateHelpersSettings>;

      // The modes are the reverse of what the length rule would produce: this
      // fails the moment the migration re-derives instead of passing through.
      expect(migrateSettings(stored).triggerCharacters).toEqual([
        { sequence: '@@', mode: 'inline' },
        { sequence: '@', mode: 'picker' },
      ]);
    });

    it('should convert the strings of a mixed list and keep the objects', () => {
      const stored = {
        lastUsedAction: 'insert-text',
        triggerCharacters: [{ sequence: '@@', mode: 'inline' }, '//d'],
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).triggerCharacters).toEqual([
        { sequence: '@@', mode: 'inline' },
        { sequence: '//d', mode: 'picker' },
      ]);
    });

    it('should not write to the object it was handed', () => {
      // main.ts keeps reading the object it passed in
      const stored = {
        lastUsedAction: 'insert-text',
        triggerCharacters: ['@@'],
      } as unknown as Partial<DateHelpersSettings>;

      migrateSettings(stored);

      expect(stored.triggerCharacters).toEqual(['@@']);
    });

    it('should leave a non-array alone for the validator to reset', () => {
      const stored = {
        lastUsedAction: 'insert-text',
        triggerCharacters: '@@',
      } as unknown as Partial<DateHelpersSettings>;

      expect(migrateSettings(stored).triggerCharacters).toBe('@@');
    });
  });

  describe('trigger characters: validation drops an entry, never the list', () => {
    it('should keep the valid entries of a list holding a malformed one', () => {
      const validated = validateSettings({
        triggerCharacters: [
          { sequence: '@@', mode: 'picker' },
          { sequence: '', mode: 'inline' }, // empty sequence
          { sequence: '//d', mode: 'sideways' }, // unknown mode
          { mode: 'inline' }, // no sequence
          42,
          { sequence: '@', mode: 'inline' },
        ],
      } as unknown as Partial<DateHelpersSettings>);

      expect(validated.triggerCharacters).toEqual([
        { sequence: '@@', mode: 'picker' },
        { sequence: '@', mode: 'inline' },
      ]);
    });

    it('should reset to defaults when nothing valid survives', () => {
      // An empty list survives validation and silently disables the picker for
      // good — registerTriggerCharacters returns early on it.
      const validated = validateSettings({
        triggerCharacters: [{ sequence: '', mode: 'inline' }, 42],
      } as unknown as Partial<DateHelpersSettings>);

      expect(validated.triggerCharacters).toEqual(DEFAULT_SETTINGS.triggerCharacters);
    });

    it('should keep only the first of two entries sharing a sequence', () => {
      // `setTriggerMode` and `removeTrigger` resolve by sequence, so a second
      // row carrying the same one edits the first entry: its mode dropdown
      // would change a different row, in front of the user.
      const validated = validateSettings({
        triggerCharacters: [
          { sequence: '@', mode: 'inline' },
          { sequence: '@', mode: 'picker' },
          { sequence: '@@', mode: 'picker' },
        ],
      } as unknown as Partial<DateHelpersSettings>);

      expect(validated.triggerCharacters).toEqual([
        { sequence: '@', mode: 'inline' },
        { sequence: '@@', mode: 'picker' },
      ]);
    });

    it('should deduplicate what the migration produced from duplicate strings', () => {
      const migrated = migrateSettings({
        lastUsedAction: 'insert-text',
        triggerCharacters: ['@', '@'],
      } as unknown as Partial<DateHelpersSettings>);

      expect(validateSettings(migrated).triggerCharacters).toEqual([
        { sequence: '@', mode: 'inline' },
      ]);
    });

    it('should leave a list the user emptied empty', () => {
      // Nothing was dropped, so nothing is being repaired: emptying the list is
      // a way to turn the triggers off, and refilling it would undo the user.
      const validated = validateSettings({
        triggerCharacters: [],
      } as unknown as Partial<DateHelpersSettings>);

      expect(validated.triggerCharacters).toEqual([]);
    });

    it('should reset a non-array to defaults, as it always did', () => {
      const validated = validateSettings({
        triggerCharacters: '@@',
      } as unknown as Partial<DateHelpersSettings>);

      expect(validated.triggerCharacters).toEqual(DEFAULT_SETTINGS.triggerCharacters);
    });

    it('should default a fresh install to a picker `@@` and an inline `@`', () => {
      expect(DEFAULT_SETTINGS.triggerCharacters).toEqual([
        { sequence: '@@', mode: 'picker' },
        { sequence: '@', mode: 'inline' },
      ]);
    });

    it('should hand out its own trigger objects, never the defaults themselves', () => {
      // A trigger's mode is edited in place (`settings-tab.ts`, `setTriggerMode`).
      // Sharing the default objects would make that edit rewrite DEFAULT_SETTINGS
      // for the rest of the session, and the next reset would then restore the
      // user's last mode as if it were what the plugin ships.
      const fresh = validateSettings({});
      const reset = validateSettings({
        triggerCharacters: '@@',
      } as unknown as Partial<DateHelpersSettings>);
      // The third reset path: a stored list where nothing survives validation.
      const salvaged = validateSettings({
        triggerCharacters: [{ sequence: '@@' }],
      } as unknown as Partial<DateHelpersSettings>);

      for (const validated of [fresh, reset, salvaged]) {
        expect(validated.triggerCharacters).not.toBe(DEFAULT_SETTINGS.triggerCharacters);
        validated.triggerCharacters.forEach((trigger, index) => {
          expect(trigger).not.toBe(DEFAULT_SETTINGS.triggerCharacters[index]);
        });
      }
    });

    it('should survive a mode edit without rewriting the defaults', () => {
      const validated = validateSettings({});

      validated.triggerCharacters[0].mode = 'inline';

      expect(DEFAULT_SETTINGS.triggerCharacters[0]).toEqual({ sequence: '@@', mode: 'picker' });
    });

    it('should survive an added trigger without growing the defaults', () => {
      const before = DEFAULT_SETTINGS.triggerCharacters.length;
      const validated = validateSettings({
        triggerCharacters: '@@',
      } as unknown as Partial<DateHelpersSettings>);

      validated.triggerCharacters.push({ sequence: ';;', mode: 'inline' });

      expect(DEFAULT_SETTINGS.triggerCharacters).toHaveLength(before);
    });
  });
});
