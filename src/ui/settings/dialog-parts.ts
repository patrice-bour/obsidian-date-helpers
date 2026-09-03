import { Setting } from 'obsidian';
import { Translate } from '@/i18n/types';

/**
 * The two pieces every settings dialog in this plugin ends with.
 *
 * Helpers rather than a base class: there are two dialogs, and inheritance for
 * two is a hierarchy nobody asked for. What repeats is the shape of the footer
 * and the warning line, not the behaviour — each dialog keeps its own.
 */

/** The line a dialog reports a refusal on. Empty until something is refused. */
export function warningLine(contentEl: HTMLElement): HTMLElement {
  return contentEl.createEl('p', { cls: 'setting-item-description mod-warning' });
}

export interface DialogFooter {
  t: Translate;
  /** What the confirming button says */
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Cancel on the left, confirm on the right, the confirm one accented.
 *
 * The accent is here rather than at each call site because two neighbouring
 * dialogs wearing different faces is the kind of difference nobody chose.
 */
export function dialogFooter(
  contentEl: HTMLElement,
  { t, submitLabel, onSubmit, onCancel }: DialogFooter
): void {
  new Setting(contentEl)
    .addButton(button => button.setButtonText(t('picker.cancel')).onClick(onCancel))
    .addButton(button => button.setButtonText(submitLabel).setCta().onClick(onSubmit));
}
