/**
 * @jest-environment jsdom
 *
 * What a selection becomes once a trigger has been typed over it.
 *
 * The keystroke would destroy the selection before any plugin code runs, so it
 * is called off on `keydown`: the text stays in the note, and a separating
 * space and the trigger are written after it. From there the contract splits —
 * the kept text holds the alias, and whatever is typed after the trigger only
 * names the date. Validating replaces the two together; dismissing takes back
 * the trigger and leaves the text.
 *
 * Positions are the same throughout: `réunion de lancement` is 20 characters,
 * so the separator stands at 20 and the trigger at 21.
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

/** The note every case below runs in */
const NOTE = 'note.md';

/** The selection every case below keeps, unless it says otherwise */
const KEPT = 'réunion de lancement';

/** Where the separating space stands once `KEPT` has been kept from ch 0 */
const SEPARATOR = { line: 0, ch: KEPT.length };
/** Where the trigger stands, one character further */
const TRIGGER = { line: 0, ch: KEPT.length + 1 };

describe('DatePickerSuggest — a selection typed over', () => {
  let app: ReturnType<typeof createMockApp>;
  let settings: DateHelpersSettings;
  let plugin: DateHelpersPlugin;
  let suggest: DatePickerSuggest;
  let editor: any;

  /** Press TAB, the key that now opens the picker */
  function pressTab(): void {
    const register = suggest.scope.register as unknown as jest.Mock;
    const tab = register.mock.calls.find(call => call[1] === 'Tab');
    if (!tab) throw new Error('TAB is not registered');
    tab[2]();
  }

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
      somethingSelected: jest.fn().mockReturnValue(false),
      getSelection: jest.fn().mockReturnValue(''),
    };
  });

  /**
   * Select `text` from `from` on line 0, then type the trigger over it.
   *
   * `to` is where the selection ends, and so where the separator goes; it is
   * given explicitly only when `text` is not what stands on the line, which is
   * the case for a selection spanning several lines.
   */
  function selectThenType(
    text: string,
    from = 0,
    to = from + text.length,
    lineAtArm = `${' '.repeat(from)}${text}`
  ): void {
    editor.somethingSelected = jest.fn().mockReturnValue(true);
    editor.getSelection = jest.fn().mockReturnValue(text);
    editor.getCursor = jest.fn((which?: string) =>
      which === 'to' ? { line: 0, ch: to } : { line: 0, ch: from }
    );
    // The capture reads what followed the selection: that is what bounds the
    // removal later, whatever the caret does in between.
    editor.getLine = jest.fn().mockReturnValue(lineAtArm);

    suggest.selectionCapture.arm(editor, '@', NOTE);
  }

  /** The line as it reads once `text` was kept and `typed` follows the trigger */
  function keptLine(typed = '', text = KEPT, before = ''): string {
    return `${before}${text} @${typed}`;
  }

  /** Drive the popup as Obsidian does: onTrigger, then getSuggestions */
  function suggestionsFor(line: string): DateSuggestion[] {
    editor.getLine = jest.fn().mockReturnValue(line);
    const cursor = { line: 0, ch: line.length };
    const info = suggest.onTrigger(cursor, editor, { path: NOTE } as never);
    if (!info) throw new Error(`no trigger fired for ${line}`);
    const context = {
      editor,
      start: info.start,
      end: info.end,
      query: info.query,
      file: { path: NOTE },
    };
    (suggest as unknown as { context: unknown }).context = context;
    // The caret sits after what was typed, as it does in the editor. The
    // dismissal reads it, so a harness that left it on the selection would be
    // testing a document nobody is looking at.
    editor.getCursor = jest.fn().mockReturnValue(cursor);
    return suggest.getSuggestions(context as never);
  }

  function dailyNoteEntry(list: DateSuggestion[]) {
    const entry = list.find(s => s.kind === 'daily-note');
    if (!entry || entry.kind !== 'daily-note') throw new Error('no daily-note entry listed');
    return entry;
  }

  describe('the kept text holds the alias', () => {
    it('aliases the kept text while the typed expression names the date', () => {
      selectThenType(KEPT);

      const entry = dailyNoteEntry(suggestionsFor(keptLine('tomorrow')));

      expect(entry.alias).toBe(KEPT);
      expect(entry.date.toISODate()).toBe(DateTime.now().plus({ days: 1 }).toISODate());
      expect(entry.output).toContain(`|${KEPT}]]`);
      expect(entry.output).not.toContain('tomorrow]]');
    });

    it('aliases the kept text alone on the current day', () => {
      selectThenType(KEPT);

      const entry = dailyNoteEntry(suggestionsFor(keptLine()));

      expect(entry.alias).toBe(KEPT);
      expect(entry.date.toISODate()).toBe(DateTime.now().toISODate());
    });

    // Selecting `demain` and typing nothing gave a link to TODAY labelled
    // "demain" — a link that lies. The picker, opened on the same keystrokes,
    // answered tomorrow. With nothing typed, a selection that reads as a date
    // names it here too, and the two surfaces agree.
    it('lets a kept text that reads as a date name that date', () => {
      selectThenType('tomorrow');

      const entry = dailyNoteEntry(suggestionsFor(keptLine('', 'tomorrow')));

      expect(entry.alias).toBe('tomorrow');
      expect(entry.date.toISODate()).toBe(DateTime.now().plus({ days: 1 }).toISODate());
      expect(entry.output).toContain(`|tomorrow]]`);
    });

    // `in 5 days` rather than a weekday, and asserted for what it IS rather than
    // for what it is not: `next monday` is tomorrow every Sunday, so the old
    // pair collided one day in seven and the suite failed on the calendar.
    it('lets what the user types win over a kept text that also reads as a date', () => {
      selectThenType('tomorrow');

      const entry = dailyNoteEntry(suggestionsFor(keptLine('in 5 days', 'tomorrow')));

      expect(entry.alias).toBe('tomorrow');
      expect(entry.date.toISODate()).toBe(DateTime.now().plus({ days: 5 }).toISODate());
    });

    it('keeps the alias when the expression names no date', () => {
      selectThenType(KEPT);

      const entry = dailyNoteEntry(suggestionsFor(keptLine('blabla')));

      expect(entry.alias).toBe(KEPT);
      expect(entry.date.toISODate()).toBe(DateTime.now().toISODate());
    });

    it('flattens a kept selection that spans several lines', () => {
      // The capture holds `deux\nlignes`; the line the popup reads shows it
      // with the break already behind, which is what the note looks like from
      // the last line's point of view.
      selectThenType('deux\nlignes', 0, 11);

      const entry = dailyNoteEntry(suggestionsFor(keptLine('', 'deux lignes')));

      expect(entry.output).toContain('|deux lignes]]');
      expect(entry.output).not.toContain('\n');
    });

    it('repairs a kept selection carrying wikilink syntax', () => {
      selectThenType('un [[lien]] | tuyau');

      const entry = dailyNoteEntry(suggestionsFor(keptLine('', 'un [[lien]] | tuyau')));

      expect(entry.output).toContain('|un lien tuyau]]');
    });
  });

  describe('without a capture the contract does not move', () => {
    it('aliases the typed expression when nothing was kept', () => {
      const entry = dailyNoteEntry(suggestionsFor('@blabla'));

      expect(entry.alias).toBe('blabla');
    });

    it('ignores a capture anchored somewhere else on the line', () => {
      // The selection ended at ch 24, so its trigger would stand at 25; the
      // trigger read here sits at ch 0.
      selectThenType(KEPT, 4);

      const entry = dailyNoteEntry(suggestionsFor('@blabla'));

      expect(entry.alias).toBe('blabla');
    });
  });

  describe('dismissing takes back what the trigger added', () => {
    /**
     * Drive the popup, then dismiss it. `getRange` stands for what the note
     * holds between the trigger and the caret.
     */
    function openThenDismiss(line: string): void {
      editor.getRange = jest
        .fn()
        .mockImplementation((from: any, to: any) => line.slice(from.ch, to.ch));
      suggestionsFor(line);
      suggest.close();
    }

    it('removes the separator and the trigger when nothing follows', () => {
      selectThenType(KEPT);

      openThenDismiss(keptLine());

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, { line: 0, ch: 22 });
      expect(suggest.selectionCapture.keptAt(TRIGGER, NOTE)).toBeNull();
    });

    /**
     * The old contract left an expression alone: replacing a selection with
     * `@toto` was a real edit, and undoing it would have destroyed the user's
     * work. Nothing is at stake now — the text was never taken away — so
     * cancelling takes the whole gesture back.
     */
    it('removes the expression too when the user typed after the trigger', () => {
      selectThenType(KEPT);

      openThenDismiss(keptLine('demain'));

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, { line: 0, ch: 28 });
    });

    it('removes the separator when the trigger itself is erased', () => {
      // Backspacing the trigger is the other natural way to cancel. Leaving
      // the space behind would show a trailing character nobody typed.
      selectThenType(KEPT);
      suggestionsFor(keptLine());

      // The trigger is gone and the caret went back with it: Obsidian calls
      // onTrigger again — it finds nothing and returns null — and only then
      // closes the popup.
      editor.getLine = jest.fn().mockReturnValue(`${KEPT} `);
      editor.getCursor = jest.fn().mockReturnValue({ line: 0, ch: 21 });
      expect(suggest.onTrigger({ line: 0, ch: 21 }, editor, { path: NOTE } as never)).toBeNull();
      suggest.close();

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, TRIGGER);
    });

    it('removes the separator mid-sentence when the trigger is erased', () => {
      // `bonjour réunion @`: the text at 8, the separator at 15, the trigger
      // at 16.
      selectThenType('réunion', 8);
      editor.getLine = jest.fn().mockReturnValue('bonjour réunion @');
      expect(
        suggest.onTrigger({ line: 0, ch: 17 }, editor, { path: NOTE } as never)
      ).not.toBeNull();

      editor.getLine = jest.fn().mockReturnValue('bonjour réunion ');
      editor.getCursor = jest.fn().mockReturnValue({ line: 0, ch: 16 });
      expect(suggest.onTrigger({ line: 0, ch: 16 }, editor, { path: NOTE } as never)).toBeNull();
      suggest.close();

      expect(editor.replaceRange).toHaveBeenCalledWith(
        '',
        { line: 0, ch: 15 },
        { line: 0, ch: 16 }
      );
    });

    /**
     * The kept text can itself start with the trigger's own character, and
     * that is exactly what once fooled an equality test into writing the text
     * a second time — `@home meetinghome meeting`, reproduced in Obsidian.
     * What goes is the separator and the trigger, no more.
     */
    it('removes the same two characters when the kept text starts with a trigger', () => {
      selectThenType('@home meeting');

      openThenDismiss(keptLine('', '@home meeting'));

      expect(editor.replaceRange).toHaveBeenCalledWith(
        '',
        { line: 0, ch: 13 },
        { line: 0, ch: 15 }
      );
      expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    });

    /**
     * Obsidian can be a keystroke behind. Dismissing right after the last
     * character arrives found `onTrigger`'s remembered line still holding the
     * previous state, and an equality test between the two declined the
     * removal — the note kept `@demain` for good. Reproduced in Obsidian.
     */
    it('removes what stands there even when the remembered line is behind', () => {
      selectThenType(KEPT);
      suggestionsFor(keptLine());

      // The note has moved on; the suggest has not been told yet.
      editor.getLine = jest.fn().mockReturnValue(keptLine('demain'));
      editor.getCursor = jest.fn().mockReturnValue({ line: 0, ch: 28 });
      suggest.close();

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, { line: 0, ch: 28 });
    });

    /**
     * The caret is not a safe right bound. Click past the expression — or press
     * the right arrow — and the popup stays open, because `onTrigger` still
     * finds the trigger behind the caret. Cancelling then deleted everything up
     * to wherever the caret had gone, the user's own words included.
     *
     * What bounds the removal is what followed the selection when the trigger
     * was typed, and the capture is the only thing that knows it.
     */
    it('stops at what followed the selection, not at a caret that moved past it', () => {
      // `réunion de lancement à préparer`, the first words selected
      selectThenType(KEPT, 0, 20, `${KEPT} à préparer`);

      // The popup is open and the caret has been moved to the end of the line
      suggestionsFor(`${KEPT} @ à préparer`);
      suggest.close();

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, { line: 0, ch: 22 });
    });

    it('takes the expression with it, and still stops at the trailing text', () => {
      selectThenType(KEPT, 0, 20, `${KEPT} à préparer`);

      suggestionsFor(`${KEPT} @demain à préparer`);
      suggest.close();

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, { line: 0, ch: 28 });
    });

    it('writes nothing when what followed the selection is gone', () => {
      // The line no longer ends the way it did: something else edited it, and
      // nothing here is safe to write.
      selectThenType(KEPT, 0, 20, `${KEPT} à préparer`);
      suggestionsFor(`${KEPT} @ à préparer`);

      editor.getLine = jest.fn().mockReturnValue(`${KEPT} @ autre chose`);
      suggest.close();

      expect(editor.replaceRange).not.toHaveBeenCalled();
    });

    it('writes nothing when the separating space is gone', () => {
      selectThenType(KEPT);
      suggestionsFor(keptLine());

      editor.getLine = jest.fn().mockReturnValue(`${KEPT}X@demain`);
      suggest.close();

      expect(editor.replaceRange).not.toHaveBeenCalled();
    });

    it('writes nothing when what follows the space is not a trigger', () => {
      selectThenType(KEPT);
      suggestionsFor(keptLine());

      editor.getLine = jest.fn().mockReturnValue(`${KEPT} autre chose`);
      editor.getCursor = jest.fn().mockReturnValue({ line: 0, ch: 32 });
      suggest.close();

      expect(editor.replaceRange).not.toHaveBeenCalled();
    });

    it('removes the same range wherever the caret has gone', () => {
      // The caret is not consulted at all. It used to be the right bound, and
      // that is exactly what let a wandering caret eat the user's words.
      selectThenType(KEPT);
      suggestionsFor(keptLine('demain'));

      editor.getCursor = jest.fn().mockReturnValue({ line: 3, ch: 0 });
      suggest.close();

      expect(editor.replaceRange).toHaveBeenCalledWith('', SEPARATOR, { line: 0, ch: 28 });
    });

    it('writes nothing when no selection was kept', () => {
      openThenDismiss('@');

      expect(editor.replaceRange).not.toHaveBeenCalled();
    });

    it('leaves a picker-mode trigger to the modal', () => {
      // `@@` opens the modal, which takes its own cancellation back. Removing
      // here too would fight it, and would fire while the modal is still open —
      // the popup closes the moment the modal takes over.
      selectThenType(KEPT);

      openThenDismiss(keptLine('', KEPT).replace(' @', ' @@'));

      expect(editor.replaceRange).not.toHaveBeenCalled();
    });

    it('writes nothing on a dismissal with no trigger ever read', () => {
      expect(() => suggest.close()).not.toThrow();
      expect(editor.replaceRange).not.toHaveBeenCalled();
    });
  });

  describe('validating replaces the kept text along with the trigger', () => {
    it('writes the entry over the text, the separator and the expression', () => {
      selectThenType(KEPT);
      const list = suggestionsFor(keptLine('tomorrow'));

      suggest.selectSuggestion(dailyNoteEntry(list));

      const written = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
      expect(written).toContain(`|${KEPT}]]`);
      expect(editor.replaceRange).toHaveBeenCalledWith(
        written,
        { line: 0, ch: 0 },
        { line: 0, ch: 30 }
      );
    });

    it('leaves the caret after what it wrote', () => {
      selectThenType(KEPT);
      const list = suggestionsFor(keptLine('tomorrow'));

      suggest.selectSuggestion(dailyNoteEntry(list));

      const written = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
      expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: written.length });
    });

    it('reaches back only to the trigger when nothing was kept', () => {
      const list = suggestionsFor('@tomorrow');

      suggest.selectSuggestion(dailyNoteEntry(list));

      const written = (editor.replaceRange.mock.calls[0] as unknown[])[0] as string;
      expect(editor.replaceRange).toHaveBeenCalledWith(
        written,
        { line: 0, ch: 0 },
        { line: 0, ch: 9 }
      );
    });
  });

  describe('handing the capture over to the modal', () => {
    it('gives a picker-mode trigger the kept text and the trigger position', () => {
      selectThenType(KEPT);

      suggestionsFor(`${KEPT} @@`);

      expect(plugin.showDatePickerFromTrigger).toHaveBeenCalledWith(
        editor,
        { line: 0, ch: 0 },
        { line: 0, ch: 23 },
        undefined,
        { text: KEPT, triggerStart: TRIGGER }
      );
    });

    it('gives TAB the kept text and the trigger position', () => {
      selectThenType(KEPT);
      suggestionsFor(keptLine());

      pressTab();

      expect(plugin.showDatePickerFromTrigger).toHaveBeenCalledWith(
        editor,
        { line: 0, ch: 0 },
        { line: 0, ch: 22 },
        '',
        { text: KEPT, triggerStart: TRIGGER }
      );
    });

    it('hands over nothing when nothing was kept', () => {
      suggestionsFor('@');

      pressTab();

      expect(plugin.showDatePickerFromTrigger).toHaveBeenCalledWith(
        editor,
        { line: 0, ch: 0 },
        { line: 0, ch: 1 },
        '',
        undefined
      );
    });

    it('forgets the capture a picker-mode trigger handed over', () => {
      // Otherwise the capture outlives its trigger: cancel the modal, select
      // the same words again, type the trigger — and the popup aliases a
      // selection the user never made.
      selectThenType(KEPT);

      suggestionsFor(`${KEPT} @@`);

      expect(suggest.selectionCapture.keptAt(TRIGGER, NOTE)).toBeNull();
    });

    it('forgets the capture before the modal opens, not after', () => {
      // Obsidian dismisses the popup while `modal.open()` runs, so `close()`
      // lands in the middle of the hand-over. A capture still armed at that
      // moment would have the popup cut the trigger out from under the modal,
      // which goes on to replace a range that no longer holds what it read.
      selectThenType(KEPT);
      suggestionsFor(keptLine());
      (plugin.showDatePickerFromTrigger as jest.Mock).mockImplementation(() => suggest.close());

      pressTab();

      expect(editor.replaceRange).not.toHaveBeenCalled();
    });

    it('forgets the capture once the modal owns it', () => {
      // Both would otherwise act on the same range: the modal on its cancel,
      // and the popup's own dismissal, which fires as the modal takes over.
      selectThenType(KEPT);
      suggestionsFor(keptLine());

      pressTab();
      suggest.close();

      expect(suggest.selectionCapture.keptAt(TRIGGER, NOTE)).toBeNull();
      expect(editor.replaceRange).not.toHaveBeenCalled();
    });
  });

  describe('the entry that keeps the selection comes first', () => {
    /**
     * The popup highlights its first entry, and ENTER validates the highlighted
     * one. With a capture held, a plain format sitting first means confirming
     * straight away writes the date over the text and drops it — the very
     * surprise this whole path exists to avoid. So the link, the only entry
     * carrying an alias, leads the list while a capture is held.
     */
    it('leads with the daily note link when a selection is held', () => {
      selectThenType(KEPT);

      const kinds = suggestionsFor(keptLine('tomorrow')).map(s => s.kind);

      // Two presets are pinned in this harness, so the whole order is nameable.
      expect(kinds).toEqual(['daily-note', 'preset', 'preset']);
    });

    it('leaves the order alone without a capture', () => {
      const kinds = suggestionsFor('@tomorrow').map(s => s.kind);

      expect(kinds[0]).toBe('preset');
      expect(kinds[kinds.length - 1]).toBe('daily-note');
    });
  });

  describe('the row names the kept text', () => {
    /** The text of the row the popup draws under its header, if any */
    function heldRow(): string | null {
      const root = (suggest as unknown as { suggestEl: HTMLElement }).suggestEl;
      return root.querySelector('.date-suggest-held')?.textContent ?? null;
    }

    /** Just the kept text, without the label or the key beside it */
    function instructions(): Array<{ purpose: string }> {
      const root = (suggest as unknown as { suggestEl: HTMLElement }).suggestEl;
      const text = root.querySelector('.date-suggest-held-text')?.textContent;
      return text === undefined ? [] : [{ purpose: text }];
    }

    it('names the kept text', () => {
      selectThenType(KEPT);

      suggestionsFor(keptLine());

      expect(heldRow()).toContain(KEPT);
    });

    it('leaves the date to the header', () => {
      selectThenType(KEPT);

      suggestionsFor(keptLine('demain'));

      // The row carries the text; naming the date here would say it twice.
      expect(heldRow()).toContain(KEPT);
      expect(heldRow()).not.toContain('demain');
      expect(suggest.header?.query).toBe('@demain');
    });

    it('draws no row at all without a capture', () => {
      suggestionsFor('@demain');

      expect(heldRow()).toBeNull();
    });

    it('flattens a kept selection spanning several lines', () => {
      selectThenType('deux\nlignes', 0, 11);

      suggestionsFor(keptLine('', 'deux lignes'));

      expect(instructions()[0].purpose).toBe('deux lignes');
    });

    it('shows the text the way the alias will read it', () => {
      // The bar and the wikilink must not disagree: `sanitizeAlias` turns
      // `[[`, `]]` and `|` into spaces, so a bar showing the raw capture would
      // promise something the insert does not deliver.
      selectThenType('un [[lien]] | tuyau');

      suggestionsFor(keptLine('', 'un [[lien]] | tuyau'));

      expect(instructions()[0].purpose).toBe('un lien tuyau');
    });

    it('keeps a no-break space, which is the user typography', () => {
      selectThenType('réunion : lancement');

      suggestionsFor(keptLine('', 'réunion : lancement'));

      expect(instructions()[0].purpose).toBe('réunion : lancement');
    });

    it('shortens a long selection rather than stretching the bar', () => {
      selectThenType('a'.repeat(80));

      suggestionsFor(keptLine('', 'a'.repeat(80)));

      const shown = instructions()[0].purpose;
      expect(shown).toHaveLength(40);
      expect(shown.endsWith('…')).toBe(true);
    });

    it('keeps a selection that fits whole', () => {
      selectThenType('a'.repeat(40));

      suggestionsFor(keptLine('', 'a'.repeat(40)));

      expect(instructions()[0].purpose).toBe('a'.repeat(40));
    });
  });

  describe('the capture does not outlive an abandoned gesture', () => {
    /**
     * Found by the pre-merge review, then reproduced in Obsidian.
     *
     * The capture used to stay armed whenever the dismissal declined to act,
     * because only the acting path cleared it. A later trigger at the same
     * position then inherited a selection from a gesture the user had
     * abandoned.
     */
    it('is forgotten when the popup closes without removing anything', () => {
      selectThenType(KEPT);
      suggestionsFor(keptLine('toto'));

      // The line was edited by something other than the trigger — CMD+Z lives
      // here too. The dismissal declines, and must still forget.
      editor.getLine = jest.fn().mockReturnValue('tout autre chose');
      suggest.close();

      expect(editor.replaceRange).not.toHaveBeenCalled();
      expect(suggest.selectionCapture.keptAt(TRIGGER, NOTE)).toBeNull();
    });

    it('releases the editor it was holding', () => {
      // The stored range keeps a live Editor. Closing the popup is the end of
      // its usefulness, and closing a tab should not leave it reachable.
      // Through a close that does NOT act — the acting path nulls the range
      // itself, so testing that way would prove nothing about close().
      selectThenType(KEPT);
      suggestionsFor(keptLine('toto'));
      editor.getLine = jest.fn().mockReturnValue('tout autre chose');

      suggest.close();

      expect((suggest as unknown as { lastTriggerRange: unknown }).lastTriggerRange).toBeNull();
    });

    it('does not hand a capture to a trigger in another file', () => {
      selectThenType(KEPT);

      expect(suggest.selectionCapture.keptAt(TRIGGER, 'autre.md')).toBeNull();
      expect(suggest.selectionCapture.keptAt(TRIGGER, NOTE)?.text).toBe(KEPT);
    });
  });

  describe('the capture does not outlive its trigger', () => {
    it('is forgotten once an entry is validated', () => {
      selectThenType(KEPT);
      const list = suggestionsFor(keptLine());

      suggest.selectSuggestion(dailyNoteEntry(list));

      expect(suggest.selectionCapture.keptAt(TRIGGER, NOTE)).toBeNull();
    });
  });
});
