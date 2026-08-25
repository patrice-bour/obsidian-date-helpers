import { Scope } from 'obsidian';

/**
 * Callbacks the keyboard map drives. The owner (modal) decides how each
 * action affects state and rendering.
 */
export interface DatePickerKeyHandlers {
  onDayMove(direction: 'next' | 'prev' | 'up' | 'down'): void;
  onMonthMove(direction: 'next' | 'prev'): void;
  onYearMove(direction: 'next' | 'prev'): void;
  onToday(): void;
  onConfirm(): void;
  /** True while one of the picker's text fields has focus ('t' must pass through) */
  isTypingInField(): boolean;
  /**
   * True while one of the picker's text fields has focus AND holds text.
   *
   * The arrows need the narrower question. The picker opens with the focus in
   * the expression field, so yielding on focus alone would leave the calendar
   * unreachable by keyboard until the user left it. An empty field has no word
   * to protect; a filled one does.
   */
  isEditingFieldText(): boolean;
}

/**
 * Register the date picker keyboard map on a modal scope.
 *
 * The 13 bindings (and their registration order) are part of the
 * modal's characterized contract — do not reorder:
 * Arrows (day), Enter, PageDown/PageUp (month), Home (today),
 * Mod+Down/Up (month), Mod+Left/Right (year), 't' (today, NLP-aware).
 */
export function registerDatePickerKeys(scope: Scope, handlers: DatePickerKeyHandlers): void {
  // The four unmodified arrows yield to a text field only while it HOLDS TEXT.
  // Without yielding at all, an arrow pressed mid-word cleared the field *and* —
  // since a redraw now focuses a day cell — moved the keyboard focus out of it,
  // so the user lost both their text and their place. Yielding on focus alone
  // would be the opposite mistake: the picker opens with the focus in an empty
  // field, and the calendar would answer no arrow at all.
  //
  // 't' keeps the wider guard, below: `today`, `tomorrow` and `thursday` all
  // start with it, so a jump to today instead of a typed letter would make the
  // field unusable from its very first keystroke.
  //
  // The SAME text guard covers `Home`, `PageUp`, `PageDown` and the four
  // `Mod`+arrows further down. Every one of them reaches `clearNLPInput()`, and
  // the picker now opens with the focus in the field, so each was a way to lose
  // a half-typed expression AND the place in it. `Home` and `Mod+←` are how
  // macOS says "start of line" inside a text field — they are not exotic keys.
  scope.register([], 'ArrowRight', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onDayMove('next');
    return false;
  });

  scope.register([], 'ArrowLeft', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onDayMove('prev');
    return false;
  });

  scope.register([], 'ArrowDown', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onDayMove('down');
    return false;
  });

  scope.register([], 'ArrowUp', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onDayMove('up');
    return false;
  });

  scope.register([], 'Enter', () => {
    handlers.onConfirm();
    return false;
  });

  scope.register([], 'PageDown', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onMonthMove('next');
    return false;
  });

  scope.register([], 'PageUp', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onMonthMove('prev');
    return false;
  });

  scope.register([], 'Home', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onToday();
    return false;
  });

  // macOS-friendly alternatives
  scope.register(['Mod'], 'ArrowDown', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onMonthMove('next');
    return false;
  });

  scope.register(['Mod'], 'ArrowUp', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onMonthMove('prev');
    return false;
  });

  // Year navigation
  scope.register(['Mod'], 'ArrowLeft', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onYearMove('prev');
    return false;
  });

  scope.register(['Mod'], 'ArrowRight', () => {
    if (handlers.isEditingFieldText()) return true;
    handlers.onYearMove('next');
    return false;
  });

  // 'T' for Today (only if not typing in NLP field)
  scope.register([], 't', () => {
    if (handlers.isTypingInField()) {
      return true; // Let the keystroke pass through
    }
    handlers.onToday();
    return false;
  });
}
