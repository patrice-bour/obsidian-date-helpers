/**
 * @jest-environment jsdom
 *
 * Plugin lifecycle characterization tests for main.ts: command
 * registration, settings load/migration/persistence, service
 * initialization and locale propagation, trigger registration.
 */

import { App } from 'obsidian';
// The mock module is what 'obsidian' resolves to at runtime; importing it
// directly is what types the recorded notices.
import { Notice } from '../mocks/obsidian';
import { createMockApp } from '../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { presetName } from '@/i18n/preset-labels';

type PluginMock = DateHelpersPlugin & {
  addCommand: jest.Mock;
  addSettingTab: jest.Mock;
  registerEditorSuggest: jest.Mock;
  loadData: jest.Mock;
  saveData: jest.Mock;
};

describe('DateHelpersPlugin lifecycle', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  function createPlugin(storedData: unknown = {}): PluginMock {
    const manifest = {
      id: 'date-helpers',
      name: 'Date Helpers',
      author: 'test',
      version: '0.0.0',
      minAppVersion: '1.5.0',
      description: 'test manifest',
    };
    const plugin = new DateHelpersPlugin(app, manifest) as PluginMock;
    plugin.loadData.mockResolvedValue(storedData);
    return plugin;
  }

  describe('onload', () => {
    it('initializes services, registers the settings tab and commands', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      expect(plugin.i18n).toBeDefined();
      expect(plugin.dateService).toBeDefined();
      expect(plugin.formatterService).toBeDefined();
      expect(plugin.nlpService).toBeDefined();
      expect(plugin.dailyNotesService).toBeDefined();
      expect(plugin.addSettingTab).toHaveBeenCalledTimes(1);
    });

    it('registers the 4 action commands plus one command per preset', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      const commands = plugin.addCommand.mock.calls.map(
        ([cmd]) => cmd as { id: string; name: string }
      );
      const ids = commands.map(c => c.id);

      expect(ids.slice(0, 4)).toEqual([
        'insert-date-text',
        'insert-date-daily-note',
        'open-daily-note',
        'convert-selection',
      ]);

      // One command per preset, prefixed by type
      const presetCommands = commands.slice(4);
      expect(presetCommands).toHaveLength(plugin.settings.formatPresets.length);
      plugin.settings.formatPresets.forEach((preset, i) => {
        expect(presetCommands[i].id).toBe(`insert-date-${preset.id}`);
        const expectedPrefix =
          preset.type === 'time'
            ? 'Insert time'
            : preset.type === 'datetime'
              ? 'Insert datetime'
              : 'Insert date';
        expect(presetCommands[i].name).toBe(
          `${expectedPrefix}: ${presetName(preset, key => plugin.i18n.t(key))}`
        );
      });

      // Anchored on a literal, so the loop above cannot be satisfied by a
      // resolver that is wrong in the same way twice
      expect(presetCommands.map(c => c.name)).toEqual(
        expect.arrayContaining(['Insert date: ISO 8601', 'Insert time: 24-hour'])
      );
      plugin.settings.formatPresets.forEach((preset, i) => {
        expect(presetCommands[i].id).toBe(`insert-date-${preset.id}`);
      });
    });

    it('does not register commands twice (commandsRegistered guard)', async () => {
      const plugin = createPlugin();
      await plugin.onload();
      const countAfterLoad = plugin.addCommand.mock.calls.length;

      (plugin as unknown as { registerCommands: () => void }).registerCommands();
      expect(plugin.addCommand.mock.calls.length).toBe(countAfterLoad);
    });

    it('survives a loadData failure without throwing', async () => {
      const plugin = createPlugin();
      plugin.loadData.mockRejectedValue(new Error('disk error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(plugin.onload()).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('loadSettings', () => {
    it.each([null, 'garbage', 42, ['array']])(
      'falls back to defaults when stored data is %p',
      async stored => {
        const plugin = createPlugin(stored);
        await plugin.loadSettings();

        expect(plugin.settings.locale).toBe(DEFAULT_SETTINGS.locale);
        expect(plugin.settings.formatPresets.length).toBeGreaterThan(0);
      }
    );

    it('always re-saves validated settings (self-healing data.json)', async () => {
      const plugin = createPlugin({ locale: 'fr-FR' });
      await plugin.loadSettings();

      expect(plugin.saveData).toHaveBeenCalledTimes(1);
      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
      expect(plugin.settings.locale).toBe('fr-FR');
    });

    it('reports the Phase 5 migration once the services exist', async () => {
      const plugin = createPlugin({ enableDailyNotesIntegration: true, locale: 'fr' });
      Notice.messages = [];

      await plugin.onload();

      // Settings load before initializeServices, so a notice raised from
      // loadSettings would read from an i18n service that does not exist yet
      expect(Notice.messages).toContain(plugin.i18n.t('notices.settingsMigrated'));
      expect(plugin.i18n.t('notices.settingsMigrated')).toContain('Date Helpers');
    });

    it('migrates Phase 5 data (enableDailyNotesIntegration) to the current shape', async () => {
      const plugin = createPlugin({
        enableDailyNotesIntegration: true,
        locale: 'en-US',
      });
      await plugin.loadSettings();

      expect('enableDailyNotesIntegration' in plugin.settings).toBe(false);
      expect(plugin.settings.locale).toBe('en-US');
      // Migrated settings are persisted
      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    });
  });

  describe('saveSettings', () => {
    it('persists settings and propagates the locale to all services', async () => {
      const plugin = createPlugin();
      await plugin.onload();
      plugin.saveData.mockClear();

      const nlpSpy = jest.spyOn(plugin.nlpService, 'updateSettings');
      const dailySpy = jest.spyOn(plugin.dailyNotesService, 'updateSettings');

      plugin.settings.locale = 'fr-FR';
      await plugin.saveSettings();

      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
      expect(plugin.i18n.getCurrentLocale()).toBe('fr-FR');
      expect(plugin.dateService.getLocale()).toBe('fr-FR');
      expect(plugin.formatterService.getLocale()).toBe('fr-FR');
      expect(nlpSpy).toHaveBeenCalledWith(plugin.settings);
      expect(dailySpy).toHaveBeenCalledWith(plugin.settings);
    });

    it('resolves locale "auto" via Obsidian detection', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      plugin.settings.locale = 'auto';
      await plugin.saveSettings();

      // setup.ts mocks window.moment.locale() as 'en'
      expect(plugin.i18n.getCurrentLocale()).toBe('en');
    });

    it('logs an error and skips persistence when settings are not initialized', async () => {
      const plugin = createPlugin();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await plugin.saveSettings();

      expect(consoleError).toHaveBeenCalledWith('Settings not initialized');
      expect(plugin.saveData).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('trigger character registration', () => {
    it('registers the EditorSuggest with default settings', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      expect(plugin.registerEditorSuggest).toHaveBeenCalledTimes(1);
    });

    it('does not register when the date picker is disabled', async () => {
      const plugin = createPlugin({ enableDatePicker: false });
      await plugin.onload();

      expect(plugin.registerEditorSuggest).not.toHaveBeenCalled();
    });

    it('does not register when no trigger characters are configured', async () => {
      const plugin = createPlugin({ triggerCharacters: [] });
      await plugin.onload();

      expect(plugin.registerEditorSuggest).not.toHaveBeenCalled();
    });
  });

  describe('editor command flows', () => {
    function mockEditor(selection = '') {
      return {
        getSelection: jest.fn(() => selection),
        replaceSelection: jest.fn(),
        getCursor: jest.fn(() => ({ line: 0, ch: 0 })),
        replaceRange: jest.fn(),
        setCursor: jest.fn(),
        getRange: jest.fn(() => '@@'),
        getLine: jest.fn(() => ''),
      };
    }

    type EditorCommand = {
      id: string;
      editorCallback?: (editor: unknown) => void;
      editorCheckCallback?: (checking: boolean, editor: unknown) => boolean;
    };

    function getCommand(plugin: PluginMock, id: string): EditorCommand {
      const call = plugin.addCommand.mock.calls.find(([cmd]) => (cmd as EditorCommand).id === id);
      if (!call) throw new Error(`command ${id} not registered`);
      return call[0] as EditorCommand;
    }

    let openedModals: UnifiedDatePickerModal[];
    let openSpy: jest.SpyInstance;

    beforeEach(() => {
      openedModals = [];
      openSpy = jest.spyOn(UnifiedDatePickerModal.prototype, 'open').mockImplementation(function (
        this: UnifiedDatePickerModal
      ) {
        openedModals.push(this);
      });
    });

    afterEach(() => {
      openSpy.mockRestore();
    });

    it('preset commands insert the formatted date as plain text', async () => {
      const plugin = createPlugin();
      await plugin.onload();
      const editor = mockEditor();

      getCommand(plugin, 'insert-date-iso8601').editorCallback?.(editor);

      const today = plugin.dateService.now();
      expect(editor.replaceSelection).toHaveBeenCalledWith(today.toFormat('yyyy-MM-dd'));
    });

    it('preset commands insert a wikilink when the last action was a daily-note action', async () => {
      const plugin = createPlugin({ lastUsedAction: 'insert-daily-note' });
      await plugin.onload();
      const editor = mockEditor();

      getCommand(plugin, 'insert-date-iso8601').editorCallback?.(editor);

      const inserted = (editor.replaceSelection.mock.calls[0] as string[])[0];
      expect(inserted).toMatch(/^\[\[.*\]\]$/);
    });

    it('action commands open the unified picker with the requested action', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      getCommand(plugin, 'insert-date-daily-note').editorCallback?.(mockEditor());

      expect(openedModals).toHaveLength(1);
      expect(openedModals[0].getSelectedAction()).toBe('insert-daily-note');
    });

    it('convert-selection is unavailable without a selection and opens the picker with one', async () => {
      const plugin = createPlugin();
      await plugin.onload();
      const command = getCommand(plugin, 'convert-selection');

      expect(command.editorCheckCallback?.(true, mockEditor(''))).toBe(false);
      expect(command.editorCheckCallback?.(true, mockEditor('tomorrow'))).toBe(true);
      expect(openedModals).toHaveLength(0); // checking only

      expect(command.editorCheckCallback?.(false, mockEditor('tomorrow'))).toBe(true);
      expect(openedModals).toHaveLength(1);
      const tomorrow = plugin.dateService.now().plus({ days: 1 }).startOf('day');
      expect(openedModals[0].getFocusedDay().toISODate()).toBe(tomorrow.toISODate());
    });

    it('picker onSelect inserts at cursor and moves the cursor after the result', async () => {
      const plugin = createPlugin();
      await plugin.onload();
      const editor = mockEditor();

      getCommand(plugin, 'insert-date-text').editorCallback?.(editor);
      const modal = openedModals[0];
      await modal.selectFocusedDay();

      const inserted = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
      expect(editor.replaceRange).toHaveBeenCalledWith(inserted, { line: 0, ch: 0 });
      expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: inserted.length });
    });

    describe('showDatePickerFromTrigger', () => {
      const start = { line: 0, ch: 0 };
      const end = { line: 0, ch: 2 };

      it('replaces the trigger characters with the selected date', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();

        plugin.showDatePickerFromTrigger(editor as never, start, end);
        const modal = openedModals[0];
        await modal.selectFocusedDay();

        const inserted = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
        expect(editor.replaceRange).toHaveBeenCalledWith(inserted, start, end);
        expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: inserted.length });

        // Selection made: closing must NOT trigger the cancel cleanup
        editor.replaceRange.mockClear();
        modal.onClose();
        expect(editor.replaceRange).not.toHaveBeenCalled();
      });

      it('removes the trigger characters when the picker is cancelled', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor(); // getRange returns '@@'

        plugin.showDatePickerFromTrigger(editor as never, start, end);
        const modal = openedModals[0];

        modal.onClose(); // cancel without selecting
        expect(editor.replaceRange).toHaveBeenCalledWith('', start, end);
      });

      it('only removes text that still starts with a configured trigger', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        editor.getRange.mockReturnValue('unrelated text');

        plugin.showDatePickerFromTrigger(editor as never, start, end);
        openedModals[0].onClose();

        expect(editor.replaceRange).not.toHaveBeenCalled();
      });
    });
  });
});
