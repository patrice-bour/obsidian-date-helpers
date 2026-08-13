import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { DatePickerState } from './date-picker-state';

export interface FormatSelectorDeps {
  state: DatePickerState;
  presets: FormatPreset[];
  settings: DateHelpersSettings;
  formatterService: FormatterService;
  /** User picked a preset in the dropdown */
  onChange(presetId: string): void;
}

/**
 * The format preset <select>, including the "Original Text" pseudo-preset
 * lifecycle (add/remove/relabel as NLP text availability changes) and
 * example refresh against the focused day.
 */
export class FormatSelector {
  private selectEl: HTMLSelectElement | null = null;

  constructor(private deps: FormatSelectorDeps) {}

  /**
   * Build the selector inside the footer. The caller decides whether the
   * selector should exist at all (hidden for open-daily-note).
   */
  render(footer: HTMLElement): void {
    const { state, presets, formatterService } = this.deps;

    this.selectEl = footer.createEl('select', {
      cls: 'date-picker-format-selector',
    });

    const showOriginalTextOption = state.isOriginalTextAvailable();
    const isOriginalTextCurrentlySelected = state.isOriginalTextSelected();

    // Add "Original Text" option first if available (Daily Notes action with text)
    if (showOriginalTextOption && this.selectEl) {
      const option = this.selectEl.createEl('option', {
        value: 'original-text',
        text: this.originalTextLabel(),
      });
      if (isOriginalTextCurrentlySelected) {
        option.selected = true;
      }
    }

    // Add format presets
    presets.forEach(preset => {
      const example = formatterService.getFormatExample(preset.format, state.focusedDay);
      if (!this.selectEl) return;

      const option = this.selectEl.createEl('option', {
        value: preset.id,
        text: `${preset.name} (${example})`,
      });

      // Select this preset if it matches and "original-text" is not selected
      if (preset.id === state.selectedPreset.id && !isOriginalTextCurrentlySelected) {
        option.selected = true;
      }
    });

    this.selectEl.addEventListener('change', () => {
      if (!this.selectEl) return;
      this.deps.onChange(this.selectEl.value);
    });
  }

  /**
   * Update each option's example text against the focused day
   */
  updateExamples(): void {
    if (!this.selectEl) return;

    const options = this.selectEl.options;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const presetId = option.value;

      // Handle "Original Text" pseudo-preset
      if (presetId === 'original-text') {
        option.text = this.originalTextLabel();
        continue;
      }

      const preset = this.deps.presets.find(p => p.id === presetId);
      if (preset) {
        const example = this.deps.formatterService.getFormatExample(
          preset.format,
          this.deps.state.focusedDay
        );
        option.text = `${preset.name} (${example})`;
      }
    }
  }

  /**
   * Sync the "Original Text" option with NLP text availability:
   * add it first when text appears (selecting the configured "with text"
   * preset), remove it when text disappears (selecting the fallback),
   * or relabel it with the current text.
   */
  syncOptions(): void {
    if (!this.selectEl) return;
    // No format selector for open-daily-note (defense in depth: selectEl
    // is also reset for that action, but don't rely on it)
    if (this.deps.state.selectedAction === 'open-daily-note') return;

    const { state, settings } = this.deps;
    const hasOriginalTextOption = this.selectEl.options[0]?.value === 'original-text';
    const shouldHaveOriginalTextOption = state.isOriginalTextAvailable();

    if (shouldHaveOriginalTextOption && !hasOriginalTextOption) {
      // Text just became available - add "Original Text" option at the beginning
      const option = this.selectEl.createEl('option', {
        value: 'original-text',
        text: this.originalTextLabel(),
      });

      this.selectEl.insertBefore(option, this.selectEl.options[0]);

      // Switch to the "with text" preset (dailyNotesAliasPresetId)
      // This could be "original-text" or any other preset configured by user
      const withTextPresetId = settings.dailyNotesAliasPresetId;
      if (withTextPresetId === 'original-text') {
        // Select the "Original Text" option we just added
        option.selected = true;
      } else {
        // Select the configured preset
        for (let i = 0; i < this.selectEl.options.length; i++) {
          if (this.selectEl.options[i].value === withTextPresetId) {
            this.selectEl.options[i].selected = true;
            break;
          }
        }
      }
    } else if (!shouldHaveOriginalTextOption && hasOriginalTextOption) {
      // Text no longer available - remove "Original Text" option
      this.selectEl.remove(0);

      // Switch to the fallback preset
      const fallbackPresetId = settings.dailyNotesAliasFallbackPresetId;
      for (let i = 0; i < this.selectEl.options.length; i++) {
        if (this.selectEl.options[i].value === fallbackPresetId) {
          this.selectEl.options[i].selected = true;
          break;
        }
      }
    } else if (shouldHaveOriginalTextOption && hasOriginalTextOption) {
      // Update the label with current text
      this.selectEl.options[0].text = this.originalTextLabel();
    }
  }

  /**
   * Set the dropdown value ('original-text' or a preset id)
   */
  setValue(value: string): void {
    if (this.selectEl) {
      this.selectEl.value = value;
    }
  }

  /**
   * Drop DOM references (modal close, or hidden for open-daily-note)
   */
  reset(): void {
    this.selectEl = null;
  }

  private originalTextLabel(): string {
    const text = this.deps.state.getOriginalText();
    return text ? `Original Text (${text})` : 'Original Text';
  }
}
