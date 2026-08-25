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

  /**
   * What the picker promises to write.
   *
   * The format selector is the preview surface now: every option is labelled
   * with the output it produces, so the active one says what confirming would
   * write. The open action offers no choice and hides the selector — there the
   * footer keeps a read-only line.
   */
  function preview(modal: UnifiedDatePickerModal): HTMLElement {
    const select = formatSelector(modal);
    if (select) return select.options[select.selectedIndex];
    const el = content(modal).querySelector<HTMLElement>('.date-picker-result');
    if (!el) throw new Error('no preview surface found');
    return el;
  }

  /** The failure on the left of the status row, if any */
  function statusError(modal: UnifiedDatePickerModal): HTMLElement | null {
    return content(modal).querySelector<HTMLElement>('.date-picker-status-error');
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

  function monthNavButton(
    modal: UnifiedDatePickerModal,
    which: 'prev' | 'next'
  ): HTMLButtonElement {
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
      // Icon only: the status row names the armed action, and every button
      // keeps its label as its accessible name.
      expect(buttons[0].getAttribute('aria-label')).toBe('Insert as text');
      expect(buttons[1].getAttribute('aria-label')).toBe('Link to daily note');
      expect(buttons[2].getAttribute('aria-label')).toBe('Open daily note');
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

      // The cell is MARKED focused, and stays keyboard-reachable. The DOM focus
      // itself goes to the expression field while NLP is on — see the block
      // 'the focus on open' below.
      await flushPromises();
      expect(document.activeElement).toBe(nlpInput(modal));

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

    // The expression is the fastest path into the picker, so it is what opens
    // ready to be typed into. Without NLP there is no field, and the day cell
    // keeps the focus it has always had.
    describe('the focus on open', () => {
      it('lands on the expression field while NLP is on', async () => {
        settings.enableNLP = true;
        const modal = openModal('insert-text');

        await flushPromises();

        expect(document.activeElement).toBe(nlpInput(modal));
      });

      it('puts the caret after an expression carried in', async () => {
        settings.enableNLP = true;
        const modal = openModal('insert-text', 'next monday');

        await flushPromises();

        const input = nlpInput(modal);
        expect(document.activeElement).toBe(input);
        expect(input.selectionStart).toBe('next monday'.length);
        expect(input.selectionEnd).toBe('next monday'.length);
      });

      it('lands on the marked day when NLP is off', async () => {
        settings.enableNLP = false;
        const modal = openModal('insert-text');
        const cell = content(modal).querySelector('.date-picker-day.is-focused');

        await flushPromises();

        expect(document.activeElement).toBe(cell);
      });
    });

    it('shows NLP input iff enableNLP is true', () => {
      settings.enableNLP = true;
      const withNLP = openModal('insert-text');
      expect(content(withNLP).querySelector('.nlp-input-container')).not.toBeNull();

      settings.enableNLP = false;
      const withoutNLP = openModal('insert-text');
      expect(content(withoutNLP).querySelector('.nlp-input-container')).toBeNull();
    });

    it('puts the field first and the tabs beside it', () => {
      settings.enableNLP = true;
      const modal = openModal('insert-text');
      const top = content(modal).querySelector('.date-picker-top')!;

      expect(top).not.toBeNull();
      // The field leads the row, the tabs follow it.
      expect(top.children[0].classList.contains('nlp-input-container')).toBe(true);
      expect(top.children[1].classList.contains('action-selector')).toBe(true);
      // And the row itself leads the modal.
      expect(content(modal).children[0]).toBe(top);
    });

    it('lets the placeholder describe the field, and nothing else', () => {
      settings.enableNLP = true;
      const modal = openModal('insert-text');
      const el = content(modal);

      const input = el.querySelector<HTMLInputElement>('.nlp-input-container input');
      expect(input!.placeholder).toBe('tomorrow, next monday, 3 days ago');
      // No Setting row beside it, and no preview line under it.
      expect(el.querySelector('.nlp-input-container .setting-item')).toBeNull();
      expect(el.querySelector('.nlp-preview')).toBeNull();
    });

    it('names the active action on the right of the status row', () => {
      const modal = openModal('insert-daily-note');
      const status = content(modal).querySelector('.date-picker-status')!;

      expect(status.querySelector('.date-picker-status-action')!.textContent).toBe(
        'Link to daily note'
      );
      // Nothing failed, so the left of the row says nothing.
      expect(status.querySelector('.date-picker-status-error')).toBeNull();
    });

    it('follows the tab the user picks', () => {
      const modal = openModal('insert-text');
      content(modal).querySelectorAll<HTMLButtonElement>('.action-button')[2].click();

      expect(content(modal).querySelector('.date-picker-status-action')!.textContent).toBe(
        'Open daily note'
      );
    });

    it('hides the format selector for open-daily-note', () => {
      const modal = openModal('open-daily-note');
      expect(formatSelector(modal)).toBeNull();
      // Today button still present
      expect(content(modal).querySelector('.date-picker-today-button')).not.toBeNull();
    });

    // The selector no longer names its presets: each option is labelled with
    // the output it would write, which is what makes it the preview surface.
    it('lists presets by their output, and selects the configured preset', () => {
      settings.defaultDatePresetId = 'locale-long';
      const modal = openModal('insert-text');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      expect(select.options).toHaveLength(datePresets.length);
      datePresets.forEach((preset, i) => {
        const example = formatterService.getFormatExample(preset.format, modal.getFocusedDay());
        expect(select.options[i].value).toBe(preset.id);
        expect(select.options[i].text).toBe(example);
      });
      // One literal, so a change of preset order or of the example resolver
      // cannot leave the loop above green on nothing
      const iso = Array.from(select.options).find(o => o.value === 'iso8601');
      expect(iso?.text).toBe(modal.getFocusedDay().toFormat('yyyy-MM-dd'));
      expect(select.value).toBe('locale-long');
    });

    it('shows Typed text as first option for daily-note action with initial text', () => {
      settings.dailyNotesAliasPresetId = 'typed-text';
      const modal = openModal('insert-daily-note', 'tomorrow');
      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');

      expect(select.options[0].value).toBe('typed-text');
      expect(select.options[0].text).toBe(
        `[[${modal.getFocusedDay().toFormat('yyyy-MM-dd')}|tomorrow]]`
      );
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

    // A selection reading as a date moves the calendar off today. Leaving the
    // field empty left that move unexplained: the picker sat on tomorrow with
    // nothing on screen saying why.
    describe('a selection that reads as a date fills the field', () => {
      it('shows the selection in the field, on the day it names', () => {
        const modal = openModal('insert-daily-note', undefined, 'tomorrow');

        expect(nlpInput(modal).value).toBe('tomorrow');
        expect(content(modal).querySelector('.date-picker-day.is-focused')?.textContent).toBe(
          String(dateService.now().plus({ days: 1 }).day)
        );
      });

      it('leaves the field empty when the selection reads as no date', () => {
        const modal = openModal('insert-daily-note', undefined, 'kickoff meeting');

        expect(nlpInput(modal).value).toBe('');
        expect(statusError(modal)).toBeNull();
      });

      // One text, one option. The two sources would render the same alias, and
      // a second entry saying the same thing is a choice with no difference.
      it('does not list the same text twice as an alias source', () => {
        const modal = openModal('insert-daily-note', undefined, 'tomorrow');
        const select = formatSelector(modal);
        if (!select) throw new Error('format selector missing');

        const sources = Array.from(select.options)
          .map(o => o.value)
          .filter(v => v === 'selected-text' || v === 'typed-text');
        expect(sources).toEqual(['selected-text']);
      });

      // The dedup drops the typed source when it repeats the selection. It must
      // not drop the source the user explicitly chose: the two write the same
      // alias, so falling back to a format preset answers a question nobody
      // asked, while the menu still shows a text source.
      it('never strands a chosen text source on a format alias', () => {
        settings.dailyNotesAliasPresetId = 'typed-text';
        const modal = openModal('insert-daily-note', undefined, 'tomorrow');
        typeNLP(modal, 'kickoff');
        const select = formatSelector(modal);
        if (!select) throw new Error('format selector missing');
        select.value = 'typed-text';
        select.dispatchEvent(new Event('change'));
        typeNLP(modal, 'tomorrow');

        expect(preview(modal).textContent).toContain('|tomorrow]]');
        expect(formatSelector(modal)!.value).toBe('selected-text');
      });

      it('lets an expression carried in win over the selection', () => {
        const modal = openModal('insert-daily-note', 'next monday', 'tomorrow');

        expect(nlpInput(modal).value).toBe('next monday');
      });
    });
  });

  // Four findings from the manual pass of 2026-08-22. The first three are what
  // the eye caught that no assertion did; the fourth is older than this change.
  describe('a parse failure is honest', () => {
    it('marks the field itself, not only the status row', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'nxt fridy');

      expect(statusError(modal)).not.toBeNull();
      expect(nlpInput(modal).classList.contains('is-error')).toBe(true);
    });

    it('takes the mark off as soon as the expression recovers', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'nxt fridy');
      typeNLP(modal, 'next friday');

      expect(statusError(modal)).toBeNull();
      expect(nlpInput(modal).classList.contains('is-error')).toBe(false);
    });

    it('takes the mark off when the field is emptied', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'nxt fridy');
      typeNLP(modal, '');

      expect(nlpInput(modal).classList.contains('is-error')).toBe(false);
    });

    // The result line is pinned now. On main the failure REPLACED the preview,
    // so no stale text could stand; here it is written elsewhere, and the line
    // kept promising a link the insertion would not write.
    it('keeps the result line showing what would really be inserted', () => {
      settings.dailyNotesAliasPresetId = 'typed-text';
      const modal = openModal('insert-daily-note');
      typeNLP(modal, 'next frday');

      expect(preview(modal).textContent).toContain('|next frday]]');
    });
  });

  // Older than this change: `syncOptions` knows how to relabel, but its caller
  // only ran it when the text flipped between empty and non-empty. The label
  // froze on the first character typed — `Typed text (n)` for `next frday`.
  describe('the alias source label follows the field', () => {
    it('relabels on every keystroke, not only the first', () => {
      settings.dailyNotesAliasPresetId = 'typed-text';
      const modal = openModal('insert-daily-note');
      typeNLP(modal, 'n');
      typeNLP(modal, 'next frday');

      const select = formatSelector(modal);
      if (!select) throw new Error('format selector missing');
      const typed = Array.from(select.options).find(o => o.value === 'typed-text');
      expect(typed?.text).toBe(`[[${modal.getFocusedDay().toFormat('yyyy-MM-dd')}|next frday]]`);
    });
  });

  // The field is rendered BEFORE the status row and the footer, and it calls
  // back into the owner as it restores its text. The failure was written into a
  // status row that did not exist yet — or, on a redraw, into the detached one.
  // The border reddened and nothing said why.
  describe('a failure survives the field being rebuilt', () => {
    it('states the failure for an expression carried in from the popup', () => {
      const modal = openModal('insert-text', 'nxt fridy');

      expect(nlpInput(modal).classList.contains('is-error')).toBe(true);
      expect(statusError(modal)).not.toBeNull();
    });

    it('keeps the failure when another action tab is picked', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'nxt fridy');

      content(modal).querySelectorAll<HTMLButtonElement>('.action-button')[1].click();

      expect(nlpInput(modal).classList.contains('is-error')).toBe(true);
      expect(statusError(modal)).not.toBeNull();
    });

    // Today is a calendar-driven interaction: it drops the expression on
    // purpose. So the failure must go WITH it — the field empties, and neither
    // the line nor the red border may outlive the text that caused them.
    it('takes the failure away with the expression on Today', () => {
      const modal = openModal('insert-text');
      typeNLP(modal, 'nxt fridy');

      todayButton(modal).click();

      expect(nlpInput(modal).value).toBe('');
      expect(nlpInput(modal).classList.contains('is-error')).toBe(false);
      expect(statusError(modal)).toBeNull();
    });
  });

  // Four paths write the result line; three read the focused day and one read
  // the parsed instant. They agree today only because `main.ts` hands the picker
  // date presets alone, and a date format shows no time — so the divergence was
  // invisible rather than absent. Pinned with a datetime preset, which is what
  // it would take to make it show.
  describe('the result line reads one clock', () => {
    it('shows the focused day, not the instant the expression parsed to', () => {
      const withTime = DEFAULT_FORMAT_PRESETS.filter(p => p.id === 'datetime-standard');
      datePresets = withTime;
      settings.defaultDatePresetId = 'datetime-standard';
      const modal = openModal('insert-text');
      typeNLP(modal, 'tomorrow at 2pm');

      const jour = dateService.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');
      expect(preview(modal).textContent).toBe(`${jour} 00:00:00`);
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

    // 't' left that list when the picker began opening on the field: it now
    // yields to the field whatever the field holds, so it never moves the
    // focus while NLP is on. With NLP off there is no field to yield to, and
    // it lands on the day like the arrows do.
    it('t lands on the newly focused day when NLP is off', async () => {
      settings.enableNLP = false;
      const modal = openModal('insert-text');
      await flushPromises();

      invokeKey(modal, [], 't');

      const cell = content(modal).querySelector('.date-picker-day.is-focused');
      expect(cell).not.toBeNull();
      expect(document.activeElement).toBe(cell);
    });

    it('t leaves the focus in the field while NLP is on', async () => {
      const modal = openModal('insert-text');
      await flushPromises();
      const input = nlpInput(modal);

      invokeKey(modal, [], 't');

      expect(document.activeElement).toBe(input);
    });

    // An empty field has no word to protect, and the picker now opens with the
    // focus inside it. Without this, the arrows would be dead on open and the
    // calendar unreachable by keyboard until the user left the field.
    it.each([['ArrowLeft'], ['ArrowRight'], ['ArrowUp'], ['ArrowDown']])(
      '%s moves the day while the focused NLP field is empty',
      async key => {
        const modal = openModal('insert-text');
        await flushPromises();
        const input = nlpInput(modal);
        expect(document.activeElement).toBe(input);
        expect(input.value).toBe('');

        expect(invokeKey(modal, [], key)).toBe(false);
      }
    );

    // 't' yields whenever the field has the focus, empty or not: `today`,
    // `tomorrow` and `thursday` all start with it, and a jump to today instead
    // of a typed letter makes the field unusable from its first keystroke.
    // The picker opens with the focus in the field, so every calendar shortcut
    // is now reachable mid-word. Each of these clears the expression through
    // `clearNLPInput()` and moves the focus onto a day cell: the user loses
    // both their text and their place. `Home` and `Mod+arrow` are text-editing
    // keys on macOS — `Cmd+←` is "start of line" — so they are not exotic.
    it.each([
      ['Home', []],
      ['PageDown', []],
      ['PageUp', []],
      ['ArrowLeft', ['Mod']],
      ['ArrowRight', ['Mod']],
      ['ArrowUp', ['Mod']],
      ['ArrowDown', ['Mod']],
    ] as Array<[string, string[]]>)(
      '%s with mods %p leaves a typed expression alone',
      async (key, mods) => {
        const modal = openModal('insert-text');
        await flushPromises();
        const input = nlpInput(modal);
        input.value = 'next friday';
        input.dispatchEvent(new Event('input'));
        input.focus();

        expect(invokeKey(modal, mods, key)).toBe(true);
        expect(nlpInput(modal).value).toBe('next friday');
        expect(document.activeElement).toBe(input);
      }
    );

    // …and they keep their calendar meaning while the field is empty, which is
    // the state the picker opens in.
    it.each([
      ['Home', []],
      ['PageDown', []],
      ['PageUp', []],
      ['ArrowLeft', ['Mod']],
      ['ArrowRight', ['Mod']],
      ['ArrowUp', ['Mod']],
      ['ArrowDown', ['Mod']],
    ] as Array<[string, string[]]>)(
      '%s with mods %p still moves the calendar from an empty field',
      async (key, mods) => {
        const modal = openModal('insert-text');
        await flushPromises();
        expect(nlpInput(modal).value).toBe('');

        expect(invokeKey(modal, mods, key)).toBe(false);
      }
    );

    it('t passes through to an empty focused NLP field', async () => {
      const modal = openModal('insert-text');
      await flushPromises();
      expect(nlpInput(modal).value).toBe('');

      expect(invokeKey(modal, [], 't')).toBe(true);
    });

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
    it('says nothing until something fails, then stops saying it', () => {
      settings.defaultDatePresetId = 'iso8601';
      const modal = openModal('insert-text');
      const today = dateService.now().startOf('day');

      // Nothing typed: no failure, and the line already shows today's output.
      expect(statusError(modal)).toBeNull();
      expect(preview(modal).textContent).toBe(today.toFormat('yyyy-MM-dd'));

      typeNLP(modal, 'xyzzy gibberish');
      expect(statusError(modal)!.textContent).toBe('Could not parse date');

      // It resolves again: the failure goes, and nothing names the date in
      // words — the calendar marks it. The line shows the output for the new
      // day, and nothing else.
      //
      // It used to assert the absence of a `✓`, a tick a removed renderer drew.
      // No code has written one since, so the assertion could no longer fail.
      typeNLP(modal, 'tomorrow');
      expect(statusError(modal)).toBeNull();
      expect(preview(modal).textContent).toBe(today.plus({ days: 1 }).toFormat('yyyy-MM-dd'));

      typeNLP(modal, '');
      expect(statusError(modal)).toBeNull();
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
      expect(preview(modal).textContent).toBe(tomorrow.toFormat('yyyy-MM-dd'));

      modal.setSelectedAction('open-daily-note');
      typeNLP(modal, 'tomorrow');
      expect(preview(modal).textContent).toContain('Open: ');
    });

    it('restores NLP text across re-renders until explicitly cleared', () => {
      const modal = openModal('insert-text', 'tomorrow');
      expect(nlpInput(modal).value).toBe('tomorrow');
      expect(statusError(modal)).toBeNull();

      // Full re-render (e.g. via action change) restores the text
      modal.setSelectedAction('insert-daily-note');
      (modal as unknown as { renderModal: () => void }).renderModal();
      expect(nlpInput(modal).value).toBe('tomorrow');

      // Explicit clear: text must NOT come back on re-render
      typeNLP(modal, '');
      (modal as unknown as { renderModal: () => void }).renderModal();
      expect(nlpInput(modal).value).toBe('');
      expect(statusError(modal)).toBeNull();

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
      expect(select.options[0].text).toBe(
        `[[${modal.getFocusedDay().toFormat('yyyy-MM-dd')}|tomorrow]]`
      );
      expect(select.options[0].selected).toBe(true);

      // Label follows the text
      typeNLP(modal, 'next friday');
      expect(select.options[0].text).toBe(
        `[[${modal.getFocusedDay().toFormat('yyyy-MM-dd')}|next friday]]`
      );

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
        expect(select.options[i].text).toBe(example);
        // One literal, independent of the example resolver: a label built
        // from the wrong day would leave the line above green
        if (preset.id === 'iso8601') {
          expect(select.options[i].text).toBe(newDay.toFormat('yyyy-MM-dd'));
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
