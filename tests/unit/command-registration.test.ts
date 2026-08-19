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
import { DateTime } from 'luxon';
// The mock by its own path: `obsidian` resolves to the real package's types,
// which know nothing of the opened-modal record this file reads.
import { Modal } from '../mocks/obsidian';
import { createMockApp } from '../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettings } from '@/types/settings';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';

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

      expect(commands).toContain('Insert date as text…');
      expect(commands).toContain('Insert daily note link…');
      expect(commands).toContain('Open daily note…');
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
    });

    it('should keep the three action ids while their names carry the dialog ellipsis', async () => {
      const commands = await registeredCommands();

      // The ids are the anchor a user hotkey is bound to: renaming without
      // touching them is what lets existing hotkeys survive the rename.
      const byId = (id: string) => commands.find(command => command.id === id);

      expect(byId('insert-date-text')?.name).toBe('Insert date as text…');
      expect(byId('insert-date-daily-note')?.name).toBe('Insert daily note link…');
      expect(byId('open-daily-note')?.name).toBe('Open daily note…');
    });

    it('should no longer register the Convert selection command', async () => {
      const commands = await registeredCommands({ enableNLP: false, enableDatePicker: false });

      expect(commands.map(command => command.id)).not.toContain('convert-selection');
      expect(commands.map(command => command.name)).not.toContain('Convert selection to date');
    });
  });

  describe('Daily Note link command and the editor selection', () => {
    /** A minimal editor: a selection, and a record of what replaced it */
    function mockEditor(selection: string) {
      return {
        getSelection: jest.fn(() => selection),
        replaceSelection: jest.fn(),
        replaceRange: jest.fn(),
        getCursor: jest.fn(() => ({ line: 0, ch: 0 })),
        setCursor: jest.fn(),
      };
    }

    async function runDailyNoteCommand(selection: string) {
      const plugin = new DateHelpersPlugin(app, MANIFEST) as PluginMock;
      plugin.loadData.mockResolvedValue({ locale: 'en' });
      await plugin.onload();

      const command = plugin.addCommand.mock.calls
        .map(([c]) => c as { id: string; editorCallback?: (editor: unknown) => void })
        .find(c => c.id === 'insert-date-daily-note');
      if (!command?.editorCallback) throw new Error('daily note command has no editorCallback');

      const editor = mockEditor(selection);
      command.editorCallback(editor);

      const modal = Modal.opened.at(-1) as unknown as UnifiedDatePickerModal | undefined;
      if (!modal) throw new Error('the command opened no picker');
      return { modal, editor };
    }

    it('carries an unparsable selection into the wikilink alias', async () => {
      const { modal, editor } = await runDailyNoteCommand('réunion de cadrage');

      await modal.selectDate(DateTime.fromISO('2026-08-17'));

      expect(editor.replaceSelection).toHaveBeenCalledTimes(1);
      const [inserted] = editor.replaceSelection.mock.calls[0];
      expect(inserted).toContain('|réunion de cadrage]]');
    });

    it('opens the calendar on the date a parsable selection names', async () => {
      const { modal } = await runDailyNoteCommand('tomorrow');

      const tomorrow = DateTime.now().plus({ days: 1 }).startOf('day');
      expect(modal.getFocusedDay().hasSame(tomorrow, 'day')).toBe(true);
    });

    it('opens the picker with no alias source when there is no selection', async () => {
      const { modal, editor } = await runDailyNoteCommand('');

      await modal.selectDate(DateTime.fromISO('2026-08-17'));

      // No selection to replace: the wikilink is inserted at the cursor
      expect(editor.replaceSelection).not.toHaveBeenCalled();
      expect(editor.replaceRange).toHaveBeenCalled();
      const [inserted] = editor.replaceRange.mock.calls[0];
      expect(inserted).toContain('2026-08-17');
    });

    it('leaves the plain-text command free of any alias', async () => {
      const plugin = new DateHelpersPlugin(app, MANIFEST) as PluginMock;
      plugin.loadData.mockResolvedValue({ locale: 'en' });
      await plugin.onload();

      const command = plugin.addCommand.mock.calls
        .map(([c]) => c as { id: string; editorCallback?: (editor: unknown) => void })
        .find(c => c.id === 'insert-date-text');
      const editor = mockEditor('réunion de cadrage');
      command?.editorCallback?.(editor);

      const modal = Modal.opened.at(-1) as unknown as UnifiedDatePickerModal;
      await modal.selectDate(DateTime.fromISO('2026-08-17'));

      const [inserted] = editor.replaceSelection.mock.calls[0];
      expect(inserted).not.toContain('réunion de cadrage');
      expect(inserted).not.toContain('[[');
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

      expect(commands).toContain('Insérer une date comme texte…');
      expect(commands).toContain('Insérer un lien Daily Note…');
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
    it('should register exactly 3 action commands + 11 default preset commands', async () => {
      const commands = await commandNames();

      expect(commands.length).toBe(14);
      expect(commands.filter(isPresetCommand).length).toBe(11);
      expect(commands.slice(0, 3)).toEqual([
        'Insert date as text…',
        'Insert daily note link…',
        'Open daily note…',
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
