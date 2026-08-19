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
import { I18nService } from '@/services/i18n-service';
import { presetName } from '@/i18n/preset-labels';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { translateWith } from '../../helpers/translate';

type DateAction = 'insert-text' | 'insert-daily-note' | 'open-daily-note';

describe('UnifiedDatePickerModal rendering (characterization)', () => {
  let app: App;
  let dateService: DateService;
  let formatterService: FormatterService;
  let nlpService: NLPService;
  let i18n: I18nService;
  let dailyNotesService: DailyNotesService;
  let settings: DateHelpersSettings;
  let datePresets: FormatPreset[];
  let onSelect: jest.Mock;
  let saveSettings: jest.Mock;

  beforeEach(() => {
    app = createMockApp();

    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    i18n = new I18nService('en');
    settings = { ...DEFAULT_SETTINGS };

    const mockI18nService = {
      getCurrentLocale: jest.fn().mockReturnValue('en-US'),
      t: jest.fn((key: string) => key),
      setLocale: jest.fn(),
    };

    nlpService = new NLPService(dateService, mockI18nService as never, settings);
    dailyNotesService = new DailyNotesService(app, formatterService, i18n, settings);
    datePresets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');
    onSelect = jest.fn();
    saveSettings = jest.fn().mockResolvedValue(undefined);
  });

  // The Modal mock attaches its container to the body, and no test calls
  // close(); without this, every file accumulates containers and any later
  // assertion on document.activeElement would depend on test order.
  afterEach(() => {
    document.body.replaceChildren();
  });

  function createModal(
    initialAction?: DateAction,
    initialNLPText?: string,
    selectionText?: string
  ): UnifiedDatePickerModal {
    return new UnifiedDatePickerModal(
      app,
      dateService,
      formatterService,
      nlpService,
      i18n,
      dailyNotesService,
      datePresets,
      settings,
      onSelect,
      saveSettings,
      initialAction,
      initialNLPText,
      selectionText
    );
  }

  function openModal(
    initialAction?: DateAction,
    initialNLPText?: string,
    selectionText?: string
  ): UnifiedDatePickerModal {
    const modal = createModal(initialAction, initialNLPText, selectionText);
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

  function monthNavButton(modal: UnifiedDatePickerModal, which: 'prev' | 'next'): HTMLButtonElement {
    const buttons = content(modal).querySelectorAll<HTMLButtonElement>('.date-picker-nav-button');
    const button = which === 'prev' ? buttons[0] : buttons[buttons.length - 1];
    if (!button) throw new Error('month nav button not found');
    return button;
  }

  function todayButton(modal: UnifiedDatePickerModal): HTMLButtonElement {
    const button = content(modal).querySelector<HTMLButtonElement>('.date-picker-today-button');
    if (!button) throw new Error('Today button not found');
    return button;
  }

  describe('renderModal structure', () => {
    it('renders modal class, 3 action buttons with active state, calendar, footer', async () => {
      const modal = openModal('insert-text');
      const el = content(modal);

      // Deliberate change to the characterization contract: the class used to
      // sit on contentEl, which *is* the `.modal-content`, so the stylesheet's
      // `.unified-date-picker-modal .modal-content` matched nothing and the
      // whole modal stylesheet was inert. It now sits on modalEl.
      expect(modal.modalEl.classList.contains('unified-date-picker-modal')).toBe(true);
      expect(el.classList.contains('unified-date-picker-modal')).toBe(false);

      const buttons = el.querySelectorAll('.action-button');
      expect(buttons).toHaveLength(3);
      expect(buttons[0].textContent).toContain('Insert as text');
      expect(buttons[1].textContent).toContain('Link to daily note');
      expect(buttons[2].textContent).toContain('Open daily note');
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

      // …and the DOM focus is actually on it. `is-focused` and `tabindex` only
      // say the cell is focusable; without an explicit focus() the browser
      // leaves focus on the first focusable element of the modal, which is an
      // action-tab button. Enter then reaches a button that re-renders the
      // modal, and typing reaches nothing at all.
      //
      // The focus is deferred by a turn — Obsidian focuses the modal itself
      // after onOpen() returns — so let that timer run first.
      await flushPromises();
      expect(document.activeElement).toBe(focusedCells[0]);

      // Footer: today button + format selector
      expect(el.querySelector('.date-picker-today-button')?.textContent).toBe('Today');
      expect(formatSelector(modal)).not.toBeNull();
    });

    it('does not focus a modal closed before the deferred focus runs', async () => {
      const modal = openModal('insert-text');
      const cell = content(modal).querySelector('.date-picker-day.is-focused');
      modal.onClose();

      await flushPromises();

      expect(document.activeElement).not.toBe(cell);
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
        expect(select.options[i].text).toBe(
          `${presetName(preset, translateWith(i18n))} (${example})`
        );
        // One literal, independent of the resolver: a wrong key prefix or a
        // wrong fallback order inside presetName would leave the line above green
        if (preset.id === 'locale-short') {
          expect(select.options[i].text).toBe(`Locale short (${example})`);
        }
      });
      expect(select.value).toBe('locale-long');
    });

    it('shows Typed text as first option for daily-note action with initial text', () => {
      settings.dailyNotesAliasPresetId = 'typed-text';
      const modal = openModal('insert-daily-note', 'tomorrow');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      expect(select.options[0].value).toBe('typed-text');
      expect(select.options[0].text).toBe('Typed text (tomorrow)');
      expect(select.options[0].selected).toBe(true);
      expect(select.options).toHaveLength(datePresets.length + 1);
    });

    it('does not show a text alias source for insert-text even with initial text', () => {
      const modal = openModal('insert-text', 'tomorrow');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');
      expect(select.options[0].value).not.toBe('typed-text');
      expect(select.options[0].value).not.toBe('selected-text');
      expect(select.options).toHaveLength(datePresets.length);
    });
  });

  describe('preview and insertion agree', () => {
    // The preview and the executor build the same wikilink from the same state.
    // Only one of them used to run the date validation, so the preview could
    // promise an alias the insertion then refused.
    it('does not promise an alias the insertion would refuse', async () => {
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';
      const modal = openModal('insert-daily-note', undefined, 'tomorrow');

      // The selection says "tomorrow"; the user then asks for another day
      typeNLP(modal, 'next friday');
      const promised = preview(modal).textContent ?? '';

      const parsed = modal.parseNLPExpression('next friday');
      await modal.selectDate(parsed!.date);
      const [inserted] = onSelect.mock.calls[0];

      expect(promised).toContain(inserted);
    });

    it('promises the alias the insertion does produce, on the date the text names', async () => {
      const modal = openModal('insert-daily-note', undefined, 'tomorrow');
      const parsed = modal.parseNLPExpression('tomorrow');

      typeNLP(modal, 'tomorrow');
      const promised = preview(modal).textContent ?? '';

      await modal.selectDate(parsed!.date);
      const [inserted] = onSelect.mock.calls[0];

      expect(promised).toContain(inserted);
      expect(inserted).toContain('|tomorrow]]');
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

    // Day moves and "today" only. A month or year move changes the view without
    // moving the focused day, so the day leaves the rendered grid entirely and
    // there is no cell to focus — pre-existing behaviour, unchanged here.
    it.each([
      ['ArrowRight', []],
      ['ArrowLeft', []],
      ['ArrowDown', []],
      ['ArrowUp', []],
      ['t', []],
    ] as Array<[string, string[]]>)(
      '%s with mods %p leaves the DOM focus on the newly focused day',
      async (key, mods) => {
        const modal = openModal('insert-text');
        await flushPromises();

        invokeKey(modal, mods, key);

        // renderModal() rebuilds the grid, destroying the element that held the
        // focus. Without restoring it the focus falls back to the modal, and
        // since the grid scrolls, a day moved out of view is never scrolled
        // back into it.
        const cell = content(modal).querySelector('.date-picker-day.is-focused');
        expect(cell).not.toBeNull();
        expect(document.activeElement).toBe(cell);
      }
    );

    it.each([['ArrowLeft'], ['ArrowRight'], ['ArrowUp'], ['ArrowDown']])(
      '%s passes through while typing in the NLP field',
      async key => {
        const modal = openModal('insert-text');
        await flushPromises();
        const input = nlpInput(modal);
        input.value = 'next friday';
        input.dispatchEvent(new Event('input'));
        input.focus();

        // Passing through matters more now that a redraw actively focuses a day
        // cell: without the guard, an arrow pressed mid-word cleared the field
        // *and* moved the keyboard focus out of it.
        expect(invokeKey(modal, [], key)).toBe(true);
        expect(nlpInput(modal).value).toBe('next friday');
        expect(document.activeElement).toBe(input);
      }
    );

    it.each([
      ['month navigation', (m: UnifiedDatePickerModal) => monthNavButton(m, 'next').click()],
      ['the Today button', (m: UnifiedDatePickerModal) => todayButton(m).click()],
    ] as Array<[string, (m: UnifiedDatePickerModal) => void]>)(
      'restores the focused day after %s, like the keyboard does',
      async (_label, act) => {
        const modal = openModal('insert-text');
        await flushPromises();

        act(modal);

        // The grid scrolls now, and a redraw rebuilds it with scrollTop 0. A
        // mouse path that does not re-focus leaves the target day below the
        // fold in a short window — the same defect the keyboard path fixed.
        const cell = content(modal).querySelector('.date-picker-day.is-focused');
        if (cell) expect(document.activeElement).toBe(cell);
      }
    );

    it('leaves no focused cell behind after a month move, and does not crash', () => {
      const modal = openModal('insert-text');
      // Pinned to mid-month, not left on today's date. The grid backfills up to
      // six days of the previous month (`calendar-grid.ts:37`), so a focused day
      // that happens to fall in that window stays rendered in the *next* month's
      // grid — and this assertion would fail on roughly one day in five.
      modal.setFocusedDay(DateTime.fromISO('2026-08-15'));
      modal.setViewMonth(DateTime.fromISO('2026-08-01'));

      expect(() => invokeKey(modal, [], 'PageDown')).not.toThrow();

      // Documents what is: the view month moved, the focused day did not follow
      // it, so nothing in the grid carries `is-focused`.
      expect(content(modal).querySelector('.date-picker-day.is-focused')).toBeNull();
    });

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

  describe('Typed text option lifecycle', () => {
    it('adds/relabels/removes the option as NLP text availability changes', () => {
      settings.dailyNotesAliasPresetId = 'typed-text';
      settings.dailyNotesAliasFallbackPresetId = 'iso8601';
      const modal = openModal('insert-daily-note');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      // No text yet: no typed-text option
      expect(select.options[0].value).not.toBe('typed-text');

      // Text appears: option added first and selected (configured as typed-text)
      typeNLP(modal, 'tomorrow');
      expect(select.options[0].value).toBe('typed-text');
      expect(select.options[0].text).toBe('Typed text (tomorrow)');
      expect(select.options[0].selected).toBe(true);

      // Label follows the text
      typeNLP(modal, 'next friday');
      expect(select.options[0].text).toBe('Typed text (next friday)');

      // Text cleared: option removed, fallback preset selected
      typeNLP(modal, '');
      expect(select.options[0].value).not.toBe('typed-text');
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
        expect(select.options[i].text).toBe(
          `${presetName(preset, translateWith(i18n))} (${example})`
        );
        // One literal, independent of the resolver: a wrong key prefix or a
        // wrong fallback order inside presetName would leave the line above green
        if (preset.id === 'locale-short') {
          expect(select.options[i].text).toBe(`Locale short (${example})`);
        }
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
