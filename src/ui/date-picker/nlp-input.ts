import { Setting } from 'obsidian';
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
 * The natural-language input field and its preview element, including
 * the restore-after-re-render semantics (never restores after an
 * explicit clear) and the preview CSS state transitions.
 */
export class NLPInputController {
  private nlpInputEl: HTMLInputElement | null = null;
  private nlpPreviewEl: HTMLElement | null = null;

  constructor(private deps: NLPInputDeps) {}

  render(container: HTMLElement): void {
    const nlpContainer = container.createDiv({ cls: 'nlp-input-container' });

    new Setting(nlpContainer)
      .setName(this.deps.t('picker.nlp.name'))
      .setDesc(this.deps.t('picker.nlp.desc'))
      .addText(text => {
        this.nlpInputEl = text.inputEl;
        text
          .setPlaceholder(this.deps.t('picker.nlp.placeholder'))
          .onChange(value => this.deps.onInput(value));

        // Restore NLP text (currentNLPText preserves user edits across re-renders)
        // Don't fall back to initialNLPText if user explicitly cleared the field
        const textToRestore = this.deps.state.getRestorableNLPText();
        if (textToRestore) {
          text.setValue(textToRestore);
          this.deps.onInput(textToRestore);
        }

        // Submit on Enter key
        this.nlpInputEl?.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.deps.onSubmit();
          }
        });
      });

    // Preview
    this.nlpPreviewEl = nlpContainer.createDiv({ cls: 'nlp-preview' });
    this.showEmpty();

    // Re-trigger NLP preview now that nlpPreviewEl exists
    // (the addText callback above runs before nlpPreviewEl is created)
    const textForPreview = this.deps.state.getRestorableNLPText();
    if (textForPreview) {
      this.deps.onInput(textForPreview);
    }
  }

  showEmpty(): void {
    if (!this.nlpPreviewEl) return;
    this.nlpPreviewEl.setText(this.deps.t('picker.nlp.previewEmpty'));
    this.nlpPreviewEl.removeClass('nlp-preview-success', 'nlp-preview-error');
    this.nlpPreviewEl.addClass('nlp-preview-empty');
  }

  showError(): void {
    if (!this.nlpPreviewEl) return;
    this.nlpPreviewEl.setText(this.deps.t('picker.nlp.previewError'));
    this.nlpPreviewEl.removeClass('nlp-preview-success', 'nlp-preview-empty');
    this.nlpPreviewEl.addClass('nlp-preview-error');
  }

  showSuccess(preview: string): void {
    if (!this.nlpPreviewEl) return;
    this.nlpPreviewEl.setText(`✓  ${preview}`);
    this.nlpPreviewEl.removeClass('nlp-preview-error', 'nlp-preview-empty');
    this.nlpPreviewEl.addClass('nlp-preview-success');
  }

  get inputEl(): HTMLInputElement | null {
    return this.nlpInputEl;
  }

  get hasPreview(): boolean {
    return this.nlpPreviewEl !== null;
  }

  /**
   * Drop DOM references (modal close)
   */
  reset(): void {
    this.nlpInputEl = null;
    this.nlpPreviewEl = null;
  }
}
