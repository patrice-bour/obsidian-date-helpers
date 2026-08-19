/**
 * @jest-environment jsdom
 *
 * What the inline popup lists, what a validated entry writes to the editor, and
 * what the keyboard does with it.
 */

import { DateTime } from 'luxon';
import { DatePickerSuggest, DateSuggestion } from '@/ui/date-picker-suggest';
import DateHelpersPlugin from '@/main';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { I18nService } from '@/services/i18n-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { createMockApp } from '../../helpers/mock-app';

describe('DatePickerSuggest — list and keyboard', () => {
  let app: ReturnType<typeof createMockApp>;
  let settings: DateHelpersSettings;
  let plugin: DateHelpersPlugin;
  let suggest: DatePickerSuggest;
  let editor: any;

  beforeEach(() => {
    app = createMockApp();
    settings = { ...DEFAULT_SETTINGS, formatPresets: [...DEFAULT_SETTINGS.formatPresets] };

    const dateService = new DateService('en-US');
    const formatterService = new FormatterService('en-US');
    const i18n = new I18nService('en');
    const nlpService = new NLPService(dateService, i18n as never, settings);
    const dailyNotesService = new DailyNotesService(app as never, formatterService, i18n, settings);

    plugin = {
      settings,
      i18n,
      dateService,
      formatterService,
      nlpService,
      dailyNotesService,
      showDatePickerFromTrigger: jest.fn(),
    } as unknown as DateHelpersPlugin;

    suggest = new DatePickerSuggest(app as never, plugin, [
      { sequence: '@@', mode: 'picker' },
      { sequence: '@', mode: 'inline' },
    ]);

    editor = {
      getLine: jest.fn(),
      getCursor: jest.fn(),
      replaceRange: jest.fn(),
      setCursor: jest.fn(),
    };
  });

  /** Drive the popup as Obsidian does: onTrigger, then getSuggestions */
  function suggestionsFor(line: string): DateSuggestion[] {
    editor.getLine = jest.fn().mockReturnValue(line);
    const cursor = { line: 0, ch: line.length };
    const info = suggest.onTrigger(cursor, editor);
    if (!info) throw new Error(`no trigger fired for ${line}`);
    const context = { editor, start: info.start, end: info.end, query: info.query, file: null };
    // Obsidian sets `context` between onTrigger and selectSuggestion; the test
    // stands in for it, through `unknown` since the real type wants a TFile.
    (suggest as unknown as { context: unknown }).context = context;
    return suggest.getSuggestions(context as never);
  }

  function pin(...presetIds: string[]): void {
    settings.formatPresets = settings.formatPresets.map(preset => ({
      ...preset,
      showInSuggest: presetIds.includes(preset.id),
    }));
  }

  describe('composition', () => {
    it('lists the pinned presets, the daily note entry and the picker entry', () => {
      pin('iso8601', 'locale-long');

      const list = suggestionsFor('@tomorrow');

      expect(list.map(s => s.kind)).toEqual(['preset', 'preset', 'daily-note', 'open-picker']);
      const tomorrow = DateTime.now().plus({ days: 1 });
      expect(list[0].output).toBe(tomorrow.toISODate());
    });

    it('carries the expression as the daily note alias', () => {
      pin('iso8601');

      const list = suggestionsFor('@tomorrow');
      const dailyNote = list.find(s => s.kind === 'daily-note');

      expect(dailyNote?.output).toContain('|tomorrow]]');
    });

    it('offers exactly two entries when nothing parses', () => {
      pin('iso8601', 'locale-long');

      const list = suggestionsFor('@un alias vers une date');

      expect(list.map(s => s.kind)).toEqual(['daily-note', 'open-picker']);
      // The typed string is kept, as the alias of today's note
      expect(list[0].output).toContain('|un alias vers une date]]');
      expect(list[0].output).toContain(DateTime.now().toISODate());
    });

    it('never lists a plain-format entry when nothing parses', () => {
      pin('iso8601', 'locale-long', 'date-verbose');

      const list = suggestionsFor('@réunion de cadrage');

      expect(list.filter(s => s.kind === 'preset')).toHaveLength(0);
    });

    it('keeps the daily note and picker entries when no preset is pinned', () => {
      pin(); // none

      const list = suggestionsFor('@tomorrow');

      expect(list.map(s => s.kind)).toEqual(['daily-note', 'open-picker']);
    });

    it('follows the pinned set, not the preset order', () => {
      pin('locale-long');
      expect(suggestionsFor('@tomorrow').filter(s => s.kind === 'preset')).toHaveLength(1);

      pin('locale-long', 'iso8601');
      expect(suggestionsFor('@tomorrow').filter(s => s.kind === 'preset')).toHaveLength(2);

      pin('locale-long');
      expect(suggestionsFor('@tomorrow').filter(s => s.kind === 'preset')).toHaveLength(1);
    });

    it('leaves a datetime format out when the expression names no time', () => {
      pin('datetime-standard');

      const list = suggestionsFor('@tomorrow');

      // "tomorrow" says nothing about an hour: a datetime rendering would put
      // 00:00 in the note and pass it off as what the user meant.
      expect(list.filter(s => s.kind === 'preset')).toHaveLength(0);
    });

    it('offers a datetime format once the expression names a time', () => {
      pin('datetime-standard');

      const list = suggestionsFor('@tomorrow at 2pm');

      const preset = list.find(s => s.kind === 'preset');
      expect(preset?.presetId).toBe('datetime-standard');
      expect(preset?.output).toContain('14:00');
    });

    it('never offers a time-only format: the popup inserts dates', () => {
      pin('time-24h');

      expect(suggestionsFor('@tomorrow at 2pm').filter(s => s.kind === 'preset')).toHaveLength(0);
    });

    it('opens the modal and lists nothing for the picker trigger', () => {
      const list = suggestionsFor('@@');

      expect(list).toEqual([]);
      expect(plugin.showDatePickerFromTrigger).toHaveBeenCalled();
    });
  });

  describe('rendering', () => {
    it('renders each entry with a label', () => {
      pin('iso8601');
      const list = suggestionsFor('@tomorrow');

      const rendered = list.map(suggestion => {
        const el = document.createElement('div');
        suggest.renderSuggestion(suggestion, el);
        return el.textContent ?? '';
      });

      expect(rendered.every(text => text.length > 0)).toBe(true);
      expect(rendered.at(-1)).toBe('Open the picker…');
    });

    it('lays the two lines out inside a container of ours', () => {
      pin('iso8601');
      const [entry] = suggestionsFor('@tomorrow');
      const el = document.createElement('div');

      suggest.renderSuggestion(entry, el);

      // Styling `.suggestion-item` itself would reach every other plugin's popup
      const row = el.querySelector('.date-suggest-item');
      expect(row).not.toBeNull();
      expect(row?.querySelector('.date-suggest-output')?.textContent).toBe(entry.output);
      expect(row?.querySelector('.date-suggest-label')?.textContent).toBe(entry.label);
    });
  });

  describe('validating an entry', () => {
    it('replaces trigger and expression in a single editor transaction', () => {
      pin('iso8601');
      const list = suggestionsFor('@tomorrow');

      suggest.selectSuggestion(list[0]);

      // One call: one undo restores what the user typed, in full
      expect(editor.replaceRange).toHaveBeenCalledTimes(1);
      const [text, start, end] = editor.replaceRange.mock.calls[0];
      expect(text).toBe(DateTime.now().plus({ days: 1 }).toISODate());
      expect(start).toEqual({ line: 0, ch: 0 });
      expect(end).toEqual({ line: 0, ch: '@tomorrow'.length });
    });

    it('restores a whole paragraph with one undo, however long the expression', () => {
      pin('iso8601');
      const paragraph = 'a rather long expression that parses to nothing at all whatsoever';
      const list = suggestionsFor(`@${paragraph}`);

      suggest.selectSuggestion(list[0]);

      expect(editor.replaceRange).toHaveBeenCalledTimes(1);
      const [, start, end] = editor.replaceRange.mock.calls[0];
      expect(start).toEqual({ line: 0, ch: 0 });
      expect(end).toEqual({ line: 0, ch: paragraph.length + 1 });
    });

    it('opens the picker with the expression in its NLP field', () => {
      pin('iso8601');
      const list = suggestionsFor('@mardi prochain');
      const openPicker = list.find(s => s.kind === 'open-picker');

      suggest.selectSuggestion(openPicker as DateSuggestion);

      expect(editor.replaceRange).not.toHaveBeenCalled();
      expect(plugin.showDatePickerFromTrigger).toHaveBeenCalledWith(
        editor,
        { line: 0, ch: 0 },
        { line: 0, ch: '@mardi prochain'.length },
        'mardi prochain',
        // No selection was typed over here, so the picker gets nothing to
        // alias and nothing to cancel back to
        undefined
      );
    });
  });

  describe('keyboard', () => {
    it('dismisses on TAB without inserting anything', () => {
      // `close` is a real method here — the suggest overrides it to give a
      // captured selection back — so the spy wraps it rather than replaces it.
      const close = jest.spyOn(suggest, 'close');
      const register = suggest.scope.register as unknown as jest.Mock;
      const tab = register.mock.calls.find(call => call[1] === 'Tab');
      expect(tab).toBeDefined();

      const handled = tab![2]();

      expect(close).toHaveBeenCalled();
      expect(editor.replaceRange).not.toHaveBeenCalled();
      // Returning false lets nothing else act on the key
      expect(handled).toBe(false);
    });
  });
});
