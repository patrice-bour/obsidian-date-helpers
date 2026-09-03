/**
 * @jest-environment jsdom
 *
 * The popup's chrome: the resolved-date header, the group headings, the
 * key-hint footer, and TAB opening the picker.
 *
 * Ref: OpenSpec update-trigger-surfaces-layout
 */

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

describe('DatePickerSuggest — popup chrome', () => {
  let app: ReturnType<typeof createMockApp>;
  let settings: DateHelpersSettings;
  let plugin: DateHelpersPlugin;
  let suggest: DatePickerSuggest;
  let i18n: I18nService;
  let editor: any;

  beforeEach(() => {
    app = createMockApp();
    settings = { ...DEFAULT_SETTINGS, formatPresets: [...DEFAULT_SETTINGS.formatPresets] };

    const dateService = new DateService('en-US');
    const formatterService = new FormatterService('en-US');
    i18n = new I18nService('en');
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
    (suggest as unknown as { context: unknown }).context = context;
    return suggest.getSuggestions(context as never);
  }

  describe('the picker entry leaves the list', () => {
    it('lists no picker entry when the expression parses', () => {
      const entries = suggestionsFor('@tomorrow');

      // The kind is gone from the union, so the type carries half the proof;
      // this pins the list itself.
      expect(entries.every(e => e.kind === 'preset' || e.kind === 'daily-note')).toBe(true);
      expect(entries.some(e => e.kind === 'daily-note')).toBe(true);
      expect(entries.map(e => e.label)).not.toContain(i18n.t('suggest.openPicker'));
    });

    it('lists exactly one entry when the expression parses to no date', () => {
      const entries = suggestionsFor('@un alias vers une date');

      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe('daily-note');
    });

    it('keeps the daily note entry when no preset is pinned', () => {
      settings.formatPresets = settings.formatPresets.map(p => ({ ...p, showInSuggest: false }));

      const entries = suggestionsFor('@tomorrow');

      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe('daily-note');
    });
  });

  describe('group headings', () => {
    it('puts a heading on the first entry of each group only', () => {
      const entries = suggestionsFor('@tomorrow');

      const formats = entries.filter(e => e.kind === 'preset');
      expect(formats.length).toBeGreaterThan(1);
      expect(formats[0].groupHeading).toBe(i18n.t('suggest.groups.formats'));
      expect(formats.slice(1).every(e => e.groupHeading === undefined)).toBe(true);

      const link = entries.find(e => e.kind === 'daily-note');
      expect(link?.groupHeading).toBe(i18n.t('suggest.groups.dailyNote'));
    });

    it('drops the Formats heading when the group has no entry', () => {
      settings.formatPresets = settings.formatPresets.map(p => ({ ...p, showInSuggest: false }));

      const entries = suggestionsFor('@tomorrow');

      expect(entries.some(e => e.groupHeading === i18n.t('suggest.groups.formats'))).toBe(false);
      expect(entries[0].groupHeading).toBe(i18n.t('suggest.groups.dailyNote'));
    });

    it('carries the heading on the link when a held selection makes it lead', () => {
      const kept = 'réunion de lancement';
      editor.somethingSelected = jest.fn().mockReturnValue(true);
      editor.getSelection = jest.fn().mockReturnValue(kept);
      editor.getCursor = jest.fn((which?: string) =>
        which === 'to' ? { line: 0, ch: kept.length } : { line: 0, ch: 0 }
      );
      editor.getLine = jest.fn().mockReturnValue(kept);
      suggest.selectionCapture.arm(editor, '@', null);

      const entries = suggestionsFor(`${kept} @tomorrow`);

      expect(entries[0].kind).toBe('daily-note');
      expect(entries[0].groupHeading).toBe(i18n.t('suggest.groups.dailyNote'));
    });
  });

  describe('the resolved-date header', () => {
    it('names the resolved date and the typed query', () => {
      suggestionsFor('@tomorrow');

      expect(suggest.header).not.toBeNull();
      expect(suggest.header!.failed).toBe(false);
      expect(suggest.header!.resolved).toMatch(/\d{4}/);
      expect(suggest.header!.query).toBe('@tomorrow');
    });

    it('states the failure when nothing parses, and stays visible', () => {
      suggestionsFor('@un alias vers une date');

      expect(suggest.header).not.toBeNull();
      expect(suggest.header!.failed).toBe(true);
      expect(suggest.header!.resolved).toBe(i18n.t('suggest.header.unparsable'));
    });

    // An empty expression is not a failure: the entries below already offer
    // today, so a header saying nothing parsed contradicts the list it leads.
    it('names today when nothing follows the trigger', () => {
      const entries = suggestionsFor('@');

      expect(suggest.header).not.toBeNull();
      expect(suggest.header!.failed).toBe(false);
      expect(suggest.header!.resolved).not.toBe(i18n.t('suggest.header.unparsable'));
      expect(suggest.header!.resolved).toMatch(/\d{4}/);
      expect(suggest.header!.query).toBe('');
      expect(entries.length).toBeGreaterThan(0);
    });
  });

  /** Arm a capture, the way the popup sees one */
  function holdSelection(kept: string): void {
    editor.somethingSelected = jest.fn().mockReturnValue(true);
    editor.getSelection = jest.fn().mockReturnValue(kept);
    editor.getCursor = jest.fn((which?: string) =>
      which === 'to' ? { line: 0, ch: kept.length } : { line: 0, ch: 0 }
    );
    editor.getLine = jest.fn().mockReturnValue(kept);
    suggest.selectionCapture.arm(editor, '@', null);
  }

  /** Render one entry the way Obsidian does, and give back the row */
  function render(entry: DateSuggestion): HTMLElement {
    const el = document.createElement('div');
    suggest.renderSuggestion(entry, el);
    return el;
  }

  describe('format entries warn while a selection is held', () => {
    it('marks every format entry, and not the link', () => {
      holdSelection('selected text');
      const entries = suggestionsFor('selected text @tomorrow');

      const formats = entries.filter(e => e.kind === 'preset');
      expect(formats.length).toBeGreaterThan(0);
      expect(formats.every(e => e.replacesSelection === true)).toBe(true);

      const link = entries.find(e => e.kind === 'daily-note');
      expect(link!.replacesSelection).toBeUndefined();
    });

    it('marks nothing when no selection is held', () => {
      const entries = suggestionsFor('@tomorrow');

      expect(entries.every(e => e.replacesSelection === undefined)).toBe(true);
    });

    it('draws the sign on the row, with what it means', () => {
      holdSelection('selected text');
      const entries = suggestionsFor('selected text @tomorrow');
      const format = entries.find(e => e.kind === 'preset')!;

      const warn = render(format).querySelector('.date-suggest-warning') as HTMLElement;

      expect(warn).not.toBeNull();
      expect(warn.getAttribute('aria-label')).toBe(i18n.t('suggest.replacesSelection'));
    });

    it('draws no sign on the entry that keeps the text', () => {
      holdSelection('selected text');
      const entries = suggestionsFor('selected text @tomorrow');
      const link = entries.find(e => e.kind === 'daily-note')!;

      expect(render(link).querySelector('.date-suggest-warning')).toBeNull();
    });
  });

  /** The popup's root, where the header and the footer are drawn */
  function popup(): HTMLElement {
    return (suggest as unknown as { suggestEl: HTMLElement }).suggestEl;
  }

  describe('the header is drawn, not only computed', () => {
    it('draws the resolved date and the query above the list', () => {
      suggestionsFor('@tomorrow');

      const header = popup().querySelector('.date-suggest-header');
      expect(header).not.toBeNull();
      expect(header!.querySelector('.date-suggest-header-date')!.textContent).toMatch(/\d{4}/);
      expect(header!.querySelector('.date-suggest-header-query')!.textContent).toBe('@tomorrow');
      expect(header!.querySelector('[data-icon="calendar"]')).not.toBeNull();
    });

    it('marks the failure and says so', () => {
      suggestionsFor('@un alias vers une date');

      const header = popup().querySelector('.date-suggest-header')!;
      expect(header.classList.contains('is-error')).toBe(true);
      expect(header.querySelector('.date-suggest-header-date')!.textContent).toBe(
        i18n.t('suggest.header.unparsable')
      );
    });

    it('redraws rather than stacking, one header whatever the keystrokes', () => {
      suggestionsFor('@tomorrow');
      suggestionsFor('@yesterday');

      expect(popup().querySelectorAll('.date-suggest-header')).toHaveLength(1);
      expect(popup().querySelector('.date-suggest-header-query')!.textContent).toBe('@yesterday');
    });
  });

  describe('the held selection has its own row', () => {
    it('names the text and the key that gives it back', () => {
      holdSelection('selected text');
      suggestionsFor('selected text @tomorrow');

      const held = popup().querySelector('.date-suggest-held') as HTMLElement;
      expect(held).not.toBeNull();
      // The role label carries no class of its own — it has nothing to style
      // that the row does not already give it — so this is what holds it in
      // place: nothing else looks for it. On the node rather than the row's
      // text, which is what the class used to guarantee implicitly: its own
      // span, and the first of the row.
      expect(held.firstElementChild?.textContent).toBe(i18n.t('suggest.instructions.selection'));
      expect(held.textContent).toContain('selected text');
      expect(held.textContent).toContain('Esc');
      expect(held.textContent).toContain(i18n.t('suggest.givesItBack'));
    });

    it('sits under the header, which still names the date', () => {
      holdSelection('selected text');
      suggestionsFor('selected text @tomorrow');

      const rows = [...popup().children].map(el => el.className);
      expect(rows.indexOf('date-suggest-header')).toBeLessThan(rows.indexOf('date-suggest-held'));
      expect(popup().querySelector('.date-suggest-header-date')!.textContent).toMatch(/\d{4}/);
    });

    it('is absent with no capture', () => {
      suggestionsFor('@tomorrow');

      expect(popup().querySelector('.date-suggest-held')).toBeNull();
    });

    it('reads a multiline selection as one line, the way the alias will', () => {
      holdSelection('deux\nlignes');
      suggestionsFor('deux lignes @tomorrow');

      const held = popup().querySelector('.date-suggest-held')!;
      expect(held.textContent).toContain('deux lignes');
      expect(held.textContent).not.toContain('\n');
    });
  });

  describe('the footer link opens the picker on a click', () => {
    it('draws the picker action as a clickable link', () => {
      suggestionsFor('@tomorrow');

      const link = popup().querySelector('.date-suggest-open-picker') as HTMLElement;
      expect(link).not.toBeNull();
      expect(link.textContent).toBe(i18n.t('suggest.openPicker'));

      link.click();

      expect(plugin.showDatePickerFromTrigger).toHaveBeenCalled();
    });

    it('carries the expression through the click, as TAB does', () => {
      suggestionsFor('@mardi prochain');

      (popup().querySelector('.date-suggest-open-picker') as HTMLElement).click();

      const args = (plugin.showDatePickerFromTrigger as jest.Mock).mock.calls[0];
      expect(args[3]).toBe('mardi prochain');
    });

    it('names the keys beside the link', () => {
      suggestionsFor('@tomorrow');

      const keys = [...popup().querySelectorAll('.date-suggest-key')].map(
        el => el.textContent ?? ''
      );

      expect(keys.join(' ')).toContain('↵');
      expect(keys.join(' ')).toContain('Esc');
      expect(keys.join(' ')).not.toContain('Tab');
    });
  });
});
