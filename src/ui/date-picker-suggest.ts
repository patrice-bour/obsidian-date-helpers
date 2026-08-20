import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from 'obsidian';
import { DateTime } from 'luxon';
import DateHelpersPlugin from '@/main';
import { Translate } from '@/i18n/types';
import { presetName } from '@/i18n/preset-labels';
import { TriggerConfig } from '@/types/settings';
import { SelectionCapture } from '@/ui/selection-capture';
import { sanitizeAlias } from '@/services/daily-notes-service';

/**
 * Does the text end on a word?
 *
 * Matched against everything before the trigger rather than one character:
 *
 * - a decomposed letter ends with its combining marks — `René` typed on macOS
 *   is `e` + U+0301 — so the marks are allowed *after* a letter, never alone;
 * - an emoji with a variation selector (`❤️`) also ends on a combining mark,
 *   but a heart is not a word: with no letter in front, the marks do not count;
 * - a character outside the BMP is two UTF-16 units, which reading `line[i - 1]`
 *   would split in half.
 */
const ENDS_ON_A_WORD = /[\p{L}\p{N}_]\p{M}*$/u;

/**
 * How much of a captured selection the help bar shows.
 *
 * The bar sits under the popup and grows with its content: a whole paragraph
 * selected would stretch it across the note. Forty characters name the text
 * without turning the bar into a second editor.
 */
const BAR_TEXT_LIMIT = 40;

/**
 * One entry of the inline popup.
 *
 * `output` is what validating the entry writes to the editor — empty for the
 * picker entry, which writes nothing itself.
 */
export type DateSuggestion =
  | { kind: 'preset'; presetId: string; date: DateTime; output: string; label: string }
  | { kind: 'daily-note'; date: DateTime; alias: string; output: string; label: string }
  | { kind: 'open-picker'; expression: string; output: string; label: string };

/**
 * EditorSuggest for the configured triggers.
 *
 * Two behaviours share it, told apart by the trigger's own `mode`:
 *
 * - a **picker** trigger (`@@` by default) opens the modal picker, and only
 *   counts when it ends exactly at the caret — one keystroke, one modal;
 * - an **inline** trigger (`@`) opens the suggestion popup and captures
 *   everything typed after it, spaces included, until the user validates or
 *   dismisses. Returning null is what closes the popup, so the capture must
 *   survive an expression that parses to nothing.
 *
 * Length decides nothing: a one-character picker trigger and a
 * multi-character inline one are both legal.
 *
 * Neither fires mid-word: `blabla@` and `any.pattern@` stay ordinary text.
 */
export class DatePickerSuggest extends EditorSuggest<DateSuggestion> {
  private plugin: DateHelpersPlugin;
  /** Longest sequence first, so `@@` is matched before its own `@`; order is
   * irrelevant to the boundary check, so this one array serves both. */
  private triggersByLength: TriggerConfig[];
  /** Set by the last successful onTrigger; read by getSuggestions */
  private lastTriggerIsModal = false;
  /** The kept text the last successful onTrigger found, if any */
  private lastKeptText: string | null = null;
  /**
   * Where that kept text starts.
   *
   * The trigger's own `start` cannot serve: `query` is read from it, and it
   * must go on naming the date alone. The replacement, on the other hand, has
   * to reach back over the text the user selected — otherwise validating leaves
   * `réunion de lancement` sitting in front of its own wikilink.
   */
  private lastKeptAnchor: EditorPosition | null = null;
  /** Where the last successful onTrigger read its trigger, for the dismissal */
  private lastTriggerRange: {
    editor: Editor;
    start: EditorPosition;
    filePath: string | null;
  } | null = null;

  /**
   * The selection a trigger keystroke destroyed, held for the popup.
   *
   * Owned here rather than passed in: the capture must read the same triggers
   * the popup does, and one constructor argument cannot drift from another.
   * The plugin arms it from its own `keydown` listener.
   */
  readonly selectionCapture: SelectionCapture;

  /** The popup's own labels, resolved on each render like everywhere else */
  private translate: Translate = (key, ...params) => this.plugin.i18n.t(key, ...params);

  constructor(app: App, plugin: DateHelpersPlugin, triggers: TriggerConfig[]) {
    super(app);
    this.plugin = plugin;
    this.triggersByLength = [...triggers].sort((a, b) => b.sequence.length - a.sequence.length);
    this.selectionCapture = new SelectionCapture(triggers);

    // TAB dismisses without inserting. ENTER and ESC are Obsidian's own: the
    // popup validates on ENTER alone, so SPACE stays an ordinary character and
    // `@mardi prochain` does not stop at `@mardi`.
    this.scope.register([], 'Tab', () => {
      this.close();
      return false;
    });
  }

  /**
   * Whether the trigger that last fired opens the modal picker rather than the
   * inline popup.
   */
  isModalTrigger(): boolean {
    return this.lastTriggerIsModal;
  }

  /**
   * Find the trigger governing the caret, and what has been typed after it.
   */
  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file?: TFile | null
  ): EditorSuggestTriggerInfo | null {
    if (!this.plugin.settings.enableDatePicker) {
      return null; // Triggers disabled
    }

    const line = editor.getLine(cursor.line);

    // Walk back from the caret: the nearest trigger wins, and at each position
    // the longest one does, so `@@` is never read as a bare `@`.
    for (let start = cursor.ch - 1; start >= 0; start--) {
      const trigger = this.triggersByLength.find(
        candidate =>
          candidate.sequence.length > 0 &&
          start + candidate.sequence.length <= cursor.ch &&
          line.startsWith(candidate.sequence, start)
      );
      if (!trigger) continue;

      // Keep walking: the `@` of a `@@` fails here, and the `@@` itself is one
      // position further back.
      if (!this.startsAWord(line, start)) continue;

      const isModal = trigger.mode === 'picker';
      const end = start + trigger.sequence.length;

      // A modal trigger opens a dialog: it counts on the keystroke that
      // completes it, never again from further up the line. Keep walking rather
      // than give up — an inline trigger may still govern the caret, and
      // returning null here would close the popup on `@a @@b`.
      if (isModal && end !== cursor.ch) continue;

      this.lastTriggerIsModal = isModal;
      const kept = this.selectionCapture.keptAt(
        { line: cursor.line, ch: start },
        file?.path ?? null
      );
      this.lastKeptText = kept?.text ?? null;
      this.lastKeptAnchor = kept?.anchor ?? null;
      this.lastTriggerRange = {
        editor,
        start: { line: cursor.line, ch: start },
        filePath: file?.path ?? null,
      };
      return {
        start: { line: cursor.line, ch: start },
        end: cursor,
        query: isModal ? '' : line.substring(end, cursor.ch),
      };
    }

    this.lastKeptText = null;
    this.lastKeptAnchor = null;
    // The range is deliberately kept. Backspacing the trigger lands here, and
    // it is the only record of where the trigger stood — `close()` needs it to
    // put the captured selection back. Its shape checks make a stale range
    // harmless, and `close()` clears it in every case.
    return null;
  }

  /**
   * Dismissing takes back what the trigger added, and nothing else.
   *
   * The selected text was never destroyed: it is still in the note, with a
   * separating space and the trigger written after it. So cancelling has
   * nothing to restore — it has to remove. What goes is exactly what the plugin
   * wrote, plus whatever was typed into it, which leaves the line reading as it
   * did before the trigger was pressed.
   *
   * This is why the old rule — only a bare trigger is undone — does not carry
   * over. It stood because a selection replaced by `@toto` was a legitimate
   * edit that undoing would have destroyed. Nothing is at stake now.
   *
   * A picker-mode trigger removes nothing here, and needs no guard for it: the
   * modal path clears the capture before opening, so there is none left to act
   * on. The modal owns its own cancellation from that point.
   */
  close(): void {
    this.removeTriggerFromKeptText();
    // Forgotten whatever happened above. Removing is the only path that used to
    // clear, and it declines whenever the document moved underneath — so a
    // gesture abandoned there left the capture armed, and the next trigger at
    // that position inherited a selection nobody had made.
    this.selectionCapture.clear();
    // And the live Editor the range was holding goes with it.
    this.lastTriggerRange = null;
    super.close();
  }

  private removeTriggerFromKeptText(): void {
    const range = this.lastTriggerRange;
    if (!range) return;

    // The capture, not the cached `lastKeptText`: only the capture is
    // emptied when an entry is validated or the modal takes over, and reading
    // the cache here would cut into what was just inserted.
    const kept = this.selectionCapture.keptAt(range.start, range.filePath);
    if (!kept) return;

    // The line as it stands now, never as `onTrigger` last saw it. Obsidian can
    // be a keystroke behind: dismissing right after the last character arrived
    // found the remembered line still holding the previous state, and an
    // equality test between the two declined the very removal the user had just
    // asked for. Measured in Obsidian.
    const separator = { line: range.start.line, ch: range.start.ch - 1 };
    const line = range.editor.getLine(separator.line);

    // The separating space the plugin wrote must still be there. A document
    // moved underneath — CMD+Z while the popup is open — fails here.
    if (line[separator.ch] !== ' ') return;

    // What already followed the selection bounds the removal on its right. The
    // caret cannot: the popup stays open while the caret wanders past the
    // expression — a click, an arrow key — and cancelling then took the user's
    // own words along with the trigger.
    if (!line.endsWith(kept.tail)) return;
    const end = { line: separator.line, ch: line.length - kept.tail.length };
    if (end.ch <= separator.ch) return;

    // And what stands between the space and that bound has to be ours: the
    // trigger with whatever was typed into it, or nothing at all when the
    // trigger has just been backspaced away.
    const between = line.slice(range.start.ch, end.ch);
    const isOurs =
      between === '' ||
      this.triggersByLength.some(
        ({ sequence }) => sequence.length > 0 && between.startsWith(sequence)
      );
    if (!isOurs) return;

    range.editor.replaceRange('', separator, end);
    this.selectionCapture.clear();
    this.lastTriggerRange = null;
  }

  /**
   * Whether a trigger at `start` sits where a new word may begin: the line
   * start, or after a separator that is not itself part of a trigger.
   */
  private startsAWord(line: string, start: number): boolean {
    if (start === 0) return true;

    if (ENDS_ON_A_WORD.test(line.slice(0, start))) return false;

    // `@` inside `@@` is not a trigger of its own
    return !this.triggersByLength.some(
      ({ sequence }) =>
        sequence.length > 0 &&
        start >= sequence.length &&
        line.startsWith(sequence, start - sequence.length)
    );
  }

  /**
   * Build the popup's entries for what has been typed after the trigger.
   *
   * A modal trigger short-circuits: it opens the picker and lists nothing.
   */
  getSuggestions(context: EditorSuggestContext): DateSuggestion[] {
    if (this.isModalTrigger()) {
      // Cleared before the modal opens — see `selectSuggestion` for why the
      // order matters.
      this.selectionCapture.clear();

      this.handOverToPicker(context);
      return [];
    }

    const expression = context.query.trim();
    const parsed = expression ? this.plugin.nlpService.parse(expression) : null;
    const date = parsed?.date ?? this.plugin.dateService.now();

    const entries: DateSuggestion[] = [];

    // Plain formats only make sense for a date the user actually named: they
    // cannot carry the typed string, so offering them would throw it away.
    if (parsed || !expression) {
      for (const preset of this.plugin.settings.formatPresets) {
        if (!preset.showInSuggest) continue;
        // A time-only format is not a date, and a datetime one would render an
        // hour the user never said — 00:00 passed off as a choice.
        if (preset.type === 'time') continue;
        if (preset.type === 'datetime' && !parsed?.hasTime) continue;
        entries.push({
          kind: 'preset',
          presetId: preset.id,
          date,
          output: this.plugin.formatterService.formatWithPreset(date, preset),
          label: presetName(preset, this.translate),
        });
      }
    }

    // Fixed, never un-pinnable: it is the only entry able to carry the alias.
    //
    // A selection typed over holds the alias, and the expression then only names
    // the date: `réunion de lancement` selected, `@demain` typed, gives
    // `[[2026-08-19|réunion de lancement]]`. With no capture the expression does
    // both, as it always has.
    const alias = this.lastKeptText ?? expression;
    this.showCapturedSelection(expression);
    const dailyNote: DateSuggestion = {
      kind: 'daily-note',
      date,
      alias,
      output: this.plugin.dailyNotesService.generateWikilink(date, {
        customAlias: alias || undefined,
      }),
      label: this.translate('suggest.dailyNoteLink'),
    };

    // With a selection held, the link leads the list.
    //
    // The popup highlights its first entry and ENTER validates the highlighted
    // one. A plain format sitting first would mean that confirming straight away
    // writes the date and drops the held text — the very surprise the capture
    // exists to avoid, moved one step along. The link is the only entry carrying
    // an alias, so it is the only safe default while a capture is held.
    if (this.lastKeptText) {
      entries.unshift(dailyNote);
    } else {
      entries.push(dailyNote);
    }

    entries.push({
      kind: 'open-picker',
      expression,
      output: '',
      label: this.translate('suggest.openPicker'),
    });

    return entries;
  }

  /**
   * Say in the popup where the selection went.
   *
   * Typing the trigger replaced the selection on screen, and nothing else tells
   * the user their text is still held: the note shows the trigger where their
   * words were. The bar names the text, names what the typing is doing instead
   * — the date — and says which key gives everything back.
   *
   * No capture, no bar: the ordinary case gains no furniture.
   */
  private showCapturedSelection(expression: string): void {
    const captured = this.lastKeptText;
    if (!captured) {
      this.setInstructions([]);
      return;
    }

    this.setInstructions([
      {
        command: this.translate('suggest.instructions.selection'),
        purpose: shortenForBar(captured),
      },
      ...(expression
        ? [{ command: this.translate('suggest.instructions.date'), purpose: expression }]
        : []),
      { command: 'Esc', purpose: this.translate('suggest.instructions.cancel') },
    ]);
  }

  renderSuggestion(value: DateSuggestion, el: HTMLElement): void {
    if (value.kind === 'open-picker') {
      el.setText(value.label);
      return;
    }

    // The rendering the entry would insert, with its name beside it: what the
    // user picks from is the result, not the format's name.
    //
    // Both go inside a container of ours. Laying them out would otherwise mean
    // styling `.suggestion-item`, which Obsidian shares with every other
    // plugin's popup.
    const row = el.createDiv({ cls: 'date-suggest-item' });
    row.createDiv({ cls: 'date-suggest-output', text: value.output });
    row.createDiv({ cls: 'date-suggest-label', text: value.label });
  }

  /**
   * Hand the range over to the modal picker, on either path that opens it.
   *
   * Both derive the same thing from the same two fields, and the kept text is
   * part of what confirming replaces — as on the inline path. The trigger's own
   * position travels with it so that cancelling can take back the trigger and
   * leave the text.
   */
  private handOverToPicker(context: EditorSuggestContext, expression?: string): void {
    const anchor = this.lastKeptAnchor;
    this.plugin.showDatePickerFromTrigger(
      context.editor,
      anchor ?? context.start,
      context.end,
      expression,
      anchor && this.lastKeptText !== null
        ? { text: this.lastKeptText, triggerStart: context.start }
        : undefined
    );
  }

  /**
   * Replace trigger and expression with the chosen entry, in one transaction.
   */
  selectSuggestion(value: DateSuggestion): void {
    const context = this.context;
    if (!context) return;

    // The kept text is part of what the entry replaces. Reaching only back to
    // the trigger would leave `réunion de lancement` standing in front of the
    // wikilink that already carries it as its alias.
    const from = this.lastKeptAnchor ?? context.start;

    if (value.kind === 'open-picker') {
      // Cleared BEFORE the modal opens, never after: Obsidian dismisses the
      // popup while `modal.open()` runs, so `close()` lands in the middle of
      // this hand-over. A capture still armed then restores the selection under
      // the modal, which goes on to write its wikilink over the one-character
      // trigger range — eating the first letter and leaving the rest behind.
      //
      // The modal owns the capture from here, and restores it on its own cancel.
      this.selectionCapture.clear();

      // The picker takes over: it replaces the same range, and the expression
      // lands in its NLP field rather than being retyped.
      this.handOverToPicker(context, value.expression);
      return;
    }

    // The capture has served: no later trigger inherits it.
    this.selectionCapture.clear();

    // One `replaceRange` over the whole range, kept text included: a sequence
    // of edits would take one undo each, and the user would have to press
    // CMD/CTRL+Z as many times as the expression had parts.
    context.editor.replaceRange(value.output, from, context.end);
    context.editor.setCursor({
      line: from.line,
      ch: from.ch + value.output.length,
    });
  }
}

/**
 * One line of at most `BAR_TEXT_LIMIT` characters, ellipsis included.
 *
 * Through `sanitizeAlias` itself, not a lookalike: the bar must show what the
 * wikilink will actually carry. Writing the flattening twice had the bar
 * promising `un [[lien]] | tuyau` where the insert delivered `un lien tuyau`,
 * and eating the no-break space that `sanitizeAlias` deliberately keeps.
 */
function shortenForBar(text: string): string {
  const flat = sanitizeAlias(text) ?? '';
  return flat.length <= BAR_TEXT_LIMIT ? flat : `${flat.slice(0, BAR_TEXT_LIMIT - 1)}…`;
}
