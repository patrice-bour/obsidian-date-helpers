import { migrateSettings } from '@/utils/settings-migration';
import { validateSettings } from '@/utils/settings-validator';
import { DateHelpersSettings } from '@/types/settings';

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

      // Text mode settings preserved
      expect(migrated.defaultDatePresetId).toBe('locale-short');
      expect(migrated.defaultTimePresetId).toBe('time-12h');
      expect(migrated.pickerDefaultPresetId).toBe('locale-short');
      expect(migrated.pickerShowFormatSelector).toBe(false);

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
        pickerShowFormatSelector: true,
      } as Partial<DateHelpersSettings>;

      const migrated = migrateSettings(phase6Settings);

      expect(migrated.lastUsedAction).toBe('insert-text');
      expect(migrated).not.toHaveProperty('mode');

      // Ensure other settings are preserved
      expect(migrated.locale).toBe('en-US');
      expect(migrated.weekStart).toBe(0);
      expect(migrated.defaultDatePresetId).toBe('locale-short');
      expect(migrated.pickerShowFormatSelector).toBe(true);
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

      // All other settings preserved
      expect(migrated.locale).toBe('fr-FR');
      expect(migrated.weekStart).toBe(1);
      expect(migrated.triggerCharacters).toEqual(['@@']);
      expect(migrated.enableNLP).toBe(true);
      expect(migrated.nlpLanguages).toEqual(['en', 'fr']);
      expect(migrated.nlpStrictMode).toBe(false);
      expect(migrated.nlpDefaultPresetId).toBe('iso8601');
      expect(migrated.showParsingWarning).toBe(false);
      expect(migrated.nlpWithDatePicker).toBe(false);
      expect(migrated.enableDatePicker).toBe(true);
      expect(migrated.defaultDatePresetId).toBe('iso8601');
      expect(migrated.defaultTimePresetId).toBe('time-24h');
      expect(migrated.defaultDateTimePresetId).toBe('datetime-standard');
      expect(migrated.pickerDefaultPresetId).toBe('iso8601');
      expect(migrated.pickerShowFormatSelector).toBe(true);
      expect(migrated.nlpAutoDetectLanguage).toBe(true);
      expect(migrated.nlpUseDateTimePreset).toBe(true);
      expect(migrated.dailyNotesAliasPresetId).toBe('locale-long');
      expect(migrated.dailyNotesCreateIfMissing).toBe(false);
    });
  });

  describe('nlpFallbackBehavior to showParsingWarning migration', () => {
    it('should migrate nlpFallbackBehavior: "error" to showParsingWarning: true', () => {
      const oldSettings = {
        nlpFallbackBehavior: 'error',
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = validateSettings(oldSettings);

      expect(migrated.showParsingWarning).toBe(true);
      expect(migrated).not.toHaveProperty('nlpFallbackBehavior');
    });

    it('should migrate nlpFallbackBehavior: "preserve" to showParsingWarning: false', () => {
      const oldSettings = {
        nlpFallbackBehavior: 'preserve',
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = validateSettings(oldSettings);

      expect(migrated.showParsingWarning).toBe(false);
      expect(migrated).not.toHaveProperty('nlpFallbackBehavior');
    });

    it('should migrate nlpFallbackBehavior: "iso" to showParsingWarning: false', () => {
      const oldSettings = {
        nlpFallbackBehavior: 'iso',
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = validateSettings(oldSettings);

      expect(migrated.showParsingWarning).toBe(false);
      expect(migrated).not.toHaveProperty('nlpFallbackBehavior');
    });

    it('should not modify settings if showParsingWarning already exists', () => {
      const settings = {
        showParsingWarning: true,
      } as unknown as Partial<DateHelpersSettings>;

      const migrated = validateSettings(settings);

      expect(migrated.showParsingWarning).toBe(true);
    });
  });
});
