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
  /** True while the NLP input has focus ('t' must pass through) */
  isTypingInNLP(): boolean;
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
  scope.register([], 'ArrowRight', () => {
    handlers.onDayMove('next');
    return false;
  });

  scope.register([], 'ArrowLeft', () => {
    handlers.onDayMove('prev');
    return false;
  });

  scope.register([], 'ArrowDown', () => {
    handlers.onDayMove('down');
    return false;
  });

  scope.register([], 'ArrowUp', () => {
    handlers.onDayMove('up');
    return false;
  });

  scope.register([], 'Enter', () => {
    handlers.onConfirm();
    return false;
  });

  scope.register([], 'PageDown', () => {
    handlers.onMonthMove('next');
    return false;
  });

  scope.register([], 'PageUp', () => {
    handlers.onMonthMove('prev');
    return false;
  });

  scope.register([], 'Home', () => {
    handlers.onToday();
    return false;
  });

  // macOS-friendly alternatives
  scope.register(['Mod'], 'ArrowDown', () => {
    handlers.onMonthMove('next');
    return false;
  });

  scope.register(['Mod'], 'ArrowUp', () => {
    handlers.onMonthMove('prev');
    return false;
  });

  // Year navigation
  scope.register(['Mod'], 'ArrowLeft', () => {
    handlers.onYearMove('prev');
    return false;
  });

  scope.register(['Mod'], 'ArrowRight', () => {
    handlers.onYearMove('next');
    return false;
  });

  // 'T' for Today (only if not typing in NLP field)
  scope.register([], 't', () => {
    if (handlers.isTypingInNLP()) {
      return true; // Let the keystroke pass through
    }
    handlers.onToday();
    return false;
  });
}
