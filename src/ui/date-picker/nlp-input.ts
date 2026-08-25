import { Translate } from '@/i18n/types';
import { DatePickerState } from './date-picker-state';

export interface NLPInputDeps {
  state: DatePickerState;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
  /** Text changed (typing or programmatic restore) — owner refreshes the preview */
  onInput(text: string): void;
  /** Enter pressed in the field — owner confirms the focused day */
  onSubmit(): void;
}

/**
 * The natural-language input field, including the restore-after-re-render
 * semantics: it never restores after an explicit clear.
 *
 * The field describes itself. Its placeholder names example expressions, so a
 * reader meeting it for the first time sees what it accepts — where a label and
 * a description used to take three lines to say the same thing.
 *
 * What the expression resolves to is not shown here: the calendar marks the day,
 * and the footer's result line shows what will be inserted. Only a failure needs
 * words, and the modal's status row carries it.
 *
 * Which is why `render()` does NOT call back into the owner with the restored
 * text. It used to, and it runs before the status row and the footer exist, so
 * a failure was written into a row that was not there — or, on a redraw, into
 * the detached one. The border reddened and nothing said why. The owner reads
 * the field itself, once everything it drives has been built.
 */
export class NLPInputController {
  private nlpInputEl: HTMLInputElement | null = null;

  constructor(private deps: NLPInputDeps) {}

  render(container: HTMLElement): void {
    const nlpContainer = container.createDiv({ cls: 'nlp-input-container' });

    const input = nlpContainer.createEl('input', { cls: 'nlp-input' });
    input.type = 'text';
    this.nlpInputEl = input;
    input.placeholder = this.deps.t('picker.nlp.placeholder');
    input.addEventListener('input', () => this.deps.onInput(input.value));

    // Restore NLP text (currentNLPText preserves user edits across re-renders)
    // Don't fall back to initialNLPText if user explicitly cleared the field
    const textToRestore = this.deps.state.getRestorableNLPText();
    if (textToRestore) {
      input.value = textToRestore;
    }

    // Submit on Enter key
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.deps.onSubmit();
      }
    });
  }

  get inputEl(): HTMLInputElement | null {
    return this.nlpInputEl;
  }

  /**
   * Drop DOM references (modal close)
   */
  reset(): void {
    this.nlpInputEl = null;
  }
}
