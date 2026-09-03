import { App, Modal, Setting } from 'obsidian';
import { Translate } from '@/i18n/types';
import { FormatPreset } from '@/types/format-preset';
import { FormatterService } from '@/services/formatter-service';
import { readFormat } from '@/services/format-syntax';
import { dialogFooter, warningLine } from './dialog-parts';
import { DraftProblem, PresetDraft, readDraft } from '@/utils/preset-editing';

export interface PresetEditorOptions {
  /** Every preset already stored — the name check reads it */
  existing: FormatPreset[];
  /** The preset being edited, absent when one is being created */
  editing?: FormatPreset;
  t: Translate;
  formatter: FormatterService;
  onSubmit: (draft: PresetDraft) => void;
}

/** The sentence a refusal reads as. Explicit keys: the guard compiles lookups. */
export function problemMessage(problem: DraftProblem, t: Translate): string {
  if (problem.field === 'name') {
    return problem.reason === 'empty'
      ? t('settings.presets.editor.nameEmpty')
      : t('settings.presets.editor.nameDuplicate');
  }
  switch (problem.reason) {
    case 'empty':
      return t('settings.presets.editor.formatEmpty');
    case 'unclosedLiteral':
      return t('settings.presets.editor.formatUnclosed', { opener: problem.offender ?? '' });
    case 'noToken':
      return t('settings.presets.editor.formatNoToken');
    default:
      return t('settings.presets.editor.formatUnknownToken', { token: problem.offender ?? '' });
  }
}

/**
 * Dialog behind the `+` of the preset list, and behind a user preset's pencil.
 *
 * The preview under the format field is the point of the dialog: it is what
 * settles the ambiguity no rule can — see `format-syntax.ts` — and no wording
 * about which syntax is which is worth as much to the user as seeing today's
 * date come out the way they meant.
 */
export class PresetEditorModal extends Modal {
  private readonly options: PresetEditorOptions;
  private draft: PresetDraft;
  private previewEl: HTMLElement | null = null;
  private errorEl: HTMLElement | null = null;

  constructor(app: App, options: PresetEditorOptions) {
    super(app);
    this.options = options;
    this.draft = {
      name: options.editing?.name ?? '',
      format: options.editing?.format ?? '',
      type: options.editing?.type ?? 'date',
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    const { t, editing } = this.options;

    contentEl.empty();
    contentEl.createEl('h3', {
      text: editing ? t('settings.presets.editor.editTitle') : t('settings.presets.add'),
    });

    new Setting(contentEl)
      .setName(t('settings.presets.editor.name'))
      .setDesc(t('settings.presets.editor.nameDesc'))
      .addText(text =>
        text.setValue(this.draft.name).onChange(value => {
          this.draft.name = value;
          this.refreshPreview();
        })
      );

    new Setting(contentEl)
      .setName(t('settings.presets.editor.format'))
      .setDesc(t('settings.presets.editor.formatDesc'))
      .addText(text =>
        // No placeholder: the lint rule wants sentence case, and a format
        // string lowercased is a different format — `mm` is minutes, not
        // months. The description carries both spellings instead, where it is
        // prose and reads as such.
        text.setValue(this.draft.format).onChange(value => {
          this.draft.format = value;
          this.refreshPreview();
        })
      );

    new Setting(contentEl)
      .setName(t('settings.presets.editor.type'))
      .setDesc(t('settings.presets.editor.typeDesc'))
      .addDropdown(dropdown =>
        dropdown
          .addOption('date', t('settings.presets.dateFormats'))
          .addOption('time', t('settings.presets.timeFormats'))
          .addOption('datetime', t('settings.presets.dateTimeFormats'))
          .setValue(this.draft.type)
          .onChange(value => {
            this.draft.type = value as FormatPreset['type'];
          })
      );

    this.previewEl = contentEl.createEl('p', { cls: 'setting-item-description preset-preview' });
    this.errorEl = warningLine(contentEl);
    this.refreshPreview();

    dialogFooter(contentEl, {
      t,
      submitLabel: t('settings.presets.editor.save'),
      onSubmit: () => this.submit(),
      onCancel: () => this.close(),
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.previewEl = null;
    this.errorEl = null;
  }

  /**
   * Show what the format would write, or why it cannot be read.
   *
   * `readFormat`, not `readDraft`: the preview is about the format and nothing
   * else. Routed through the draft it collided with the very preset being
   * edited — same name, not built-in, already in the list — and a duplicate
   * name is not a format problem, so the dialog fell silent: no preview, no
   * message, on the surface the dialog exists for.
   */
  private refreshPreview(): void {
    const { t, formatter } = this.options;
    const lu = readFormat(this.draft.format);

    if (lu.ok) {
      this.previewEl?.setText(
        t('settings.presets.editor.preview', { example: formatter.getFormatExample(lu.format) })
      );
      this.showError('');
      return;
    }

    this.previewEl?.setText('');
    this.showError(problemMessage({ field: 'format', ...lu }, t));
  }

  private showError(message: string): void {
    this.errorEl?.setText(message);
  }

  private submit(): void {
    const { existing, editing, t, onSubmit } = this.options;
    const lu = readDraft(this.draft, existing, editing?.id);

    if (!lu.ok) {
      this.showError(problemMessage(lu.problem, t));
      return;
    }

    onSubmit(this.draft);
    this.close();
  }
}
