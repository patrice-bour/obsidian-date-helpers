/**
 * @jest-environment jsdom
 *
 * Characterization tests for UnifiedDatePickerModal rendering, keyboard
 * map, and NLP preview behavior. Written BEFORE the modal decomposition (task 6 of refactor-ui-architecture)
 * to pin the exact DOM/interaction contract; they must keep passing
 * unmodified through the refactor.
 */

import { App } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import { DateTime } from 'luxon';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

type DateAction = 'insert-text' | 'insert-daily-note' | 'open-daily-note';

describe('UnifiedDatePickerModal rendering (characterization)', () => {
  let app: App;
  let dateService: DateService;
  let formatterService: FormatterService;
  let nlpService: NLPService;
  let dailyNotesService: DailyNotesService;
  let settings: DateHelpersSettings;
  let datePresets: FormatPreset[];
  let onSelect: jest.Mock;
  let saveSettings: jest.Mock;

  beforeEach(() => {
    app = createMockApp();

    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    settings = { ...DEFAULT_SETTINGS };

    const mockI18nService = {
      getCurrentLocale: jest.fn().mockReturnValue('en-US'),
      t: jest.fn((key: string) => key),
      setLocale: jest.fn(),
    };

    nlpService = new NLPService(dateService, mockI18nService as never, settings);
    dailyNotesService = new DailyNotesService(app, formatterService, settings);
    datePresets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');
    onSelect = jest.fn();
    saveSettings = jest.fn().mockResolvedValue(undefined);
  });

  function createModal(
    initialAction?: DateAction,
    initialNLPText?: string
  ): UnifiedDatePickerModal {
    return new UnifiedDatePickerModal(
      app,
      dateService,
      formatterService,
      nlpService,
      dailyNotesService,
      datePresets,
      settings,
      onSelect,
      saveSettings,
      initialAction,
      initialNLPText
    );
  }

  function openModal(initialAction?: DateAction, initialNLPText?: string): UnifiedDatePickerModal {
    const modal = createModal(initialAction, initialNLPText);
    modal.onOpen();
    return modal;
  }

  function content(modal: UnifiedDatePickerModal): HTMLElement {
    return modal.contentEl as HTMLElement;
  }

  function nlpInput(modal: UnifiedDatePickerModal): HTMLInputElement {
    const input = content(modal).querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error('NLP input not found');
    return input;
  }

  function typeNLP(modal: UnifiedDatePickerModal, text: string): void {
    const input = nlpInput(modal);
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function preview(modal: UnifiedDatePickerModal): HTMLElement {
    const el = content(modal).querySelector<HTMLElement>('.nlp-preview');
    if (!el) throw new Error('NLP preview not found');
    return el;
  }

  function formatSelector(modal: UnifiedDatePickerModal): HTMLSelectElement | null {
    return content(modal).querySelector<HTMLSelectElement>('.date-picker-format-selector');
  }

  type KeyHandler = (evt?: unknown) => boolean | void;
  function keyBindings(modal: UnifiedDatePickerModal): Array<[string[], string, KeyHandler]> {
    const scope = (modal as unknown as { scope: { register: jest.Mock } }).scope;
    return scope.register.mock.calls as Array<[string[], string, KeyHandler]>;
  }

  function invokeKey(modal: UnifiedDatePickerModal, mods: string[], key: string): boolean | void {
    const binding = keyBindings(modal).find(
      ([m, k]) => k === key && m.length === mods.length && mods.every(mod => m.includes(mod))
    );
    if (!binding) throw new Error(`No binding for ${mods.join('+')}+${key}`);
    return binding[2]();
  }

  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  describe('renderModal structure', () => {
    it('renders modal class, 3 action buttons with active state, calendar, footer', () => {
      const modal = openModal('insert-text');
      const el = content(modal);

      expect(el.classList.contains('unified-date-picker-modal')).toBe(true);

      const buttons = el.querySelectorAll('.action-button');
      expect(buttons).toHaveLength(3);
      expect(buttons[0].textContent).toContain('Insert as Text');
      expect(buttons[1].textContent).toContain('Link to Daily Note');
      expect(buttons[2].textContent).toContain('Open Daily Note');
      expect(buttons[0].classList.contains('is-active')).toBe(true);
      expect(buttons[1].classList.contains('is-active')).toBe(false);

      // Header shows current month/year
      const monthYear = el.querySelector('.date-picker-month-year');
      const expected = modal.getViewMonth().toLocaleString({ month: 'long', year: 'numeric' });
      expect(monthYear?.textContent).toBe(expected);

      // 7 day labels, 42 day cells
      expect(el.querySelectorAll('.date-picker-day-label')).toHaveLength(7);
      expect(el.querySelectorAll('.date-picker-day')).toHaveLength(42);

      // Today is marked exactly once and focused initially
      const todayCells = el.querySelectorAll('.date-picker-day.is-today');
      expect(todayCells).toHaveLength(1);
      const focusedCells = el.querySelectorAll('.date-picker-day.is-focused');
      expect(focusedCells).toHaveLength(1);
      expect(focusedCells[0]).toBe(todayCells[0]);
      expect(focusedCells[0].getAttribute('tabindex')).toBe('0');

      // Footer: today button + format selector
      expect(el.querySelector('.date-picker-today-button')?.textContent).toBe('Today');
      expect(formatSelector(modal)).not.toBeNull();
    });

    it('shows NLP input iff enableNLP is true', () => {
      settings.enableNLP = true;
      const withNLP = openModal('insert-text');
      expect(content(withNLP).querySelector('.nlp-input-container')).not.toBeNull();
      expect(preview(withNLP).textContent).toBe('Enter a date expression to see preview');
      expect(preview(withNLP).classList.contains('nlp-preview-empty')).toBe(true);

      settings.enableNLP = false;
      const withoutNLP = openModal('insert-text');
      expect(content(withoutNLP).querySelector('.nlp-input-container')).toBeNull();
    });

    it('hides the format selector for open-daily-note', () => {
      const modal = openModal('open-daily-note');
      expect(formatSelector(modal)).toBeNull();
      // Today button still present
      expect(content(modal).querySelector('.date-picker-today-button')).not.toBeNull();
    });

    it('lists presets as "Name (example)" and selects the configured preset', () => {
      settings.defaultDatePresetId = 'locale-long';
      const modal = openModal('insert-text');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      expect(select.options).toHaveLength(datePresets.length);
      datePresets.forEach((preset, i) => {
        const example = formatterService.getFormatExample(preset.format, modal.getFocusedDay());
        expect(select.options[i].value).toBe(preset.id);
        expect(select.options[i].text).toBe(`${preset.name} (${example})`);
      });
      expect(select.value).toBe('locale-long');
    });

    it('shows Original Text as first option for daily-note action with initial text', () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      const modal = openModal('insert-daily-note', 'tomorrow');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      expect(select.options[0].value).toBe('original-text');
      expect(select.options[0].text).toBe('Original Text (tomorrow)');
      expect(select.options[0].selected).toBe(true);
      expect(select.options).toHaveLength(datePresets.length + 1);
    });

    it('does not show Original Text for insert-text even with initial text', () => {
      const modal = openModal('insert-text', 'tomorrow');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');
      expect(select.options[0].value).not.toBe('original-text');
      expect(select.options).toHaveLength(datePresets.length);
    });
  });

  describe('day grid re-render keeps footer last', () => {
    it('inserts the re-rendered grid before the footer after NLP preview update', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'tomorrow');

      const el = content(modal);
      const children = Array.from(el.children);
      const gridIndex = children.findIndex(c => c.classList.contains('date-picker-day-grid'));
      const footerIndex = children.findIndex(c => c.classList.contains('date-picker-footer'));
      expect(gridIndex).toBeGreaterThan(-1);
      expect(footerIndex).toBe(gridIndex + 1);
      // Exactly one grid (old one removed)
      expect(el.querySelectorAll('.date-picker-day-grid')).toHaveLength(1);
    });
  });

  describe('keyboard map', () => {
    it('registers exactly the 13 expected bindings', () => {
      const modal = openModal('insert-text');
      const bindings = keyBindings(modal).map(([mods, key]) => `${mods.join('+')}:${key}`);
      expect(bindings).toEqual([
        ':ArrowRight',
        ':ArrowLeft',
        ':ArrowDown',
        ':ArrowUp',
        ':Enter',
        ':PageDown',
        ':PageUp',
        ':Home',
        'Mod:ArrowDown',
        'Mod:ArrowUp',
        'Mod:ArrowLeft',
        'Mod:ArrowRight',
        ':t',
      ]);
    });

    it.each([
      ['ArrowRight', [], { days: 1 }],
      ['ArrowLeft', [], { days: -1 }],
      ['ArrowDown', [], { weeks: 1 }],
      ['ArrowUp', [], { weeks: -1 }],
    ] as Array<[string, string[], Record<string, number>]>)(
      '%s moves focused day and returns false',
      (key, mods, delta) => {
        const modal = openModal('insert-text');
        const before = modal.getFocusedDay();
        const result = invokeKey(modal, mods, key);
        expect(result).toBe(false);
        expect(modal.getFocusedDay().toISODate()).toBe(before.plus(delta).toISODate());
      }
    );

    it.each([
      ['PageDown', [], { months: 1 }],
      ['PageUp', [], { months: -1 }],
      ['ArrowDown', ['Mod'], { months: 1 }],
      ['ArrowUp', ['Mod'], { months: -1 }],
      ['ArrowRight', ['Mod'], { years: 1 }],
      ['ArrowLeft', ['Mod'], { years: -1 }],
    ] as Array<[string, string[], Record<string, number>]>)(
      '%s with mods %p moves view month and returns false',
      (key, mods, delta) => {
        const modal = openModal('insert-text');
        const before = modal.getViewMonth();
        const result = invokeKey(modal, mods, key);
        expect(result).toBe(false);
        expect(modal.getViewMonth().toISODate()).toBe(before.plus(delta).toISODate());
      }
    );

    it('Home and t jump to today', () => {
      const modal = openModal('insert-text');
      modal.setFocusedDay(modal.getFocusedDay().plus({ months: 2 }));
      invokeKey(modal, [], 'Home');
      const today = dateService.now().startOf('day');
      expect(modal.getFocusedDay().toISODate()).toBe(today.toISODate());

      modal.setFocusedDay(modal.getFocusedDay().plus({ months: 2 }));
      invokeKey(modal, [], 't');
      expect(modal.getFocusedDay().toISODate()).toBe(today.toISODate());
    });

    it('t passes through (returns true) while typing in the NLP field', () => {
      const modal = openModal('insert-text');
      const input = nlpInput(modal);
      document.body.appendChild(content(modal));
      input.focus();
      const before = modal.getFocusedDay();
      modal.setFocusedDay(before.plus({ months: 1 }));
      const result = invokeKey(modal, [], 't');
      expect(result).toBe(true);
      // Focused day unchanged by the passthrough
      expect(modal.getFocusedDay().toISODate()).toBe(before.plus({ months: 1 }).toISODate());
    });

    it('Enter selects the focused day and emits the formatted result', async () => {
      settings.defaultDatePresetId = 'iso8601';
      const modal = openModal('insert-text');
      const focused = modal.getFocusedDay();
      const result = invokeKey(modal, [], 'Enter');
      expect(result).toBe(false);
      await flushPromises();
      expect(onSelect).toHaveBeenCalledWith(focused.toFormat('yyyy-MM-dd'), 'insert-text');
    });
  });

  describe('NLP preview transitions', () => {
    it('empty → error → success class transitions', () => {
      const modal = openModal('insert-text');
      const previewEl = preview(modal);

      expect(previewEl.classList.contains('nlp-preview-empty')).toBe(true);

      typeNLP(modal, 'xyzzy gibberish');
      expect(previewEl.textContent).toBe('Could not parse date');
      expect(previewEl.classList.contains('nlp-preview-error')).toBe(true);
      expect(previewEl.classList.contains('nlp-preview-empty')).toBe(false);

      typeNLP(modal, 'tomorrow');
      expect(previewEl.classList.contains('nlp-preview-success')).toBe(true);
      expect(previewEl.classList.contains('nlp-preview-error')).toBe(false);
      expect(previewEl.textContent?.startsWith('✓')).toBe(true);

      typeNLP(modal, '');
      expect(previewEl.textContent).toBe('Enter a date expression to see preview');
      expect(previewEl.classList.contains('nlp-preview-empty')).toBe(true);
      expect(previewEl.classList.contains('nlp-preview-success')).toBe(false);
    });

    it('moves the focused day to the parsed date', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'tomorrow');
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
      expect(modal.getFocusedDay().toISODate()).toBe(tomorrow.toISODate());
    });

    it('preview follows the selected action (text vs wikilink vs open)', () => {
      settings.defaultDatePresetId = 'iso8601';
      const modal = openModal('insert-text');
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');

      typeNLP(modal, 'tomorrow');
      expect(preview(modal).textContent).toBe(`✓  ${tomorrow.toFormat('yyyy-MM-dd')}`);

      modal.setSelectedAction('open-daily-note');
      typeNLP(modal, 'tomorrow');
      expect(preview(modal).textContent).toContain('Open: ');
    });

    it('restores NLP text across re-renders until explicitly cleared', () => {
      const modal = openModal('insert-text', 'tomorrow');
      expect(nlpInput(modal).value).toBe('tomorrow');
      expect(preview(modal).classList.contains('nlp-preview-success')).toBe(true);

      // Full re-render (e.g. via action change) restores the text
      modal.setSelectedAction('insert-daily-note');
      (modal as unknown as { renderModal: () => void }).renderModal();
      expect(nlpInput(modal).value).toBe('tomorrow');

      // Explicit clear: text must NOT come back on re-render
      typeNLP(modal, '');
      (modal as unknown as { renderModal: () => void }).renderModal();
      expect(nlpInput(modal).value).toBe('');
      expect(preview(modal).classList.contains('nlp-preview-empty')).toBe(true);

      // Typing again resets the cleared flag
      typeNLP(modal, 'next monday');
      (modal as unknown as { renderModal: () => void }).renderModal();
      expect(nlpInput(modal).value).toBe('next monday');
    });
  });

  describe('Original Text option lifecycle', () => {
    it('adds/relabels/removes the option as NLP text availability changes', () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'iso8601';
      const modal = openModal('insert-daily-note');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      // No text yet: no original-text option
      expect(select.options[0].value).not.toBe('original-text');

      // Text appears: option added first and selected (configured as original-text)
      typeNLP(modal, 'tomorrow');
      expect(select.options[0].value).toBe('original-text');
      expect(select.options[0].text).toBe('Original Text (tomorrow)');
      expect(select.options[0].selected).toBe(true);

      // Label follows the text
      typeNLP(modal, 'next friday');
      expect(select.options[0].text).toBe('Original Text (next friday)');

      // Text cleared: option removed, fallback preset selected
      typeNLP(modal, '');
      expect(select.options[0].value).not.toBe('original-text');
      expect(select.value).toBe('iso8601');
    });
  });

  describe('format selector interactions', () => {
    it('persists preset choice per action and calls saveSettings', () => {
      const modal = openModal('insert-text');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      select.value = 'locale-long';
      select.dispatchEvent(new Event('change'));

      expect(settings.defaultDatePresetId).toBe('locale-long');
      expect(modal.getSelectedPreset().id).toBe('locale-long');
      expect(saveSettings).toHaveBeenCalled();
    });

    it('updates option examples when the focused day changes', () => {
      const modal = openModal('insert-text');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      const newDay = modal.getFocusedDay().plus({ days: 5 });
      modal.setFocusedDay(newDay);

      datePresets.forEach((preset, i) => {
        const example = formatterService.getFormatExample(preset.format, newDay);
        expect(select.options[i].text).toBe(`${preset.name} (${example})`);
      });
    });
  });

  describe('mouse interactions', () => {
    it('clicking an action button switches action and re-renders', () => {
      const modal = openModal('insert-text');
      const buttons = content(modal).querySelectorAll<HTMLButtonElement>('.action-button');
      buttons[2].click();

      expect(modal.getSelectedAction()).toBe('open-daily-note');
      expect(settings.lastUsedAction).toBe('open-daily-note');
      // Re-rendered: format selector hidden for open-daily-note
      expect(formatSelector(modal)).toBeNull();
      const refreshed = content(modal).querySelectorAll('.action-button');
      expect(refreshed[2].classList.contains('is-active')).toBe(true);
    });

    it('clicking a day cell selects that date', async () => {
      settings.defaultDatePresetId = 'iso8601';
      const modal = openModal('insert-text');
      const focusedCell = content(modal).querySelector<HTMLElement>('.date-picker-day.is-focused');
      if (!focusedCell) throw new Error('focused day cell missing');

      focusedCell.click();
      await flushPromises();
      expect(onSelect).toHaveBeenCalledWith(
        modal.getFocusedDay().toFormat('yyyy-MM-dd'),
        'insert-text'
      );
    });

    it('Today button jumps to today and re-renders', () => {
      const modal = openModal('insert-text');
      modal.setViewMonth(modal.getViewMonth().plus({ months: 3 }));
      (modal as unknown as { renderModal: () => void }).renderModal();

      const todayButton = content(modal).querySelector<HTMLButtonElement>(
        '.date-picker-today-button'
      );
      todayButton?.click();

      const today = dateService.now().startOf('day');
      expect(modal.getFocusedDay().toISODate()).toBe(today.toISODate());
      expect(modal.getViewMonth().toISODate()).toBe(today.startOf('month').toISODate());
    });
  });

  describe('DateTime sanity', () => {
    it('keeps view month aligned with focused day across month boundaries', () => {
      const modal = openModal('insert-text');
      const lastDayOfMonth = modal.getViewMonth().endOf('month').startOf('day');
      modal.setFocusedDay(lastDayOfMonth);
      invokeKey(modal, [], 'ArrowRight');
      expect(modal.getFocusedDay().day).toBe(1);
      expect(modal.getViewMonth().month).toBe(lastDayOfMonth.plus({ days: 1 }).month);
      expect(DateTime.isDateTime(modal.getViewMonth())).toBe(true);
    });
  });
});
