import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { validateSettings } from '@/utils/settings-validator';
import { FormatPreset } from '@/types/format-preset';

describe('Settings', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SETTINGS.locale).toBe('auto');
      expect(DEFAULT_SETTINGS.weekStart).toBe(1);
      expect(DEFAULT_SETTINGS.triggerCharacters).toEqual([
        { sequence: '@@', mode: 'picker' },
        { sequence: '@', mode: 'inline' },
      ]);
      expect(DEFAULT_SETTINGS.enableNLP).toBe(true);
      expect(DEFAULT_SETTINGS.selectionNamesDate).toBe(true);
      expect(DEFAULT_SETTINGS.enableDatePicker).toBe(true);
    });

    it('should have valid weekStart value', () => {
      expect([0, 1, 6]).toContain(DEFAULT_SETTINGS.weekStart);
    });

    it('should have format presets defined', () => {
      expect(Array.isArray(DEFAULT_SETTINGS.formatPresets)).toBe(true);
      expect(DEFAULT_SETTINGS.formatPresets.length).toBeGreaterThan(0);
    });

    it('should have a default date preset ID, and no other category default', () => {
      expect(DEFAULT_SETTINGS.defaultDatePresetId).toBe('iso8601');
      expect(DEFAULT_SETTINGS).not.toHaveProperty('defaultTimePresetId');
      expect(DEFAULT_SETTINGS).not.toHaveProperty('defaultDateTimePresetId');
    });

    it('should have unique preset IDs', () => {
      const ids = DEFAULT_SETTINGS.formatPresets.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid preset structures', () => {
      DEFAULT_SETTINGS.formatPresets.forEach(preset => {
        expect(preset.id).toBeTruthy();
        expect(preset.format).toBeTruthy();
        expect(['date', 'time', 'datetime']).toContain(preset.type);
        expect(typeof preset.builtin).toBe('boolean');
      });
    });

    it('should carry no label on built-in presets', () => {
      DEFAULT_SETTINGS.formatPresets.forEach(preset => {
        expect(preset.name).toBeUndefined();
        expect(preset.description).toBeUndefined();
      });
    });
  });

  describe('validateSettings', () => {
    it('should return valid settings unchanged', () => {
      const settings: DateHelpersSettings = { ...DEFAULT_SETTINGS };
      const validated = validateSettings(settings);
      expect(validated).toEqual(settings);
    });

    it('should apply defaults for missing fields', () => {
      const partial: Partial<DateHelpersSettings> = {
        locale: 'fr-FR',
      };
      const validated = validateSettings(partial);
      expect(validated.locale).toBe('fr-FR');
      expect(validated.weekStart).toBe(1);
    });

    it('should validate weekStart values', () => {
      const invalidWeekStart: any = {
        ...DEFAULT_SETTINGS,
        weekStart: 3, // Invalid
      };
      const validated = validateSettings(invalidWeekStart);
      expect(validated.weekStart).toBe(1); // Should reset to default
    });

    it('should validate triggerCharacters is an array', () => {
      const invalidTrigger: any = {
        ...DEFAULT_SETTINGS,
        triggerCharacters: '@@', // Not an array
      };
      const validated = validateSettings(invalidTrigger);
      expect(Array.isArray(validated.triggerCharacters)).toBe(true);
      expect(validated.triggerCharacters).toEqual([
        { sequence: '@@', mode: 'picker' },
        { sequence: '@', mode: 'inline' },
      ]);
    });

    it('should validate boolean fields', () => {
      const invalidBoolean: any = {
        ...DEFAULT_SETTINGS,
        enableNLP: 'yes', // Not a boolean
      };
      const validated = validateSettings(invalidBoolean);
      expect(typeof validated.enableNLP).toBe('boolean');
      expect(validated.enableNLP).toBe(true);
    });

    it('should handle completely empty settings', () => {
      const validated = validateSettings({});
      expect(validated).toEqual(DEFAULT_SETTINGS);
    });

    it('should preserve valid custom values', () => {
      const custom: DateHelpersSettings = {
        locale: 'de-DE',
        weekStart: 0,
        triggerCharacters: [
          { sequence: '##', mode: 'picker' },
          { sequence: '@@', mode: 'picker' },
        ],
        enableNLP: false,
        nlpStrictMode: true,
        enableDatePicker: false,
        formatPresets: DEFAULT_SETTINGS.formatPresets,
        defaultDatePresetId: 'iso8601',
        nlpAutoDetectLanguage: false,
        // Non-défaut à dessein : ce test dit que le validateur PRÉSERVE, donc
        // une valeur égale au défaut ne distinguerait pas « préservée » de
        // « remise au défaut ».
        selectionNamesDate: false,
        // Phase 7.2
        lastUsedAction: 'insert-daily-note',
        dailyNotesAliasPresetId: 'locale-long',
        dailyNotesAliasFallbackPresetId: 'locale-long',
        dailyNotesCreateIfMissing: false,
      };
      const validated = validateSettings(custom);
      expect(validated).toEqual(custom);
    });

    it('should normalize locale with underscores', () => {
      const settings: Partial<DateHelpersSettings> = {
        locale: 'en_US',
      };
      const validated = validateSettings(settings);
      expect(validated.locale).toBe('en-US');
    });

    it('should reject completely invalid locale formats', () => {
      const settings: Partial<DateHelpersSettings> = {
        locale: '!!!invalid!!!',
      };
      const validated = validateSettings(settings);
      expect(validated.locale).toBe('auto'); // Reset to default
    });

    it('should allow "auto" locale without validation', () => {
      const settings: Partial<DateHelpersSettings> = {
        locale: 'auto',
      };
      const validated = validateSettings(settings);
      expect(validated.locale).toBe('auto');
    });

    it('should accept locales that Luxon supports', () => {
      // Luxon is permissive and accepts many formats
      // Our validation now uses Luxon, so we accept what Luxon accepts
      const settings1: Partial<DateHelpersSettings> = {
        locale: 'EN-US',
      };
      const validated1 = validateSettings(settings1);
      // Luxon may normalize this, but it should be accepted
      expect(validated1.locale).toBeTruthy();
      expect(validated1.locale).not.toBe('auto');
    });

    // Phase 1: Format preset validation tests
    it('should validate format presets array', () => {
      const settings: Partial<DateHelpersSettings> = {
        formatPresets: [] as any,
      };
      const validated = validateSettings(settings);
      expect(validated.formatPresets.length).toBeGreaterThan(0);
    });

    it('should handle missing format presets', () => {
      const settings: Partial<DateHelpersSettings> = {
        locale: 'en-US',
      };
      const validated = validateSettings(settings);
      expect(Array.isArray(validated.formatPresets)).toBe(true);
      expect(validated.formatPresets.length).toBeGreaterThan(0);
    });

    it('should deduplicate preset IDs', () => {
      const duplicatePreset: FormatPreset = {
        id: 'iso8601',
        name: 'Duplicate',
        format: 'yyyy-MM-dd',
        type: 'date',
        builtin: false,
      };
      const settings: Partial<DateHelpersSettings> = {
        formatPresets: [...DEFAULT_SETTINGS.formatPresets, duplicatePreset],
      };
      const validated = validateSettings(settings);
      const ids = validated.formatPresets.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
    });

    it('should filter out invalid presets', () => {
      const invalidPreset: any = {
        id: 'invalid',
        // Missing required fields
      };
      const settings: Partial<DateHelpersSettings> = {
        formatPresets: [...DEFAULT_SETTINGS.formatPresets, invalidPreset],
      };
      const validated = validateSettings(settings);
      expect(validated.formatPresets.every(p => p.id && p.format)).toBe(true);
    });

    describe('built-in preset labels', () => {
      /** data.json as 0.1.4 and earlier wrote it: English labels on every preset. */
      const storedByV014: FormatPreset[] = [
        {
          id: 'iso8601',
          name: 'ISO 8601',
          format: 'yyyy-MM-dd',
          type: 'date',
          builtin: true,
          description: 'Standard ISO format (2025-11-02)',
        },
        {
          id: 'time-24h',
          name: '24-hour',
          format: 'HH:mm',
          type: 'time',
          builtin: true,
          description: '24-hour time (14:30)',
        },
      ];

      it('should strip name and description from stored built-in presets', () => {
        const validated = validateSettings({ formatPresets: storedByV014 });

        const iso = validated.formatPresets.find(p => p.id === 'iso8601');
        expect(iso).toBeDefined();
        expect(iso?.name).toBeUndefined();
        expect(iso?.description).toBeUndefined();
      });

      it('should preserve every other stored value while stripping labels', () => {
        const validated = validateSettings({ formatPresets: storedByV014 });

        expect(validated.formatPresets.find(p => p.id === 'time-24h')).toEqual({
          id: 'time-24h',
          format: 'HH:mm',
          type: 'time',
          builtin: true,
        });
      });

      it('should leave a fresh install without labels', () => {
        const validated = validateSettings({});

        validated.formatPresets.forEach(preset => {
          expect(preset.name).toBeUndefined();
          expect(preset.description).toBeUndefined();
        });
      });

      it('should keep the labels of a user-defined preset', () => {
        const userPreset: FormatPreset = {
          id: 'mon-format',
          name: 'Mon format',
          description: 'Le format que je préfère',
          format: 'dd/MM',
          type: 'date',
          builtin: false,
        };

        const validated = validateSettings({
          formatPresets: [...DEFAULT_SETTINGS.formatPresets, userPreset],
        });

        expect(validated.formatPresets.find(p => p.id === 'mon-format')).toEqual(userPreset);
      });

      it('should drop a preset whose type is not one the plugin knows', () => {
        const rogue = {
          id: 'duration',
          format: 'hh:mm',
          type: 'duration',
          builtin: false,
        } as unknown as FormatPreset;

        const validated = validateSettings({
          formatPresets: [...DEFAULT_SETTINGS.formatPresets, rogue],
        });

        // Its command name would be built from `commands.prefix.duration`,
        // a key that does not exist, and the palette would show the key
        expect(validated.formatPresets.find(p => p.id === 'duration')).toBeUndefined();
      });

      it('should keep the labels of a preset the locale files cannot name', () => {
        // What a built-in retired in a later version looks like on load
        const retired: FormatPreset = {
          id: 'legacy-format',
          name: 'Legacy',
          description: 'Kept from an older version',
          format: 'dd-MM',
          type: 'date',
          builtin: true,
        };

        const validated = validateSettings({
          formatPresets: [...DEFAULT_SETTINGS.formatPresets, retired],
        });

        expect(validated.formatPresets.find(p => p.id === 'legacy-format')).toEqual(retired);
      });

      it('should not rewrite the stored settings object', () => {
        const stored = [{ ...storedByV014[0] }];
        validateSettings({ formatPresets: stored });

        expect(stored[0].name).toBe('ISO 8601');
      });
    });

    it('should validate default date preset ID', () => {
      const settings: Partial<DateHelpersSettings> = {
        defaultDatePresetId: 'nonexistent-id',
      };
      const validated = validateSettings(settings);
      expect(validated.defaultDatePresetId).toBe('iso8601'); // Reset to default
    });

    it('should preserve valid custom presets', () => {
      const customPreset: FormatPreset = {
        id: 'custom-format',
        name: 'Custom Format',
        format: 'dd/MM/yyyy',
        type: 'date',
        builtin: false,
      };
      const settings: Partial<DateHelpersSettings> = {
        formatPresets: [...DEFAULT_SETTINGS.formatPresets, customPreset],
        defaultDatePresetId: 'custom-format',
      };
      const validated = validateSettings(settings);
      expect(validated.formatPresets.some(p => p.id === 'custom-format')).toBe(true);
      expect(validated.defaultDatePresetId).toBe('custom-format');
    });

    // Phase 4: Advanced NLP settings validation
    it('should validate selectionNamesDate boolean', () => {
      const invalidBoolean: any = {
        ...DEFAULT_SETTINGS,
        selectionNamesDate: 'yes', // Not a boolean
      };
      const validated = validateSettings(invalidBoolean);
      expect(typeof validated.selectionNamesDate).toBe('boolean');
      expect(validated.selectionNamesDate).toBe(DEFAULT_SETTINGS.selectionNamesDate);
    });

    // The migration path proper: a `data.json` written before the key existed.
    // `loadSettings` does not merge the defaults, so this block is the only
    // thing that fills it — passing a boolean never takes that branch.
    it('should fill selectionNamesDate when older data omits it', () => {
      const sansCle: any = { ...DEFAULT_SETTINGS };
      delete sansCle.selectionNamesDate;

      expect(validateSettings(sansCle).selectionNamesDate).toBe(true);
    });

    it('should validate nlpAutoDetectLanguage boolean', () => {
      const invalidBoolean: any = {
        ...DEFAULT_SETTINGS,
        nlpAutoDetectLanguage: 'yes', // Not a boolean
      };
      const validated = validateSettings(invalidBoolean);
      expect(typeof validated.nlpAutoDetectLanguage).toBe('boolean');
      expect(validated.nlpAutoDetectLanguage).toBe(DEFAULT_SETTINGS.nlpAutoDetectLanguage);
    });

    // Phase 7.2: lastUsedAction validation tests
    describe('lastUsedAction field validation', () => {
      it('should validate lastUsedAction as insert-text', () => {
        const settings: Partial<DateHelpersSettings> = {
          lastUsedAction: 'insert-text',
        };
        const validated = validateSettings(settings);
        expect(validated.lastUsedAction).toBe('insert-text');
      });

      it('should validate lastUsedAction as insert-daily-note', () => {
        const settings: Partial<DateHelpersSettings> = {
          lastUsedAction: 'insert-daily-note',
        };
        const validated = validateSettings(settings);
        expect(validated.lastUsedAction).toBe('insert-daily-note');
      });

      it('should validate lastUsedAction as open-daily-note', () => {
        const settings: Partial<DateHelpersSettings> = {
          lastUsedAction: 'open-daily-note',
        };
        const validated = validateSettings(settings);
        expect(validated.lastUsedAction).toBe('open-daily-note');
      });

      it('should clear invalid lastUsedAction', () => {
        const settings = {
          lastUsedAction: 'invalid-action',
        } as unknown as Partial<DateHelpersSettings>;
        const validated = validateSettings(settings);
        expect(validated.lastUsedAction).toBeUndefined();
      });

      it('should not set lastUsedAction for new users (optional field)', () => {
        const settings: Partial<DateHelpersSettings> = {};
        const validated = validateSettings(settings);
        expect(validated.lastUsedAction).toBeUndefined();
      });

      it('should preserve lastUsedAction when validating complete settings', () => {
        const settings: Partial<DateHelpersSettings> = {
          lastUsedAction: 'insert-daily-note',
          locale: 'en-US',
          weekStart: 0,
          enableNLP: true,
        };
        const validated = validateSettings(settings);
        expect(validated.lastUsedAction).toBe('insert-daily-note');
        expect(validated.locale).toBe('en-US');
      });
    });

    // Original Text Alias feature validation tests
    describe('dailyNotesAliasFallbackPresetId validation', () => {
      it('should accept valid preset ID for fallback', () => {
        const settings: Partial<DateHelpersSettings> = {
          dailyNotesAliasFallbackPresetId: 'iso8601',
        };
        const validated = validateSettings(settings);
        expect(validated.dailyNotesAliasFallbackPresetId).toBe('iso8601');
      });

      it('should reset invalid fallback preset ID to default', () => {
        const settings: Partial<DateHelpersSettings> = {
          dailyNotesAliasFallbackPresetId: 'nonexistent-preset',
        };
        const validated = validateSettings(settings);
        expect(validated.dailyNotesAliasFallbackPresetId).toBe('locale-long');
      });

      it('should not allow original-text as fallback preset', () => {
        const settings: Partial<DateHelpersSettings> = {
          dailyNotesAliasFallbackPresetId: 'original-text',
        };
        const validated = validateSettings(settings);
        expect(validated.dailyNotesAliasFallbackPresetId).toBe('locale-long');
      });

      it('should default to locale-long for new users', () => {
        const settings: Partial<DateHelpersSettings> = {};
        const validated = validateSettings(settings);
        expect(validated.dailyNotesAliasFallbackPresetId).toBe('locale-long');
      });
    });

    describe('dailyNotesAliasPresetId validation', () => {
      it('should accept a text alias source as valid preset ID', () => {
        for (const source of ['selected-text', 'typed-text']) {
          const validated = validateSettings({
            dailyNotesAliasPresetId: source,
          } as Partial<DateHelpersSettings>);
          expect(validated.dailyNotesAliasPresetId).toBe(source);
        }
      });

      it('should reject the pre-split original-text value, leaving it at the default', () => {
        const validated = validateSettings({
          dailyNotesAliasPresetId: 'original-text',
        } as Partial<DateHelpersSettings>);
        expect(validated.dailyNotesAliasPresetId).toBe('selected-text');
      });

      it('should accept valid format preset ID', () => {
        const settings: Partial<DateHelpersSettings> = {
          dailyNotesAliasPresetId: 'iso8601',
        };
        const validated = validateSettings(settings);
        expect(validated.dailyNotesAliasPresetId).toBe('iso8601');
      });

      it('should reset invalid preset ID to default', () => {
        const settings: Partial<DateHelpersSettings> = {
          dailyNotesAliasPresetId: 'nonexistent-preset',
        };
        const validated = validateSettings(settings);
        expect(validated.dailyNotesAliasPresetId).toBe('selected-text');
      });
    });
  });
});
