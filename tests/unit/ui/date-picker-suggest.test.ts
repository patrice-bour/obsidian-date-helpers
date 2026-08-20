/**
 * The inline suggest's trigger rules and expression capture.
 *
 * Two kinds of trigger share one `EditorSuggest`, told apart by their stored
 * mode: a `picker` one (`@@` by default) opens the modal picker, and an
 * `inline` one (`@`) opens the popup and captures everything typed after it.
 * The defaults are used here; that mode is independent of length is pinned in
 * `date-picker-suggest.modes.test.ts`.
 */

import { DatePickerSuggest } from '@/ui/date-picker-suggest';
import DateHelpersPlugin from '@/main';
import { Editor, EditorPosition } from 'obsidian';
import { TriggerConfig } from '@/types/settings';

/** A trigger opening the modal picker */
const picker = (sequence: string): TriggerConfig => ({ sequence, mode: 'picker' });
/** A trigger opening the inline suggestion popup */
const inline = (sequence: string): TriggerConfig => ({ sequence, mode: 'inline' });

describe('DatePickerSuggest', () => {
  let mockApp: any;
  let mockPlugin: any;
  let mockEditor: any;
  let suggest: DatePickerSuggest;

  beforeEach(() => {
    mockApp = { vault: {}, workspace: {} };

    mockPlugin = {
      showDatePickerFromTrigger: jest.fn(),
      settings: { enableDatePicker: true } as any,
    } as any;

    mockEditor = {
      getLine: jest.fn(),
      getCursor: jest.fn(),
      replaceRange: jest.fn(),
    } as Partial<Editor>;

    suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, [
      picker('@@'),
      inline('@'),
    ]);
  });

  /** Put `line` in the editor and fire onTrigger with the caret at its end */
  function triggerAtEndOf(line: string, lineNumber = 0) {
    mockEditor.getLine = jest.fn().mockReturnValue(line);
    const cursor: EditorPosition = { line: lineNumber, ch: line.length };
    return suggest.onTrigger(cursor, mockEditor as Editor);
  }

  describe('onTrigger — where the trigger counts', () => {
    it('fires at the start of a line', () => {
      const result = triggerAtEndOf('@');

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: 1 });
      expect(result?.query).toBe('');
    });

    it('fires after a space', () => {
      const result = triggerAtEndOf('some text @');

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 10 });
    });

    it.each(['(', ',', '-', ':', "'", '«'])('fires after the separator %p', separator => {
      expect(triggerAtEndOf(`text${separator}@`)).not.toBeNull();
    });

    it('stays inert immediately after a word character', () => {
      // The change from `endsWith(trigger)`: `blabla@` used to fire
      expect(triggerAtEndOf('blabla@')).toBeNull();
      expect(triggerAtEndOf('user@')).toBeNull();
      expect(triggerAtEndOf('2026@')).toBeNull();
    });

    it('stays inert when an email-like address is being typed', () => {
      expect(triggerAtEndOf('write to any.pattern@')).toBeNull();
    });

    it('does not fire on a line with no trigger', () => {
      expect(triggerAtEndOf('some text here')).toBeNull();
    });

    it('does not fire when a modal trigger sits earlier in the line', () => {
      // `@@` opens a modal, so it only counts when it ends at the caret. Its
      // second `@` must not be read as an inline trigger either.
      mockEditor.getLine = jest.fn().mockReturnValue('some @@ text here');
      expect(suggest.onTrigger({ line: 0, ch: 17 }, mockEditor as Editor)).toBeNull();
    });

    it('does not fire when the date picker is disabled', () => {
      mockPlugin.settings.enableDatePicker = false;
      expect(triggerAtEndOf('@')).toBeNull();
    });

    it('does not fire with no configured trigger', () => {
      suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, []);
      expect(triggerAtEndOf('@')).toBeNull();
    });
  });

  describe('onTrigger — the picker trigger keeps its behaviour', () => {
    it('matches the longer trigger rather than its last character', () => {
      const result = triggerAtEndOf('@@');

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: 2 });
      expect(suggest.isModalTrigger()).toBe(true);
    });

    it('reports a single-character trigger as inline', () => {
      triggerAtEndOf('@');
      expect(suggest.isModalTrigger()).toBe(false);
    });

    it('fires for a multi-character trigger anywhere a word may start', () => {
      const result = triggerAtEndOf('some text @@');
      expect(result?.start).toEqual({ line: 0, ch: 10 });
      expect(suggest.isModalTrigger()).toBe(true);
    });

    it('handles several configured triggers', () => {
      suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, [
        picker('@@'),
        picker('##'),
      ]);

      expect(triggerAtEndOf('@@')).not.toBeNull();
      expect(triggerAtEndOf('##')).not.toBeNull();
      expect(suggest.isModalTrigger()).toBe(true);
    });

    it('works with a longer trigger sequence', () => {
      suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, [picker('@date')]);
      const result = triggerAtEndOf('@date');

      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: 5 });
    });

    it('keeps the trigger line, whatever it is', () => {
      const result = triggerAtEndOf('@@', 5);
      expect(result?.start).toEqual({ line: 5, ch: 0 });
      expect(result?.end).toEqual({ line: 5, ch: 2 });
    });
  });

  describe('onTrigger — continuous expression capture', () => {
    it('captures everything between the trigger and the caret', () => {
      expect(triggerAtEndOf('@mardi')?.query).toBe('mardi');
    });

    it('keeps capturing across spaces, so a multi-word expression survives', () => {
      expect(triggerAtEndOf('@mardi prochain')?.query).toBe('mardi prochain');
      expect(triggerAtEndOf('@mardi prochain à 14h')?.query).toBe('mardi prochain à 14h');
    });

    it('keeps the popup open past what parses', () => {
      // onTrigger returning null is what closes the popup: it must not.
      expect(triggerAtEndOf('@un alias vers une date')).not.toBeNull();
      expect(triggerAtEndOf('@un alias vers une date')?.query).toBe('un alias vers une date');
    });

    it('captures from the trigger nearest the caret', () => {
      expect(triggerAtEndOf('@lundi et @mardi')?.query).toBe('mardi');
    });

    it('captures a trailing space as part of the expression', () => {
      expect(triggerAtEndOf('@mardi ')?.query).toBe('mardi ');
    });

    it('does not close itself when a modal trigger appears inside the expression', () => {
      // `@a @@b`: the `@` at column 0 still governs the caret. Returning null
      // here is what closes the popup, which the spec forbids.
      const result = triggerAtEndOf('@a @@b');

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.query).toBe('a @@b');
    });

    it('stays inert after a letter carrying a combining accent', () => {
      // NFD: "e" + U+0301, what macOS and several IMEs produce. The accent must
      // be the LAST character before the trigger for this to test anything —
      // `Renée@` ends on a bare `e` and would pass without the rule at all.
      expect(triggerAtEndOf('René@'.normalize('NFD'))).toBeNull();
      expect(triggerAtEndOf('é@'.normalize('NFD'))).toBeNull();
    });

    it('still fires after an emoji, whichever way it is composed', () => {
      // U+FE0F is a combining mark too, but a heart is not a word: treating
      // every mark as a word character made the trigger depend on which emoji
      // preceded it.
      expect(triggerAtEndOf('❤️@')).not.toBeNull();
      expect(triggerAtEndOf('🎉@')).not.toBeNull();
      expect(triggerAtEndOf('👨‍👩‍👦@')).not.toBeNull();
    });

    it('stays inert after a character outside the BMP', () => {
      // A surrogate pair: line[start - 1] is its low half, not a letter
      expect(triggerAtEndOf('𝐀@')).toBeNull();
    });

    it('captures nothing for the modal trigger', () => {
      expect(triggerAtEndOf('@@')?.query).toBe('');
    });
  });
});
