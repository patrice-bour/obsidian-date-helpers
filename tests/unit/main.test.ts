/**
 * @jest-environment jsdom
 *
 * Plugin lifecycle characterization tests for main.ts: command
 * registration, settings load/migration/persistence, service
 * initialization and locale propagation, trigger registration.
 */

import { App, Editor } from 'obsidian';
// The mock module is what 'obsidian' resolves to at runtime; importing it
// directly is what types the recorded notices.
import { Notice } from '../mocks/obsidian';
import { createMockApp } from '../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DatePickerSuggest } from '@/ui/date-picker-suggest';
import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { presetName } from '@/i18n/preset-labels';
import { translateWith } from '../helpers/translate';

type PluginMock = DateHelpersPlugin & {
  addCommand: jest.Mock;
  addSettingTab: jest.Mock;
  registerEditorSuggest: jest.Mock;
  registerDomEvent: jest.Mock;
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

    it('registers the 3 action commands plus one command per preset', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      const commands = plugin.addCommand.mock.calls.map(
        ([cmd]) => cmd as { id: string; name: string }
      );
      const ids = commands.map(c => c.id);

      expect(ids.slice(0, 3)).toEqual([
        'insert-date-text',
        'insert-date-daily-note',
        'open-daily-note',
      ]);

      // One command per preset, prefixed by type
      const presetCommands = commands.slice(3);
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
          `${expectedPrefix}: ${presetName(preset, translateWith(plugin.i18n))}`
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

    it('hands the suggest each trigger with the mode it was configured with', async () => {
      // Counting the calls says a suggest was registered, not *which* triggers
      // it got: flattening every mode to `picker` here would turn every user's
      // inline trigger into a modal, with the rest of the suite still green.
      // Stored shortest-first on purpose: longest-first is what the suggest
      // sorts to, so a fixture already in that order cannot tell a copy from
      // an in-place sort.
      const plugin = createPlugin({
        triggerCharacters: [
          { sequence: ';', mode: 'picker' },
          { sequence: '@@', mode: 'inline' },
        ],
      });
      await plugin.onload();

      const [suggest] = plugin.registerEditorSuggest.mock.calls[0] as [DatePickerSuggest];
      const fire = (line: string) => {
        const editor = { getLine: () => line } as unknown as Editor;
        const info = suggest.onTrigger({ line: 0, ch: line.length }, editor);
        return info && { query: info.query, modal: suggest.isModalTrigger() };
      };

      expect(fire('@@mardi')).toEqual({ query: 'mardi', modal: false });
      expect(fire(';')).toEqual({ query: '', modal: true });

      // The suggest sorts longest-first for its own lookup, on a copy. Sorting
      // the live array in place would reorder the user's list behind their
      // back — the settings tab would redraw it that way and the next save
      // would persist it.
      expect(plugin.settings.triggerCharacters).toEqual([
        { sequence: ';', mode: 'picker' },
        { sequence: '@@', mode: 'inline' },
      ]);
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
        setSelection: jest.fn(),
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

    it('the daily note link command absorbs what convert-selection did', async () => {
      const plugin = createPlugin();
      await plugin.onload();

      // What the removed command offered: a parsable selection opens the picker
      // on its date. It now takes no separate palette entry and no selection
      // check — without one the picker simply opens on today.
      getCommand(plugin, 'insert-date-daily-note').editorCallback?.(mockEditor('tomorrow'));

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

    describe('a trigger typed over a selection', () => {
      /**
       * A keystroke that landed in the editor's own content. `target` is what
       * tells the editor apart from the picker's fields, which are ordinary
       * inputs living in the same document.
       */
      function keydownInEditor(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
        return {
          key,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          preventDefault: jest.fn(),
          target: { closest: (sel: string) => (sel === '.cm-content' ? {} : null) },
          ...extra,
        } as unknown as KeyboardEvent;
      }

      /** A keystroke that landed anywhere else — a modal field, the sidebar */
      function keydownOutsideEditor(key: string): KeyboardEvent {
        return {
          key,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          preventDefault: jest.fn(),
          target: { closest: () => null },
        } as unknown as KeyboardEvent;
      }

      /** An editor holding `text`, selected from `from` to `to` */
      function editorSelecting(
        text: string,
        from = { line: 0, ch: 0 },
        to = { line: 0, ch: text.length }
      ) {
        return {
          ...mockEditor(),
          somethingSelected: jest.fn(() => true),
          getSelection: jest.fn(() => text),
          getCursor: jest.fn((which?: string) => (which === 'to' ? to : from)),
        };
      }

      /** The keydown handler the plugin registered on the main document */
      function listenerOf(plugin: PluginMock): (event: KeyboardEvent) => void {
        const registration = plugin.registerDomEvent.mock.calls.find(
          ([, type]: unknown[]) => type === 'keydown'
        );
        if (!registration) throw new Error('no keydown listener registered');
        return registration[2] as (event: KeyboardEvent) => void;
      }

      function suggestOf(plugin: PluginMock): DatePickerSuggest {
        return plugin.registerEditorSuggest.mock.calls[0][0] as DatePickerSuggest;
      }

      /** What the plugin asked Obsidian to open, if it asked at all */
      function suggestOpenCalls(): unknown[][] {
        const manager = (app.workspace as unknown as { editorSuggest: { trigger: jest.Mock } })
          .editorSuggest;
        return manager.trigger.mock.calls;
      }

      it('listens in a detached window too', async () => {
        // Obsidian pops notes out into their own window, and each window has
        // its own document: a listener on the main one never sees those
        // keystrokes, and the feature would be silently absent there.
        const plugin = createPlugin();
        await plugin.onload();

        const registration = (app.workspace.on as jest.Mock).mock.calls.find(
          ([name]) => name === 'window-open'
        );
        expect(registration).toBeDefined();

        const before = plugin.registerDomEvent.mock.calls.length;
        const popout = { document: {} };
        registration![1]({} as never, popout as never);

        const added = plugin.registerDomEvent.mock.calls.slice(before);
        expect(added).toHaveLength(1);
        expect(added[0][0]).toBe(popout.document);
        expect(added[0][1]).toBe('keydown');
        // Capture phase there as well, for the same reason as the main window
        expect(added[0][3]).toBe(true);
      });

      describe('the selected text stays in the note', () => {
        it('cancels the keystroke rather than let it replace the selection', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          const event = keydownInEditor('@');
          listenerOf(plugin)(event);

          expect(event.preventDefault).toHaveBeenCalled();
        });

        it('writes a separating space and the trigger after the text', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor('@'));

          // The space comes first, and only there: a selection already
          // followed by one would otherwise end up with two.
          expect(editor.replaceRange).toHaveBeenCalledWith(
            ' @',
            { line: 0, ch: 20 },
            { line: 0, ch: 20 }
          );
        });

        it('puts the caret after the trigger, where the expression is typed', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor('@'));

          expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 22 });
        });

        it('writes at the end of the selection, not at the end of the line', async () => {
          // `note pour la réunion de lancement à préparer`, the middle selected
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting(
            'réunion de lancement',
            { line: 0, ch: 13 },
            { line: 0, ch: 33 }
          );
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor('@'));

          expect(editor.replaceRange).toHaveBeenCalledWith(
            ' @',
            { line: 0, ch: 33 },
            { line: 0, ch: 33 }
          );
          expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 35 });
        });

        it('writes after the last line of a selection spanning several', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting(
            'réunion de lancement\nsalle du fond',
            { line: 0, ch: 0 },
            { line: 1, ch: 13 }
          );
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor('@'));

          expect(editor.replaceRange).toHaveBeenCalledWith(
            ' @',
            { line: 1, ch: 13 },
            { line: 1, ch: 13 }
          );
        });

        it('keeps the text when the trigger is typed with AltGr', async () => {
          // On an AZERTY keyboard under Windows, `@` is AltGr+0, and the
          // browser reports that keystroke with ctrlKey and altKey both set.
          // It is a character typed over the selection, not a shortcut:
          // reading ctrlKey alone leaves the feature dead on those keyboards.
          const plugin = createPlugin();
          await plugin.onload();
          const suggest = suggestOf(plugin);
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          const event = keydownInEditor('@', { ctrlKey: true, altKey: true });
          listenerOf(plugin)(event);

          expect(event.preventDefault).toHaveBeenCalled();
          expect(editor.replaceRange).toHaveBeenCalledWith(
            ' @',
            { line: 0, ch: 20 },
            { line: 0, ch: 20 }
          );
          expect(suggest.selectionCapture.keptAt({ line: 0, ch: 21 }, null)?.text).toBe(
            'réunion de lancement'
          );
        });

        it('writes the key that was typed, not a hard-coded trigger', async () => {
          // A vault configured with `;;` must keep the text just the same.
          const plugin = createPlugin({ triggerCharacters: [{ sequence: ';;', mode: 'inline' }] });
          await plugin.onload();
          const editor = editorSelecting('réunion');
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor(';'));

          expect(editor.replaceRange).toHaveBeenCalledWith(
            ' ;',
            { line: 0, ch: 7 },
            { line: 0, ch: 7 }
          );
        });
      });

      describe('the popup has to be asked to open', () => {
        it('asks Obsidian to open the suggest, because the write was not typed', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting('réunion de lancement');
          const file = { path: 'note.md' };
          app.workspace.activeEditor = { editor, file } as never;

          listenerOf(plugin)(keydownInEditor('@'));

          expect(suggestOpenCalls()).toHaveLength(1);
          expect(suggestOpenCalls()[0]).toEqual([editor, file, true]);
        });

        /**
         * The fallback has to end the gesture, not leave it half done. With no
         * popup there is no `close()`, so a capture nobody will ever consume
         * would sit armed until a later trigger landed on the same position and
         * inherited a selection the user never made.
         */
        it('forgets the capture when no popup could be opened', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const suggest = suggestOf(plugin);
          // A version of Obsidian that no longer exposes the suggest manager
          delete (app.workspace as unknown as { editorSuggest?: unknown }).editorSuggest;
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor('@'));

          // The text is still kept and the trigger still written — nothing is
          // destroyed — but nothing stays armed either.
          expect(editor.replaceRange).toHaveBeenCalledWith(
            ' @',
            { line: 0, ch: 20 },
            { line: 0, ch: 20 }
          );
          expect(suggest.selectionCapture.keptAt({ line: 0, ch: 21 }, null)).toBeNull();
        });

        it('asks for nothing when the key opens no trigger', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          listenerOf(plugin)(keydownInEditor('x'));

          expect(suggestOpenCalls()).toHaveLength(0);
        });
      });

      describe('keystrokes that must be left alone', () => {
        it('lets an ordinary character replace the selection as before', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          const event = keydownInEditor('x');
          listenerOf(plugin)(event);

          expect(event.preventDefault).not.toHaveBeenCalled();
          expect(editor.replaceRange).not.toHaveBeenCalled();
        });

        it('lets the second character of a two-character trigger type itself', async () => {
          // The first `@` already wrote the trigger and collapsed the caret.
          const plugin = createPlugin();
          await plugin.onload();
          const editor = { ...mockEditor(), somethingSelected: jest.fn(() => false) };
          app.workspace.activeEditor = { editor } as never;

          const event = keydownInEditor('@');
          listenerOf(plugin)(event);

          expect(event.preventDefault).not.toHaveBeenCalled();
          expect(editor.replaceRange).not.toHaveBeenCalled();
        });

        it('keeps nothing when the keystroke landed outside the editor', async () => {
          // Reproduced in Obsidian: with a selection alive in the note, typing
          // `@` into the picker's natural-language field armed a capture on the
          // editor — a keystroke that never touched the note claiming it did.
          const plugin = createPlugin();
          await plugin.onload();
          const suggest = suggestOf(plugin);
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          const event = keydownOutsideEditor('@');
          listenerOf(plugin)(event);

          expect(event.preventDefault).not.toHaveBeenCalled();
          expect(editor.replaceRange).not.toHaveBeenCalled();
          expect(suggest.selectionCapture.keptAt({ line: 0, ch: 21 }, null)).toBeNull();
        });

        it('keeps nothing when the command key is held', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const suggest = suggestOf(plugin);
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          // CMD+@ is a shortcut, not a character typed over the selection
          const event = keydownInEditor('@', { metaKey: true });
          listenerOf(plugin)(event);

          expect(event.preventDefault).not.toHaveBeenCalled();
          expect(suggest.selectionCapture.keptAt({ line: 0, ch: 21 }, null)).toBeNull();
        });

        it('keeps nothing when ctrl is held without alt', async () => {
          const plugin = createPlugin();
          await plugin.onload();
          const suggest = suggestOf(plugin);
          const editor = editorSelecting('réunion de lancement');
          app.workspace.activeEditor = { editor } as never;

          // CTRL+@ is a shortcut too. Alt is what tells AltGr apart from it.
          const event = keydownInEditor('@', { ctrlKey: true });
          listenerOf(plugin)(event);

          expect(event.preventDefault).not.toHaveBeenCalled();
          expect(editor.replaceRange).not.toHaveBeenCalled();
          expect(suggest.selectionCapture.keptAt({ line: 0, ch: 21 }, null)).toBeNull();
        });

        it('leaves an existing capture alone when no editor is active', async () => {
          // A capture already held must survive a keystroke the plugin cannot
          // attribute — asserting only that nothing was kept would pass without
          // the guard, since nothing was kept to begin with.
          const plugin = createPlugin();
          await plugin.onload();
          const suggest = suggestOf(plugin);
          suggest.selectionCapture.arm(editorSelecting('réunion de lancement') as never, '@', null);

          app.workspace.activeEditor = null as never;
          expect(() => listenerOf(plugin)(keydownInEditor('@'))).not.toThrow();

          expect(suggest.selectionCapture.keptAt({ line: 0, ch: 21 }, null)?.text).toBe(
            'réunion de lancement'
          );
        });
      });

      /**
       * The whole typing path, end to end: the keystroke keeps the text and
       * writes the trigger, the suggest reads the capture back, and the listed
       * wikilink carries the text as alias.
       *
       * Each step is pinned on its own elsewhere. What is pinned here is that
       * they are joined at all — the plugin registers the listener, and the
       * listener feeds the very suggest it registered.
       */
      it('turns the kept text into the alias of the listed wikilink', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const suggest = suggestOf(plugin);

        const editor = editorSelecting('réunion de lancement');
        app.workspace.activeEditor = { editor } as never;

        listenerOf(plugin)(keydownInEditor('@'));

        // The line now reads the kept text, a space, and the trigger
        editor.getLine = jest.fn(() => 'réunion de lancement @');
        const info = suggest.onTrigger({ line: 0, ch: 22 }, editor as never, null);
        expect(info).not.toBeNull();
        const context = { editor, ...info, file: null };
        (suggest as unknown as { context: unknown }).context = context;
        const list = suggest.getSuggestions(context as never);

        const entry = list.find(s => s.kind === 'daily-note');
        expect(entry?.output).toContain('|réunion de lancement]]');
      });
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

      it('carries a captured selection into the picker as its alias', async () => {
        // The join, not the ends: the modal is already pinned to alias a
        // selection, and the capture is already pinned to hold one. Nothing
        // asserted that the trigger path hands one to the other.
        const plugin = createPlugin({ lastUsedAction: 'insert-daily-note' });
        await plugin.onload();
        const editor = mockEditor();

        plugin.showDatePickerFromTrigger(
          editor as never,
          { line: 0, ch: 0 },
          { line: 0, ch: 23 },
          undefined,
          { text: 'réunion de lancement', triggerStart: { line: 0, ch: 21 } }
        );
        await openedModals[0].selectFocusedDay();

        const inserted = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
        expect(inserted).toContain('|réunion de lancement]]');
      });

      it('opens on the link tab when a selection came in, without remembering it', async () => {
        // The link tab is the only one an alias means anything to. The context
        // chose it, not the user, so what the user last did stays untouched.
        const plugin = createPlugin({ lastUsedAction: 'insert-text' });
        await plugin.onload();
        const editor = mockEditor();

        plugin.showDatePickerFromTrigger(
          editor as never,
          { line: 0, ch: 0 },
          { line: 0, ch: 23 },
          undefined,
          { text: 'réunion de lancement', triggerStart: { line: 0, ch: 21 } }
        );

        expect(openedModals[0].getSelectedAction()).toBe('insert-daily-note');
        expect(plugin.settings.lastUsedAction).toBe('insert-text');
      });

      it('opens on the remembered tab when no selection came in', async () => {
        const plugin = createPlugin({ lastUsedAction: 'insert-text' });
        await plugin.onload();
        const editor = mockEditor();

        plugin.showDatePickerFromTrigger(editor as never, start, end);

        expect(openedModals[0].getSelectedAction()).toBe('insert-text');
      });

      it('takes back only what the trigger added when the picker is cancelled', async () => {
        // The selected text was never eaten: it is still in the note, with the
        // separating space and the trigger after it. Cancelling has nothing to
        // give back — only what the plugin wrote to take away.
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();

        // `réunion de lancement @@`: the text from 0, the separator at 20, the
        // trigger at 21, the caret at 23.
        const keptFrom = { line: 0, ch: 0 };
        const triggerStart = { line: 0, ch: 21 };
        const caret = { line: 0, ch: 23 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement',
          triggerStart,
        });
        openedModals[0].onClose(); // cancel without selecting

        expect(editor.replaceRange).toHaveBeenCalledWith('', { line: 0, ch: 20 }, caret);
      });

      /**
       * Giving the text back is not giving the gesture back: the words return,
       * but not the selection over them, so the trigger cannot be retried
       * without picking them out again.
       */
      it('selects the kept text again when the picker is cancelled', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        editor.getLine.mockReturnValue('réunion de lancement @@');

        const keptFrom = { line: 0, ch: 0 };
        const caret = { line: 0, ch: 23 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement',
          triggerStart: { line: 0, ch: 21 },
        });
        openedModals[0].onClose();

        // The separator bounds it on the right: the trigger and the space are
        // gone, so what is left of the handed-over range is the kept text.
        expect(editor.setSelection).toHaveBeenCalledWith(keptFrom, { line: 0, ch: 20 });
      });

      /**
       * The left bound must be the kept text's own start, not the line's. Every
       * other fixture on this path selects from column 0, where the two
       * coincide — and a bound hard-wired to 0 would pass them all.
       */
      it('selects a kept text that starts mid-line again', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        // `note pour la réunion de lancement @@ à préparer`: the text from 13 to
        // 33, the separator at 33, the trigger at 34, the caret at 36.
        editor.getLine.mockReturnValue('note pour la réunion de lancement @@ à préparer');

        const keptFrom = { line: 0, ch: 13 };
        const caret = { line: 0, ch: 36 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement',
          triggerStart: { line: 0, ch: 34 },
        });
        openedModals[0].onClose();

        expect(editor.setSelection).toHaveBeenCalledWith(keptFrom, { line: 0, ch: 33 });
      });

      /**
       * A selection spanning lines cannot have its end derived from the anchor's
       * `ch` — the separator carries its own line. A fixture staying on line 0
       * would let arithmetic on `ch` alone pass.
       */
      it('selects a kept text that spans two lines again', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        editor.getLine.mockReturnValue('salle du fond @@');

        // `réunion de lancement\nsalle du fond @@`: the text from 0:0 to 1:13,
        // the separator at 1:13, the trigger at 1:14, the caret at 1:16.
        const keptFrom = { line: 0, ch: 0 };
        const caret = { line: 1, ch: 16 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement\nsalle du fond',
          triggerStart: { line: 1, ch: 14 },
        });
        openedModals[0].onClose();

        expect(editor.setSelection).toHaveBeenCalledWith(keptFrom, { line: 1, ch: 13 });
      });

      /**
       * The selection is posted after the removal, never before: an edit
       * collapses a selection standing over it, so the reversed order would
       * leave the user with a caret again. The mock records both calls whatever
       * their order, so only their sequence numbers can tell them apart.
       */
      it('selects only once the removal has been made', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        editor.getLine.mockReturnValue('réunion de lancement @@');

        plugin.showDatePickerFromTrigger(
          editor as never,
          { line: 0, ch: 0 },
          { line: 0, ch: 23 },
          undefined,
          { text: 'réunion de lancement', triggerStart: { line: 0, ch: 21 } }
        );
        openedModals[0].onClose();

        expect(editor.setSelection.mock.invocationCallOrder[0]).toBeGreaterThan(
          editor.replaceRange.mock.invocationCallOrder[0]
        );
      });

      /**
       * The positions were taken when the trigger was typed and the modal has
       * been open since; a sync or another plugin can have moved the line
       * underneath. A stale removal costs a few characters, but a stale
       * selection costs the user's words — their next keystroke replaces
       * whatever it covers. So the separating space must still be there.
       */
      it('creates no selection when the line moved under the modal', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        // The separating space the plugin wrote is no longer at column 20.
        editor.getLine.mockReturnValue('réunion de lancement, salle du fond @@');

        plugin.showDatePickerFromTrigger(
          editor as never,
          { line: 0, ch: 0 },
          { line: 0, ch: 23 },
          undefined,
          { text: 'réunion de lancement', triggerStart: { line: 0, ch: 21 } }
        );
        openedModals[0].onClose();

        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('creates no selection when the picker is confirmed', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();

        const keptFrom = { line: 0, ch: 0 };
        const caret = { line: 0, ch: 23 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement',
          triggerStart: { line: 0, ch: 21 },
        });
        await openedModals[0].selectFocusedDay();
        openedModals[0].onClose();

        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      /**
       * Found by the pre-merge review. `start` stopped meaning "the trigger"
       * the day the replacement was widened to the kept text, and this branch
       * was never told: opening the daily note wiped the user's words and put
       * nothing in their place, then navigated away from the damage.
       */
      it('opening the daily note takes back only what the trigger added', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();

        const keptFrom = { line: 0, ch: 0 };
        const caret = { line: 0, ch: 23 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement',
          triggerStart: { line: 0, ch: 21 },
        });
        openedModals[0].setSelectedAction('open-daily-note');
        await openedModals[0].selectFocusedDay();

        expect(editor.replaceRange).toHaveBeenCalledWith('', { line: 0, ch: 20 }, caret);

        // This action navigates away, so the editor the trigger was typed in is
        // no longer the one on screen: selecting into it would be selecting in a
        // note the user has left. It cleans up from the callback, which marks
        // the choice made, so the close that follows must do nothing at all.
        openedModals[0].onClose();
        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('opening the daily note still removes the whole trigger with no kept text', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();

        plugin.showDatePickerFromTrigger(editor as never, start, end);
        openedModals[0].setSelectedAction('open-daily-note');
        await openedModals[0].selectFocusedDay();

        expect(editor.replaceRange).toHaveBeenCalledWith('', start, end);
      });

      it('replaces the kept text along with the trigger when the picker confirms', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();

        const keptFrom = { line: 0, ch: 0 };
        const caret = { line: 0, ch: 23 };

        plugin.showDatePickerFromTrigger(editor as never, keptFrom, caret, undefined, {
          text: 'réunion de lancement',
          triggerStart: { line: 0, ch: 21 },
        });
        await openedModals[0].selectFocusedDay();

        const inserted = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
        expect(inserted).toContain('|réunion de lancement]]');
        expect(editor.replaceRange).toHaveBeenCalledWith(inserted, keptFrom, caret);
      });

      it('removes the trigger characters when the picker is cancelled', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor(); // getRange returns '@@'

        plugin.showDatePickerFromTrigger(editor as never, start, end);
        const modal = openedModals[0];

        modal.onClose(); // cancel without selecting
        expect(editor.replaceRange).toHaveBeenCalledWith('', start, end);
        // Nothing was kept, so there is nothing to give back: this path must not
        // create a selection the user never made.
        expect(editor.setSelection).not.toHaveBeenCalled();
      });

      it('leaves the inline expression alone when the picker is cancelled', async () => {
        const plugin = createPlugin();
        await plugin.onload();
        const editor = mockEditor();
        // What the inline suggest hands over: the trigger AND everything typed
        // after it. Cancelling must not eat the sentence — ESC leaves the text
        // in the note, says the spec.
        editor.getRange.mockReturnValue('@réunion de cadrage');
        const inlineEnd = { line: 0, ch: 19 };

        plugin.showDatePickerFromTrigger(editor as never, start, inlineEnd, 'réunion de cadrage');
        openedModals[0].onClose();

        expect(editor.replaceRange).not.toHaveBeenCalled();
      });

      it('removes a one-character picker trigger too', async () => {
        // The combination this change unlocks: `;` opening the modal. Every
        // other cleanup case runs on `@@`, so a length rule creeping back in
        // here would leave the `;` sitting in the note after ESC, with the
        // rest of the suite green.
        const plugin = createPlugin({
          triggerCharacters: [{ sequence: ';', mode: 'picker' }],
        });
        await plugin.onload();
        const editor = mockEditor();
        editor.getRange.mockReturnValue(';');

        plugin.showDatePickerFromTrigger(editor as never, start, { line: 0, ch: 1 });
        openedModals[0].onClose();

        expect(editor.replaceRange).toHaveBeenCalledWith('', start, { line: 0, ch: 1 });
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
