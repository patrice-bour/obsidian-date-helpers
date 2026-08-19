import { Editor, EditorPosition } from 'obsidian';
import { TriggerConfig } from '@/types/settings';

/** Where a captured selection stands, once the trigger has been written after it. */
export interface KeptSelection {
  /** The text left in the note */
  text: string;
  /** Where that text starts — the left bound of anything that replaces it */
  anchor: EditorPosition;
  /**
   * What already followed the selection on its line, before the trigger was
   * written.
   *
   * This is what bounds a removal on its right. The caret cannot: the popup
   * stays open while the caret wanders past the expression — a click, an arrow
   * key — and cancelling then took the user's own words with it.
   */
  tail: string;
}

/**
 * The selection a trigger keystroke would have destroyed.
 *
 * Typing a character over a selection replaces it, and CodeMirror does that
 * before any plugin code runs. The only moment the text still exists is the
 * `keydown` that precedes the replacement — early enough to cancel it, and
 * write a separating space and the trigger after the selected text instead.
 *
 * So two positions come out of arming. The text keeps its own start, the
 * anchor, which is where a validated entry has to be written. The trigger lands
 * one character past the end of the selection, and that is the position
 * `onTrigger` reads the capture back by. Reading does not empty it — a
 * two-character trigger such as `@@` fires `onTrigger` once per keystroke, both
 * times from the same position. Emptying is `clear()`, called when the trigger
 * has finished with it: an entry validated, or the popup dismissed.
 */
export class SelectionCapture {
  /** First characters of the configured triggers — the only keys worth arming on */
  private readonly openingChars: Set<string>;

  private captured: {
    text: string;
    anchor: EditorPosition;
    separatorAt: EditorPosition;
    tail: string;
    filePath: string | null;
  } | null = null;

  constructor(triggers: TriggerConfig[]) {
    this.openingChars = new Set(
      triggers.map(({ sequence }) => sequence[0]).filter((char): char is string => Boolean(char))
    );
  }

  /**
   * Remember the selection `key` would have replaced, and hand back where the
   * separating space goes. Returns null when there is nothing to keep.
   *
   * Only that one position comes back: the anchor is read later, through
   * `keptAt`, by whoever replaces the text.
   *
   * Any key that opens no trigger leaves the capture alone rather than clearing
   * it: the expression typed after the trigger is made of such keys, and it
   * must not cost the alias. A keystroke arriving with no selection leaves it
   * alone for the same reason — the second `@` of `@@` is exactly that.
   */
  arm(editor: Editor, key: string, filePath: string | null): EditorPosition | null {
    if (!this.openingChars.has(key)) return null;
    if (!editor.somethingSelected()) return null;

    const text = editor.getSelection();
    if (!text) return null;

    const anchor = editor.getCursor('from');
    const separatorAt = editor.getCursor('to');
    // Read now, while the line is still the one the user was looking at.
    const tail = editor.getLine(separatorAt.line).slice(separatorAt.ch);
    this.captured = { text, anchor, separatorAt, tail, filePath };

    return separatorAt;
  }

  /**
   * The kept selection, if the trigger at `triggerStart` in `filePath` is the
   * one written after it.
   *
   * The trigger stands one character past the end of the selection, the
   * separating space between them. The file is part of the key, not decoration:
   * a position alone would hand one note's selection to a trigger typed in
   * another.
   */
  keptAt(triggerStart: EditorPosition, filePath: string | null): KeptSelection | null {
    if (!this.captured) return null;

    const { text, anchor, separatorAt, tail } = this.captured;
    if (this.captured.filePath !== filePath) return null;
    if (separatorAt.line !== triggerStart.line) return null;
    if (separatorAt.ch + 1 !== triggerStart.ch) return null;

    return { text, anchor, tail };
  }

  /** Forget the capture, so no later trigger inherits it. */
  clear(): void {
    this.captured = null;
  }
}
