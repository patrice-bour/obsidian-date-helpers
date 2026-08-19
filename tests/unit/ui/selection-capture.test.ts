/**
 * The selection a trigger keystroke would have destroyed.
 *
 * Typing a character over a selection replaces it, and CodeMirror does that
 * before any plugin code runs. The capture therefore happens on `keydown`, one
 * step earlier — early enough to cancel the replacement and write the trigger
 * after the selected text instead.
 *
 * Two positions come out of it. The text keeps its own start, which is where a
 * validated entry has to be written. The trigger lands one character past the
 * end of the selection, behind a separating space, and that is the position
 * `onTrigger` reads the capture back by.
 */

import { SelectionCapture } from '@/ui/selection-capture';
import { Editor, EditorPosition } from 'obsidian';
import { TriggerConfig } from '@/types/settings';

const picker = (sequence: string): TriggerConfig => ({ sequence, mode: 'picker' });
const inline = (sequence: string): TriggerConfig => ({ sequence, mode: 'inline' });

/** The note the capture is anchored to, unless a test says otherwise */
const NOTE = 'note.md';

describe('SelectionCapture', () => {
  let capture: SelectionCapture;

  beforeEach(() => {
    capture = new SelectionCapture([picker('@@'), inline('@')]);
  });

  /**
   * An editor holding `text`, selected from `from` to `to`.
   *
   * Both bounds matter now: the start anchors the replacement, the end says
   * where the trigger goes.
   */
  function editorSelecting(
    text: string,
    from: EditorPosition,
    to: EditorPosition,
    line = `${' '.repeat(to.ch)}`
  ): Editor {
    return {
      somethingSelected: jest.fn().mockReturnValue(text.length > 0),
      getSelection: jest.fn().mockReturnValue(text),
      getCursor: jest.fn((which?: string) => (which === 'to' ? to : from)),
      // What follows the selection on its line is read at arming: it is what
      // bounds a removal later, whatever the caret does in between.
      getLine: jest.fn().mockReturnValue(line),
    } as unknown as Editor;
  }

  /** An editor with the caret at `at` and nothing selected */
  function editorWithCaretAt(at: EditorPosition): Editor {
    return {
      somethingSelected: jest.fn().mockReturnValue(false),
      getSelection: jest.fn().mockReturnValue(''),
      getCursor: jest.fn().mockReturnValue(at),
      getLine: jest.fn().mockReturnValue(''),
    } as unknown as Editor;
  }

  /** `réunion` selected on line 0, characters 4 to 11 */
  function armReunion(): void {
    capture.arm(editorSelecting('réunion', { line: 0, ch: 4 }, { line: 0, ch: 11 }), '@', NOTE);
  }

  /** Where the trigger stands once `armReunion` has written it */
  const TRIGGER = { line: 0, ch: 12 };

  describe('arm — what it remembers, and what it hands back', () => {
    it('hands back where the separating space goes', () => {
      const editor = editorSelecting('réunion', { line: 0, ch: 4 }, { line: 0, ch: 11 });

      // The end of the selection, not its start: the anchor is read later,
      // through `keptAt`, by whoever replaces the text.
      expect(capture.arm(editor, '@', NOTE)).toEqual({ line: 0, ch: 11 });
    });

    it('hands back nothing when the key opens no trigger', () => {
      const editor = editorSelecting('réunion', { line: 0, ch: 4 }, { line: 0, ch: 11 });

      expect(capture.arm(editor, 'x', NOTE)).toBeNull();
      expect(capture.keptAt(TRIGGER, NOTE)).toBeNull();
    });

    it('hands back nothing when nothing is selected', () => {
      const editor = editorWithCaretAt({ line: 0, ch: 4 });

      expect(capture.arm(editor, '@', NOTE)).toBeNull();
    });

    /**
     * The second `@` of `@@` arrives with the caret collapsed, because the
     * first one already wrote the trigger. It must not throw the capture away:
     * the picker still needs the text.
     */
    it('leaves an armed capture alone when the next keystroke has no selection', () => {
      armReunion();

      capture.arm(editorWithCaretAt({ line: 0, ch: 13 }), '@', NOTE);

      expect(capture.keptAt(TRIGGER, NOTE)?.text).toBe('réunion');
    });

    it('reads the key against every configured trigger, not just the first', () => {
      capture = new SelectionCapture([inline(';;'), inline('@')]);
      const editor = editorSelecting('réunion', { line: 0, ch: 4 }, { line: 0, ch: 11 });

      expect(capture.arm(editor, ';', NOTE)).not.toBeNull();
    });

    it('replaces a previous capture rather than keeping the stale one', () => {
      armReunion();
      capture.arm(editorSelecting('second', { line: 5, ch: 0 }, { line: 5, ch: 6 }), '@', NOTE);

      expect(capture.keptAt(TRIGGER, NOTE)).toBeNull();
      expect(capture.keptAt({ line: 5, ch: 7 }, NOTE)?.text).toBe('second');
    });

    it('remembers a selection spanning several lines, whole', () => {
      const editor = editorSelecting('deux\nlignes', { line: 2, ch: 3 }, { line: 3, ch: 6 });

      expect(capture.arm(editor, '@', NOTE)).toEqual({ line: 3, ch: 6 });
      expect(capture.keptAt({ line: 3, ch: 7 }, NOTE)?.text).toBe('deux\nlignes');
      // The anchor stays on the first line, where the text begins
      expect(capture.keptAt({ line: 3, ch: 7 }, NOTE)?.anchor).toEqual({ line: 2, ch: 3 });
    });
  });

  describe('keptAt — the trigger position is the key', () => {
    beforeEach(armReunion);

    it('gives the text back where the trigger stands', () => {
      expect(capture.keptAt(TRIGGER, NOTE)?.text).toBe('réunion');
    });

    /**
     * The anchor is the left bound of the replacement. Reading it wrong writes
     * the wikilink over the wrong words, which is the failure this test exists
     * to make loud.
     */
    it('gives back where the kept text starts, not where the trigger stands', () => {
      expect(capture.keptAt(TRIGGER, NOTE)?.anchor).toEqual({ line: 0, ch: 4 });
    });

    /**
     * The right bound of a removal. The caret cannot serve: the popup stays
     * open while the caret wanders past the expression, and cancelling would
     * then take the user's own words along with the trigger.
     */
    it('gives back what already followed the selection on its line', () => {
      capture.arm(
        editorSelecting(
          'réunion',
          { line: 0, ch: 4 },
          { line: 0, ch: 11 },
          'de  réunion à préparer'
        ),
        '@',
        NOTE
      );

      expect(capture.keptAt(TRIGGER, NOTE)?.tail).toBe(' à préparer');
    });

    it('gives back an empty tail when the selection ended the line', () => {
      capture.arm(
        editorSelecting('réunion', { line: 0, ch: 4 }, { line: 0, ch: 11 }, 'de  réunion'),
        '@',
        NOTE
      );

      expect(capture.keptAt(TRIGGER, NOTE)?.tail).toBe('');
    });

    it('gives nothing back where the selection ended', () => {
      // The separator sits there. A trigger reported at that position belongs
      // to something else.
      expect(capture.keptAt({ line: 0, ch: 11 }, NOTE)).toBeNull();
    });

    it('gives nothing back one character away', () => {
      expect(capture.keptAt({ line: 0, ch: 13 }, NOTE)).toBeNull();
    });

    it('gives nothing back on another line', () => {
      expect(capture.keptAt({ line: 1, ch: 12 }, NOTE)).toBeNull();
    });

    it('answers as many times as the trigger is read', () => {
      // `@@` fires onTrigger twice from the same position: once for `@`, once
      // for `@@`. Reading must not empty the capture.
      expect(capture.keptAt(TRIGGER, NOTE)?.text).toBe('réunion');
      expect(capture.keptAt(TRIGGER, NOTE)?.text).toBe('réunion');
    });
  });

  describe('the file is part of the key', () => {
    it('gives nothing back in another note', () => {
      armReunion();

      // Line 0, character 12 exists in every note long enough: the position
      // alone would hand this selection to a trigger typed anywhere else.
      expect(capture.keptAt(TRIGGER, 'autre.md')).toBeNull();
      expect(capture.keptAt(TRIGGER, NOTE)?.text).toBe('réunion');
    });

    it('treats a fileless editor as its own key', () => {
      capture.arm(editorSelecting('réunion', { line: 0, ch: 4 }, { line: 0, ch: 11 }), '@', null);

      expect(capture.keptAt(TRIGGER, NOTE)).toBeNull();
      expect(capture.keptAt(TRIGGER, null)?.text).toBe('réunion');
    });
  });

  describe('clear — used once, never again', () => {
    it('forgets the capture', () => {
      armReunion();

      capture.clear();

      expect(capture.keptAt(TRIGGER, NOTE)).toBeNull();
    });

    it('can be cleared twice without re-arming anything', () => {
      armReunion();

      capture.clear();
      capture.clear();

      expect(capture.keptAt(TRIGGER, NOTE)).toBeNull();
    });
  });
});
