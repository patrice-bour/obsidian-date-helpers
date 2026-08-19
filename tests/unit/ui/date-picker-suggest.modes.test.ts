/**
 * Mode × length matrix for the configured triggers.
 *
 * Until this change, a trigger's length decided what it opened: one character
 * meant the inline popup, two or more meant the modal picker. The two
 * combinations that rule made unreachable — a one-character picker trigger and
 * a multi-character inline one — are what this file exercises, because the
 * walk-back in `onTrigger` was only ever run with the pairing the old rule
 * allowed.
 */

import { DatePickerSuggest } from '@/ui/date-picker-suggest';
import DateHelpersPlugin from '@/main';
import { Editor, EditorPosition } from 'obsidian';
import { TriggerConfig } from '@/types/settings';

describe('DatePickerSuggest — mode is configured, not derived from length', () => {
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
  });

  /** Configure the suggest with the given triggers */
  function withTriggers(triggers: TriggerConfig[]) {
    suggest = new DatePickerSuggest(mockApp, mockPlugin as DateHelpersPlugin, triggers);
  }

  /** Put `line` in the editor and fire onTrigger with the caret at its end */
  function triggerAtEndOf(line: string, lineNumber = 0) {
    mockEditor.getLine = jest.fn().mockReturnValue(line);
    const cursor: EditorPosition = { line: lineNumber, ch: line.length };
    return suggest.onTrigger(cursor, mockEditor as Editor);
  }

  describe('inline mode, whatever the sequence length', () => {
    it.each([
      ['one character', '@'],
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('opens the popup and captures the expression — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'inline' }]);

      const result = triggerAtEndOf(`${sequence}mardi prochain`);

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: sequence.length + 'mardi prochain'.length });
      expect(result?.query).toBe('mardi prochain');
      expect(suggest.isModalTrigger()).toBe(false);
    });

    it.each([
      ['one character', '@'],
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('fires on the keystroke that completes the sequence — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'inline' }]);

      const result = triggerAtEndOf(sequence);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('');
    });

    // One character has no incomplete prefix: parametrising it here would run
    // the loop zero times and pass without asserting anything.
    it.each([
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('stays inert while the sequence is incomplete — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'inline' }]);

      for (let cut = 1; cut < sequence.length; cut++) {
        expect(triggerAtEndOf(sequence.slice(0, cut))).toBeNull();
      }
    });

    it.each([
      ['one character', '@'],
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('keeps the popup open past what parses — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'inline' }]);

      const result = triggerAtEndOf(`some text ${sequence}un alias vers une date`);

      expect(result).not.toBeNull();
      expect(result?.query).toBe('un alias vers une date');
    });

    it.each([
      ['one character', '@'],
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('stays inert mid-word — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'inline' }]);

      expect(triggerAtEndOf(`blabla${sequence}`)).toBeNull();
    });

    it('captures from the trigger nearest the caret, multi-character included', () => {
      withTriggers([{ sequence: '//d', mode: 'inline' }]);

      expect(triggerAtEndOf('//dlundi et //dmardi')?.query).toBe('mardi');
    });
  });

  describe('picker mode, whatever the sequence length', () => {
    it.each([
      ['one character', '@'],
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('opens the modal with an empty query — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'picker' }]);

      const result = triggerAtEndOf(`some text ${sequence}`);

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 'some text '.length });
      expect(result?.query).toBe('');
      expect(suggest.isModalTrigger()).toBe(true);
    });

    it.each([
      ['one character', '@'],
      ['two characters', '@@'],
      ['three characters', '//d'],
    ])('counts only when it ends at the caret — %s', (_label, sequence) => {
      withTriggers([{ sequence, mode: 'picker' }]);

      expect(triggerAtEndOf(`${sequence} text here`)).toBeNull();
    });
  });

  describe('longest match wins, across modes', () => {
    it('reads `@@` as the picker even when it is stored after its own `@`', () => {
      // Stored order is the user's, not ours: deleting `@@` and adding it back
      // pushes it to the end of the list. Without the longest-first sort the
      // walk-back would find `@` first, and `@@` would open the popup with a
      // query of `@` — the row saying "Date picker" while a popup appears.
      withTriggers([
        { sequence: '@', mode: 'inline' },
        { sequence: '@@', mode: 'picker' },
      ]);

      const result = triggerAtEndOf('@@');

      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.end).toEqual({ line: 0, ch: 2 });
      expect(result?.query).toBe('');
      expect(suggest.isModalTrigger()).toBe(true);
    });

    it('reads `@@` as the inline trigger when the modes are swapped', () => {
      withTriggers([
        { sequence: '@@', mode: 'inline' },
        { sequence: '@', mode: 'picker' },
      ]);

      const result = triggerAtEndOf('@@mardi');

      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.query).toBe('mardi');
      expect(suggest.isModalTrigger()).toBe(false);
    });

    it('lets a one-character picker trigger and a longer inline one coexist', () => {
      withTriggers([
        { sequence: '@', mode: 'picker' },
        { sequence: '//d', mode: 'inline' },
      ]);

      expect(triggerAtEndOf('@')?.query).toBe('');
      expect(suggest.isModalTrigger()).toBe(true);

      expect(triggerAtEndOf('//dmardi')?.query).toBe('mardi');
      expect(suggest.isModalTrigger()).toBe(false);
    });

    it('does not close the inline popup when a picker trigger is typed inside the expression', () => {
      withTriggers([
        { sequence: '//d', mode: 'inline' },
        { sequence: '@@', mode: 'picker' },
      ]);

      const result = triggerAtEndOf('//da @@b');

      expect(result).not.toBeNull();
      expect(result?.start).toEqual({ line: 0, ch: 0 });
      expect(result?.query).toBe('a @@b');
    });
  });
});
