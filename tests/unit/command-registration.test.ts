import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/settings/defaults';

/**
 * Phase 7.2: Command Registration Tests
 *
 * Tests the new action-based command system where all commands are always available.
 * Phase 7.2 replaced the Phase 6 mode-based system with contextual action selection.
 */

/**
 * Simulates command registration logic from main.ts
 * Returns list of command names that would be registered
 */
function getRegisteredCommandNames(settings: Partial<DateHelpersSettings>): string[] {
  const fullSettings = { ...DEFAULT_SETTINGS, ...settings };
  const commands: string[] = [];

  // Phase 7.2: Action commands (always registered)
  commands.push('Insert date as text');
  commands.push('Insert Daily Note link');
  commands.push('Open Daily Note');
  commands.push('Convert selection to date');

  // Preset commands (always registered)
  fullSettings.formatPresets.forEach((preset) => {
    let prefix = 'Insert date';
    if (preset.type === 'time') {
      prefix = 'Insert time';
    } else if (preset.type === 'datetime') {
      prefix = 'Insert datetime';
    }
    commands.push(`${prefix}: ${preset.name}`);
  });

  return commands;
}

/**
 * Returns command IDs that would be registered
 */
function getRegisteredCommandIds(settings: Partial<DateHelpersSettings>): string[] {
  const fullSettings = { ...DEFAULT_SETTINGS, ...settings };
  const ids: string[] = [];

  // Phase 7.2: Action command IDs
  ids.push('insert-date-text');
  ids.push('insert-date-daily-note');
  ids.push('open-daily-note');
  ids.push('convert-selection');

  // Preset command IDs
  fullSettings.formatPresets.forEach((preset) => {
    ids.push(`insert-date-${preset.id}`);
  });

  return ids;
}

describe('Command Registration (Phase 7.2)', () => {
  describe('Action Commands', () => {
    it('should always register all 3 action commands', () => {
      const settings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'insert-text',
      };

      const commands = getRegisteredCommandNames(settings);

      // All 3 action commands always available
      expect(commands).toContain('Insert date as text');
      expect(commands).toContain('Insert Daily Note link');
      expect(commands).toContain('Open Daily Note');
    });

    it('should register action commands regardless of lastUsedAction setting', () => {
      const insertTextSettings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'insert-text',
      };
      const insertDNSettings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'insert-daily-note',
      };
      const openDNSettings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'open-daily-note',
      };

      const insertTextCommands = getRegisteredCommandNames(insertTextSettings);
      const insertDNCommands = getRegisteredCommandNames(insertDNSettings);
      const openDNCommands = getRegisteredCommandNames(openDNSettings);

      // All settings produce the same commands (no mode-based filtering)
      expect(insertTextCommands).toEqual(insertDNCommands);
      expect(insertDNCommands).toEqual(openDNCommands);
    });

    it('should have correct command IDs', () => {
      const settings: Partial<DateHelpersSettings> = {};
      const ids = getRegisteredCommandIds(settings);

      expect(ids).toContain('insert-date-text');
      expect(ids).toContain('insert-date-daily-note');
      expect(ids).toContain('open-daily-note');
      expect(ids).toContain('convert-selection');
    });

    it('should always register Convert selection command', () => {
      const settings: Partial<DateHelpersSettings> = {
        enableNLP: false,
        enableDatePicker: false,
      };

      const commands = getRegisteredCommandNames(settings);

      // Convert selection should always be available
      expect(commands).toContain('Convert selection to date');
    });
  });

  describe('Preset Commands', () => {
    it('should always register all preset commands', () => {
      const settings: Partial<DateHelpersSettings> = {};
      const commands = getRegisteredCommandNames(settings);

      // Date presets
      expect(commands).toContain('Insert date: ISO 8601');
      expect(commands).toContain('Insert date: Locale Short');
      expect(commands).toContain('Insert date: Locale Long');
      expect(commands).toContain('Insert date: Verbose');
      expect(commands).toContain('Insert date: Short Month');

      // Time presets
      expect(commands).toContain('Insert time: 24-hour');
      expect(commands).toContain('Insert time: 12-hour');
      expect(commands).toContain('Insert time: 24-hour with seconds');

      // Datetime presets
      expect(commands).toContain('Insert datetime: ISO DateTime');
      expect(commands).toContain('Insert datetime: Readable');
      expect(commands).toContain('Insert datetime: Standard');
    });

    it('should register preset commands regardless of lastUsedAction', () => {
      const insertTextSettings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'insert-text',
      };
      const insertDNSettings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'insert-daily-note',
      };

      const insertTextCommands = getRegisteredCommandNames(insertTextSettings);
      const insertDNCommands = getRegisteredCommandNames(insertDNSettings);

      // Both should have same preset commands
      const insertTextPresets = insertTextCommands.filter((cmd) => cmd.startsWith('Insert date:') || cmd.startsWith('Insert time:') || cmd.startsWith('Insert datetime:'));
      const insertDNPresets = insertDNCommands.filter((cmd) => cmd.startsWith('Insert date:') || cmd.startsWith('Insert time:') || cmd.startsWith('Insert datetime:'));

      expect(insertTextPresets).toEqual(insertDNPresets);
      expect(insertTextPresets.length).toBe(11); // 5 date + 3 time + 3 datetime
    });

    it('should have correct preset command IDs', () => {
      const settings: Partial<DateHelpersSettings> = {};
      const ids = getRegisteredCommandIds(settings);

      // Check that preset IDs follow the pattern
      expect(ids).toContain('insert-date-iso8601');
      expect(ids).toContain('insert-date-locale-short');
      expect(ids).toContain('insert-date-time-24h');
    });
  });

  describe('Command Count', () => {
    it('should register exactly 4 action commands + 11 default preset commands', () => {
      const settings: Partial<DateHelpersSettings> = {};
      const commands = getRegisteredCommandNames(settings);

      // 4 action commands + 11 preset commands = 15 total
      expect(commands.length).toBe(15);

      // Count by category
      const actionCommands = commands.filter((cmd) =>
        cmd === 'Insert date as text' ||
        cmd === 'Insert Daily Note link' ||
        cmd === 'Open Daily Note' ||
        cmd === 'Convert selection to date'
      );
      expect(actionCommands.length).toBe(4);

      const presetCommands = commands.filter((cmd) =>
        cmd.startsWith('Insert date:') ||
        cmd.startsWith('Insert time:') ||
        cmd.startsWith('Insert datetime:')
      );
      expect(presetCommands.length).toBe(11);
    });

    it('should not have any mode-specific command prefixes', () => {
      const settings: Partial<DateHelpersSettings> = {};
      const commands = getRegisteredCommandNames(settings);

      // Phase 7.2 removed mode prefixes like "[Text]" and "Daily Notes:"
      const textPrefixCommands = commands.filter((cmd) => cmd.startsWith('[Text]'));
      const dnPrefixCommands = commands.filter((cmd) => cmd.startsWith('Daily Notes:'));

      expect(textPrefixCommands.length).toBe(0);
      expect(dnPrefixCommands.length).toBe(0);
    });
  });

  describe('Feature Toggle Behavior', () => {
    it('should not affect action command registration when NLP is disabled', () => {
      const nlpEnabled: Partial<DateHelpersSettings> = {
        enableNLP: true,
      };
      const nlpDisabled: Partial<DateHelpersSettings> = {
        enableNLP: false,
      };

      const enabledCommands = getRegisteredCommandNames(nlpEnabled);
      const disabledCommands = getRegisteredCommandNames(nlpDisabled);

      // Phase 7.2: NLP toggle only affects behavior WITHIN the picker, not command registration
      expect(enabledCommands).toEqual(disabledCommands);
    });

    it('should not affect action command registration when Date Picker is disabled', () => {
      const pickerEnabled: Partial<DateHelpersSettings> = {
        enableDatePicker: true,
      };
      const pickerDisabled: Partial<DateHelpersSettings> = {
        enableDatePicker: false,
      };

      const enabledCommands = getRegisteredCommandNames(pickerEnabled);
      const disabledCommands = getRegisteredCommandNames(pickerDisabled);

      // Phase 7.2: enableDatePicker only affects trigger characters, not command registration
      expect(enabledCommands).toEqual(disabledCommands);
    });
  });

  describe('No Mode-Based Logic', () => {
    it('should not filter commands based on mode setting (Phase 6 removed)', () => {
      // Phase 7.2: 'mode' field doesn't exist anymore
      const settings: Partial<DateHelpersSettings> = {
        lastUsedAction: 'insert-text',
      };

      const commands = getRegisteredCommandNames(settings);

      // All actions available regardless of lastUsedAction
      expect(commands).toContain('Insert date as text');
      expect(commands).toContain('Insert Daily Note link');
      expect(commands).toContain('Open Daily Note');
    });

    it('should have the same command list for all lastUsedAction values', () => {
      const actions: Array<'insert-text' | 'insert-daily-note' | 'open-daily-note'> = [
        'insert-text',
        'insert-daily-note',
        'open-daily-note',
      ];

      const commandSets = actions.map((action) => {
        return getRegisteredCommandNames({ lastUsedAction: action });
      });

      // All command sets should be identical
      const firstSet = commandSets[0];
      commandSets.forEach((commandSet) => {
        expect(commandSet).toEqual(firstSet);
      });
    });
  });
});
