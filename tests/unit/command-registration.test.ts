/**
 * @jest-environment jsdom
 *
 * Phase 7.2: Command Registration Tests
 *
 * Tests the action-based command system where all commands are always
 * available. Phase 7.2 replaced the Phase 6 mode-based system with contextual
 * action selection.
 *
 * The names come from a real `onload()`, not from a copy of the registration
 * logic: this file used to rebuild the command list itself and drifted from
 * what the plugin registers ("Insert Daily Note link" against "Insert daily
 * note link"), which is the failure this test now guards against.
 */

import { App } from 'obsidian';
import { createMockApp } from '../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettings } from '@/types/settings';

type PluginMock = DateHelpersPlugin & { addCommand: jest.Mock; loadData: jest.Mock };

const MANIFEST = {
  id: 'date-helpers',
  name: 'Date Helpers',
  author: 'test',
  version: '0.0.0',
  minAppVersion: '1.5.0',
  description: 'test manifest',
};

describe('Command Registration (Phase 7.2)', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  async function registeredCommands(
    settings: Partial<DateHelpersSettings> = {}
  ): Promise<Array<{ id: string; name: string }>> {
    const plugin = new DateHelpersPlugin(app, MANIFEST) as PluginMock;
    plugin.loadData.mockResolvedValue({ locale: 'en', ...settings });
    await plugin.onload();
    return plugin.addCommand.mock.calls.map(([command]) => command as { id: string; name: string });
  }

  async function commandNames(settings: Partial<DateHelpersSettings> = {}): Promise<string[]> {
    return (await registeredCommands(settings)).map(command => command.name);
  }

  async function commandIds(settings: Partial<DateHelpersSettings> = {}): Promise<string[]> {
    return (await registeredCommands(settings)).map(command => command.id);
  }

  const isPresetCommand = (name: string): boolean =>
    name.startsWith('Insert date:') ||
    name.startsWith('Insert time:') ||
    name.startsWith('Insert datetime:');

  describe('Action Commands', () => {
    it('should always register all 3 action commands', async () => {
      const commands = await commandNames({ lastUsedAction: 'insert-text' });

      expect(commands).toContain('Insert date as text');
      expect(commands).toContain('Insert daily note link');
      expect(commands).toContain('Open daily note');
    });

    it('should register action commands regardless of lastUsedAction setting', async () => {
      const withText = await commandNames({ lastUsedAction: 'insert-text' });
      const withDailyNote = await commandNames({ lastUsedAction: 'insert-daily-note' });

      expect(withText).toEqual(withDailyNote);
    });

    it('should have correct command IDs', async () => {
      const ids = await commandIds();

      expect(ids).toContain('insert-date-text');
      expect(ids).toContain('insert-date-daily-note');
      expect(ids).toContain('open-daily-note');
      expect(ids).toContain('convert-selection');
    });

    it('should always register Convert selection command', async () => {
      const commands = await commandNames({ enableNLP: false, enableDatePicker: false });

      expect(commands).toContain('Convert selection to date');
    });
  });

  describe('Preset Commands', () => {
    it('should always register all preset commands', async () => {
      const commands = await commandNames();

      // Date presets
      expect(commands).toContain('Insert date: ISO 8601');
      expect(commands).toContain('Insert date: Locale short');
      expect(commands).toContain('Insert date: Locale long');
      expect(commands).toContain('Insert date: Verbose');
      expect(commands).toContain('Insert date: Short month');

      // Time presets
      expect(commands).toContain('Insert time: 24-hour');
      expect(commands).toContain('Insert time: 12-hour');
      expect(commands).toContain('Insert time: 24-hour with seconds');

      // Datetime presets
      expect(commands).toContain('Insert datetime: ISO datetime');
      expect(commands).toContain('Insert datetime: Readable');
      expect(commands).toContain('Insert datetime: Standard');
    });

    it('should register preset commands regardless of lastUsedAction', async () => {
      const withText = (await commandNames({ lastUsedAction: 'insert-text' })).filter(
        isPresetCommand
      );
      const withDailyNote = (await commandNames({ lastUsedAction: 'insert-daily-note' })).filter(
        isPresetCommand
      );

      expect(withText).toEqual(withDailyNote);
      expect(withText.length).toBe(11); // 5 date + 3 time + 3 datetime
    });

    it('should have correct preset command IDs', async () => {
      const ids = await commandIds();

      expect(ids).toContain('insert-date-iso8601');
      expect(ids).toContain('insert-date-locale-short');
      expect(ids).toContain('insert-date-time-24h');
    });
  });

  describe('Command names follow the locale', () => {
    it('registers French names when the locale is French', async () => {
      const commands = await commandNames({ locale: 'fr' });

      expect(commands).toContain('Insérer une date comme texte');
      expect(commands).toContain('Insérer un lien Daily Note (note quotidienne)');
      expect(commands).toContain('Insérer une date : ISO 8601');
      expect(commands).toContain('Insérer une heure : 24 heures');
    });

    it('translates the preset label, not only the prefix', async () => {
      const commands = await commandNames({ locale: 'fr' });

      expect(commands).toContain('Insérer une date : Date courte');
      expect(commands).not.toContain('Insert date: Locale short');
    });
  });

  describe('Command Count', () => {
    it('should register exactly 4 action commands + 11 default preset commands', async () => {
      const commands = await commandNames();

      expect(commands.length).toBe(15);
      expect(commands.filter(isPresetCommand).length).toBe(11);
      expect(commands.slice(0, 4)).toEqual([
        'Insert date as text',
        'Insert daily note link',
        'Open daily note',
        'Convert selection to date',
      ]);
    });

    it('should not have any mode-specific command prefixes', async () => {
      const commands = await commandNames();

      // Phase 7.2 removed mode prefixes like "[Text]" and "Daily Notes:"
      expect(commands.filter(name => name.startsWith('[Text]'))).toEqual([]);
      expect(commands.filter(name => name.startsWith('Daily Notes:'))).toEqual([]);
    });
  });

  describe('Feature Toggle Behavior', () => {
    it('should not affect command registration when NLP is disabled', async () => {
      // Phase 7.2: the NLP toggle only affects behaviour WITHIN the picker
      expect(await commandNames({ enableNLP: true })).toEqual(
        await commandNames({ enableNLP: false })
      );
    });

    it('should not affect command registration when Date Picker is disabled', async () => {
      // Phase 7.2: enableDatePicker only affects trigger characters
      expect(await commandNames({ enableDatePicker: true })).toEqual(
        await commandNames({ enableDatePicker: false })
      );
    });
  });

  describe('No Mode-Based Logic', () => {
    it('should have the same command list for all lastUsedAction values', async () => {
      const actions: Array<DateHelpersSettings['lastUsedAction']> = [
        'insert-text',
        'insert-daily-note',
        'open-daily-note',
      ];

      const sets = await Promise.all(
        actions.map(action => commandNames({ lastUsedAction: action }))
      );

      sets.forEach(set => expect(set).toEqual(sets[0]));
    });
  });
});
