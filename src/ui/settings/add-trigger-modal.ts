import { App, Modal, Setting } from 'obsidian';
import { Translate } from '@/i18n/types';
import { MAX_TRIGGER_LENGTH } from '@/utils/constants';
import { TriggerConfig, TriggerMode } from '@/types/settings';

/**
 * The mode a new trigger gets unless the user says otherwise.
 *
 * The picker is the surface the plugin is named for, and the one a user adding
 * their first trigger is most likely after. Not derived from what they type:
 * length decides nothing any more, and a default that moved as the field was
 * typed would be the old invisible rule wearing a dropdown.
 */
const DEFAULT_TRIGGER_MODE: TriggerMode = 'picker';

export interface AddTriggerModalOptions {
  /** Sequences already configured, used for the duplicate check. */
  existing: string[];
  t: Translate;
  onSubmit: (trigger: TriggerConfig) => void;
}

/**
 * Validate a candidate trigger.
 * @returns the error message to display, or undefined when the value is valid.
 */
export function validateTrigger(
  value: string,
  existing: string[],
  t: Translate
): string | undefined {
  const trimmed = value.trim();

  if (trimmed === '') {
    return t('settings.triggers.validation.empty');
  }
  if (trimmed.length > MAX_TRIGGER_LENGTH) {
    return t('settings.triggers.validation.tooLong', { max: MAX_TRIGGER_LENGTH });
  }
  if (existing.includes(trimmed)) {
    return t('settings.triggers.validation.duplicate');
  }
  return undefined;
}

/**
 * Dialog behind the `+` affordance of the trigger list.
 *
 * Errors are shown inline and the dialog stays open, so a rejected entry can be
 * corrected instead of retyped — the previous inline row reported through a
 * Notice and cleared nothing.
 */
export class AddTriggerModal extends Modal {
  private readonly options: AddTriggerModalOptions;
  private value = '';
  private mode: TriggerMode = DEFAULT_TRIGGER_MODE;
  private errorEl: HTMLElement | null = null;

  constructor(app: App, options: AddTriggerModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    const { t } = this.options;

    contentEl.empty();
    contentEl.createEl('h3', { text: t('settings.triggers.addTitle') });

    new Setting(contentEl)
      .setName(t('settings.triggers.characters.name'))
      .setDesc(t('settings.triggers.characters.desc', { max: MAX_TRIGGER_LENGTH }))
      .addText(text =>
        text.setPlaceholder(t('settings.triggers.characters.placeholder')).onChange(value => {
          this.value = value;
        })
      );

    // Both modes, whatever the sequence: a three-character inline trigger works
    // end to end, and hiding the option would reinstate the length rule this
    // change removes.
    new Setting(contentEl)
      .setName(t('settings.triggers.mode.name'))
      .setDesc(t('settings.triggers.mode.desc'))
      .addDropdown(dropdown =>
        dropdown
          .addOption('picker', t('settings.triggers.mode.picker'))
          .addOption('inline', t('settings.triggers.mode.inline'))
          .setValue(this.mode)
          .onChange(value => {
            this.mode = value as TriggerMode;
          })
      );

    this.errorEl = contentEl.createEl('p', {
      cls: 'setting-item-description mod-warning',
    });

    new Setting(contentEl)
      .addButton(button => button.setButtonText(t('picker.cancel')).onClick(() => this.close()))
      .addButton(button =>
        button.setButtonText(t('settings.triggers.add')).onClick(() => this.submit())
      );
  }

  onClose(): void {
    this.contentEl.empty();
    this.errorEl = null;
  }

  private submit(): void {
    const { existing, t, onSubmit } = this.options;
    const error = validateTrigger(this.value, existing, t);

    if (error) {
      this.showError(error);
      return;
    }

    this.showError('');
    onSubmit({ sequence: this.value.trim(), mode: this.mode });
    this.close();
  }

  private showError(message: string): void {
    if (this.errorEl) {
      this.errorEl.setText(message);
    }
  }
}
