/**
 * @jest-environment jsdom
 *
 * The format selector lists the two text alias sources — the editor selection
 * and the picker's NLP field — ahead of the format presets, each only while its
 * own text exists.
 */

import { FormatSelector } from '@/ui/date-picker/format-selector';
import { DatePickerState } from '@/ui/date-picker/date-picker-state';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { I18nService } from '@/services/i18n-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { createMockApp } from '../../../helpers/mock-app';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE } from '@/types/alias-source';
import { DateAction } from '@/ui/date-picker/types';
import { translateWith } from '../../../helpers/translate';

describe('FormatSelector — text alias sources', () => {
  let settings: DateHelpersSettings;
  let presets: FormatPreset[];
  let dateService: DateService;
  let formatterService: FormatterService;
  let i18n: I18nService;
  let dailyNotesService: DailyNotesService;
  let saveSettings: jest.Mock;
  let onChange: jest.Mock;

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    presets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');
    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    i18n = new I18nService('en');
    dailyNotesService = new DailyNotesService(createMockApp(), formatterService, i18n, settings);
    saveSettings = jest.fn().mockResolvedValue(undefined);
    onChange = jest.fn();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  function build(opts: { action?: DateAction; selectionText?: string; typedText?: string }): {
    select: HTMLSelectElement;
    state: DatePickerState;
    selector: FormatSelector;
  } {
    const state = new DatePickerState(presets, settings, dateService, saveSettings, {
      initialAction: opts.action ?? 'insert-daily-note',
      selectionText: opts.selectionText,
      initialNLPText: opts.typedText,
    });

    // The modal puts every text through the parser before the selector reads
    // it, and a text that parsed to no date may alias any day. Without this the
    // labels here would show a fallback preset, which is not what the test is
    // about — `canUseAliasSourceForDate` has its own tests.
    if (opts.selectionText) state.setSelectionParseResult(null);
    if (opts.typedText) state.setNLPParseResult(null);

    const selector = new FormatSelector({
      state,
      t: translateWith(i18n),
      presets,
      settings,
      formatterService,
      dailyNotesService,
      onChange,
    });

    const footer = document.body.createEl('div');
    selector.render(footer);

    const select = footer.querySelector('select');
    if (!select) throw new Error('format selector missing');
    return { select: select as HTMLSelectElement, state, selector };
  }

  function renderSelector(opts: {
    action?: DateAction;
    selectionText?: string;
    typedText?: string;
  }): HTMLSelectElement {
    return build(opts).select;
  }

  /** Option values in DOM order */
  function values(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map(o => o.value);
  }

  describe('listing', () => {
    it('lists "Selected text" first when only a selection exists', () => {
      const select = renderSelector({ selectionText: 'réunion de cadrage' });

      expect(select.options[0].value).toBe(SELECTED_TEXT_SOURCE);
      expect(select.options[0].text).toMatch(/^\[\[.+\|réunion de cadrage\]\]$/);
      expect(values(select)).not.toContain(TYPED_TEXT_SOURCE);
      expect(select.options).toHaveLength(presets.length + 1);
    });

    it('lists "Typed text" when only NLP text exists', () => {
      const select = renderSelector({ typedText: 'point hebdo' });

      expect(select.options[0].value).toBe(TYPED_TEXT_SOURCE);
      expect(select.options[0].text).toMatch(/^\[\[.+\|point hebdo\]\]$/);
      expect(values(select)).not.toContain(SELECTED_TEXT_SOURCE);
      expect(select.options).toHaveLength(presets.length + 1);
    });

    it('lists both sources when both texts exist, selection first', () => {
      const select = renderSelector({
        selectionText: 'réunion de cadrage',
        typedText: 'point hebdo',
      });

      expect(values(select).slice(0, 2)).toEqual([SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE]);
      expect(select.options[0].text).toMatch(/^\[\[.+\|réunion de cadrage\]\]$/);
      expect(select.options[1].text).toMatch(/^\[\[.+\|point hebdo\]\]$/);
      expect(select.options).toHaveLength(presets.length + 2);
    });

    it('lists neither source when no text exists', () => {
      const select = renderSelector({});

      expect(values(select)).not.toContain(SELECTED_TEXT_SOURCE);
      expect(values(select)).not.toContain(TYPED_TEXT_SOURCE);
      expect(select.options).toHaveLength(presets.length);
    });

    it('lists neither source on the plain-text path, even with text', () => {
      const select = renderSelector({
        action: 'insert-text',
        selectionText: 'réunion de cadrage',
        typedText: 'tomorrow',
      });

      expect(values(select)).not.toContain(SELECTED_TEXT_SOURCE);
      expect(values(select)).not.toContain(TYPED_TEXT_SOURCE);
      expect(select.options).toHaveLength(presets.length);
    });
  });

  describe('the label promises what the insertion writes', () => {
    it('shows the alias as it will be written, not as it was selected', () => {
      // A selection containing a wikilink cannot go into one as is: the
      // insertion neutralises the brackets, and showing the raw text would
      // promise something else — the divergence the NLP preview already had.
      // (A line break would not prove it: `option.text` collapses those itself.)
      const select = renderSelector({ selectionText: 'voir [[note]] demain' });

      expect(select.options[0].text).toMatch(/^\[\[.+\|voir note demain\]\]$/);
    });

    it('leaves an ordinary selection alone', () => {
      const select = renderSelector({ selectionText: 'réunion de cadrage' });

      expect(select.options[0].text).toMatch(/^\[\[.+\|réunion de cadrage\]\]$/);
    });
  });

  describe('each option is labelled with the output it produces', () => {
    it('labels a format preset with the wikilink it would write', () => {
      const { select, state } = build({ selectionText: 'réunion de cadrage' });
      const iso = Array.from(select.options).find(o => o.value === 'iso8601');

      const day = state.focusedDay.toFormat('yyyy-MM-dd');
      expect(iso?.text).toBe(`[[${day}|${day}]]`);
    });

    it('labels a format preset with the plain text it would write', () => {
      const { select, state } = build({ action: 'insert-text' });
      const iso = Array.from(select.options).find(o => o.value === 'iso8601');

      expect(iso?.text).toBe(state.focusedDay.toFormat('yyyy-MM-dd'));
    });

    it('names no preset: the output is the whole label', () => {
      const select = renderSelector({ action: 'insert-text' });

      expect(
        Array.from(select.options)
          .map(o => o.text)
          .join(' ')
      ).not.toContain('ISO');
    });

    it('keeps the brackets and the path, and shortens a long alias alone', () => {
      const { select, state } = build({
        selectionText: 'réunion de cadrage et de lancement produit',
      });
      const day = state.focusedDay.toFormat('yyyy-MM-dd');

      expect(select.options[0].text).toBe(`[[${day}|réunion de cadrage…]]`);
    });

    it('shows the active output on the control, and keeps the order stable', () => {
      const { select, state, selector } = build({ selectionText: 'réunion de cadrage' });

      state.setSelectedPreset('iso8601');
      selector.updateExamples();
      selector.setValue('iso8601');

      const day = state.focusedDay.toFormat('yyyy-MM-dd');
      expect(select.options[select.selectedIndex].text).toBe(`[[${day}|${day}]]`);
      // The alias source still leads the list, active or not
      expect(select.options[0].value).toBe(SELECTED_TEXT_SOURCE);
    });

    it('relabels every option against the focused day', () => {
      const { select, state, selector } = build({ selectionText: 'réunion de cadrage' });

      state.setFocusedDay(state.focusedDay.plus({ days: 40 }));
      selector.updateExamples();

      const day = state.focusedDay.toFormat('yyyy-MM-dd');
      expect(select.options[0].text).toBe(`[[${day}|réunion de cadrage]]`);
      const iso = Array.from(select.options).find(o => o.value === 'iso8601');
      expect(iso?.text).toBe(`[[${day}|${day}]]`);
    });
  });

  describe('syncOptions — text appearing and disappearing after render', () => {
    // Every test above goes through render(), where the sources exist from the
    // start. syncOptions is the other half: it is what runs while the user types.

    it('never leaves the dropdown on a value it does not offer', () => {
      // The shipped default names `selected-text`; opened without a selection,
      // that source is not listed at all.
      settings.dailyNotesAliasPresetId = SELECTED_TEXT_SOURCE;
      const { select, state, selector } = build({});

      state.updateNLPText('next friday');
      selector.syncOptions();

      expect(select.selectedIndex).toBeGreaterThanOrEqual(0);
      expect(values(select)).toContain(select.value);
    });

    it('falls back on the typed source when the configured one has no text', () => {
      settings.dailyNotesAliasPresetId = SELECTED_TEXT_SOURCE;
      const { select, state, selector } = build({});

      state.updateNLPText('next friday');
      selector.syncOptions();

      // The user asked for their own words as the alias; only one source has any
      expect(select.value).toBe(TYPED_TEXT_SOURCE);
      expect(state.selectedAliasSource()).toBe(TYPED_TEXT_SOURCE);
    });

    it('adds and removes the typed source as its text comes and goes', () => {
      settings.dailyNotesAliasPresetId = TYPED_TEXT_SOURCE;
      settings.dailyNotesAliasFallbackPresetId = 'iso8601';
      const { select, state, selector } = build({});

      expect(values(select)).not.toContain(TYPED_TEXT_SOURCE);

      state.updateNLPText('point hebdo');
      state.setNLPParseResult(null);
      selector.syncOptions();
      expect(select.options[0].value).toBe(TYPED_TEXT_SOURCE);
      expect(select.options[0].text).toMatch(/^\[\[.+\|point hebdo\]\]$/);
      expect(select.value).toBe(TYPED_TEXT_SOURCE);

      state.updateNLPText('');
      selector.syncOptions();
      expect(values(select)).not.toContain(TYPED_TEXT_SOURCE);
      expect(select.value).toBe('iso8601');
    });

    it('returns to the no-text preset when the field is emptied, as the spec says', () => {
      // Spec `daily-notes-integration`, "Typed text disappears when cleared":
      // the selector switches to `dailyNotesAliasFallbackPresetId` if no
      // selection remains — whatever the with-text setting names.
      settings.dailyNotesAliasPresetId = 'iso8601';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';
      const { select, state, selector } = build({});

      state.updateNLPText('tomorrow');
      selector.syncOptions();
      expect(select.value).toBe('iso8601');

      state.updateNLPText('');
      selector.syncOptions();
      expect(select.value).toBe('locale-long');
    });

    it('never blanks the control, whatever preset the setting names', () => {
      // `dailyNotesAliasPresetId` is validated against every preset, but the
      // selector only lists date ones: a datetime id reaches setValue and
      // matches no option. Same failure as the blank dropdown, narrower door.
      settings.dailyNotesAliasPresetId = 'datetime-standard';
      const { select, state, selector } = build({});

      state.updateNLPText('tomorrow');
      selector.syncOptions();

      expect(select.selectedIndex).toBeGreaterThanOrEqual(0);
      expect(values(select)).toContain(select.value);
    });

    it('keeps the selection listed while the typed text comes and goes', () => {
      const { select, state, selector } = build({ selectionText: 'réunion de cadrage' });

      state.updateNLPText('tomorrow');
      selector.syncOptions();
      expect(values(select).slice(0, 2)).toEqual([SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE]);

      state.updateNLPText('');
      selector.syncOptions();
      expect(values(select)).toContain(SELECTED_TEXT_SOURCE);
      expect(values(select)).not.toContain(TYPED_TEXT_SOURCE);
      expect(select.value).toBe(SELECTED_TEXT_SOURCE);
    });
  });

  describe('pre-selection', () => {
    it('pre-selects "Selected text" whenever a selection exists', () => {
      const select = renderSelector({ selectionText: 'réunion de cadrage' });

      expect(select.options[0].selected).toBe(true);
      expect(select.value).toBe(SELECTED_TEXT_SOURCE);
    });

    it('pre-selects "Selected text" over the configured typed-text setting', () => {
      settings.dailyNotesAliasPresetId = TYPED_TEXT_SOURCE;
      const select = renderSelector({
        selectionText: 'réunion de cadrage',
        typedText: 'tomorrow',
      });

      expect(select.value).toBe(SELECTED_TEXT_SOURCE);
    });

    it('falls back to the configured preset when the setting names a source with no text', () => {
      settings.dailyNotesAliasPresetId = SELECTED_TEXT_SOURCE;
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';
      const select = renderSelector({});

      expect(select.value).toBe('locale-long');
    });

    it('honours the configured preset when text exists but no selection does', () => {
      settings.dailyNotesAliasPresetId = 'iso8601';
      const select = renderSelector({ typedText: 'tomorrow' });

      expect(select.value).toBe('iso8601');
    });
  });
});
