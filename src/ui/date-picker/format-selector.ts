import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { Translate } from '@/i18n/types';
import { presetName } from '@/i18n/preset-labels';
import { AliasSourceId, isAliasSourceId, SELECTED_TEXT_SOURCE } from '@/types/alias-source';
import { sanitizeAlias } from '@/services/daily-notes-service';
import { DatePickerState } from './date-picker-state';

export interface FormatSelectorDeps {
  state: DatePickerState;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
  presets: FormatPreset[];
  settings: DateHelpersSettings;
  formatterService: FormatterService;
  /** User picked a preset in the dropdown */
  onChange(presetId: string): void;
}

/**
 * The format preset <select>, including the text alias source pseudo-presets
 * ("Selected text" and "Typed text") whose lifecycle follows their own text
 * availability, and example refresh against the focused day.
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

    const selectedSource = state.selectedAliasSource();

    // Alias sources come first, in the state's display order
    state.availableAliasSources().forEach(source => {
      if (!this.selectEl) return;
      const option = this.selectEl.createEl('option', {
        value: source,
        text: this.aliasSourceLabel(source),
      });
      if (source === selectedSource) {
        option.selected = true;
      }
    });

    // Add format presets
    presets.forEach(preset => {
      const example = formatterService.getFormatExample(preset.format, state.focusedDay);
      if (!this.selectEl) return;

      const option = this.selectEl.createEl('option', {
        value: preset.id,
        text: `${presetName(preset, this.deps.t)} (${example})`,
      });

      // Select this preset if it matches and no alias source is selected
      if (preset.id === state.selectedPreset.id && !selectedSource) {
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

      // Alias sources carry their text, not a formatted date
      if (isAliasSourceId(presetId)) {
        option.text = this.aliasSourceLabel(presetId);
        continue;
      }

      const preset = this.deps.presets.find(p => p.id === presetId);
      if (preset) {
        const example = this.deps.formatterService.getFormatExample(
          preset.format,
          this.deps.state.focusedDay
        );
        option.text = `${presetName(preset, this.deps.t)} (${example})`;
      }
    }
  }

  /**
   * Sync the alias source options with text availability: add a source when
   * its text appears (selecting the configured "with text" preset), remove it
   * when its text disappears (selecting the fallback if no source is left),
   * or relabel it with the current text.
   */
  syncOptions(): void {
    if (!this.selectEl) return;
    // No format selector for open-daily-note (defense in depth: selectEl
    // is also reset for that action, but don't rely on it)
    if (this.deps.state.selectedAction === 'open-daily-note') return;

    const { state } = this.deps;
    const listed = this.listedAliasSources();
    const available = state.availableAliasSources();

    const added = available.filter(source => !listed.includes(source));
    const removed = listed.filter(source => !available.includes(source));

    // Insert missing sources, keeping the state's display order
    available.forEach((source, index) => {
      if (!this.selectEl || !added.includes(source)) return;
      const option = this.selectEl.createEl('option', {
        value: source,
        text: this.aliasSourceLabel(source),
      });
      this.selectEl.insertBefore(option, this.selectEl.options[index] ?? null);
    });

    // Drop sources whose text is gone
    removed.forEach(source => {
      if (!this.selectEl) return;
      const index = Array.from(this.selectEl.options).findIndex(o => o.value === source);
      if (index >= 0) this.selectEl.remove(index);
    });

    // Relabel the sources that stayed
    available.forEach(source => {
      if (!this.selectEl || added.includes(source)) return;
      const option = Array.from(this.selectEl.options).find(o => o.value === source);
      if (option) option.text = this.aliasSourceLabel(source);
    });

    if (added.length === 0 && removed.length === 0) return;

    // Availability changed: ask the state what should be selected now. Reading
    // `dailyNotesAliasPresetId` directly would put a value in the control that
    // the control does not offer — a source with no text is not listed, and the
    // dropdown then renders blank.
    this.setValue(state.getPresetIdForAction(state.selectedAction));
  }

  /**
   * Set the dropdown value (an alias source id or a preset id).
   *
   * A value the control does not offer leaves `<select>` on `selectedIndex -1`,
   * rendering blank — a state no keystroke can produce and no user can read.
   * Callers compute that value from settings that are validated more loosely
   * than this list is built, so the last word belongs here.
   */
  setValue(value: string): void {
    if (!this.selectEl) return;

    const offered = Array.from(this.selectEl.options).some(option => option.value === value);
    if (!offered) return;

    this.selectEl.value = value;
  }

  /**
   * Drop DOM references (modal close, or hidden for open-daily-note)
   */
  reset(): void {
    this.selectEl = null;
  }

  /** The alias sources currently present in the <select>, in DOM order */
  private listedAliasSources(): AliasSourceId[] {
    if (!this.selectEl) return [];
    return Array.from(this.selectEl.options)
      .map(o => o.value)
      .filter(isAliasSourceId);
  }

  private aliasSourceLabel(source: AliasSourceId): string {
    // Through the same cleanup the insertion applies: the option shows the
    // alias that will be written, not the raw text it came from.
    const text = sanitizeAlias(this.deps.state.getAliasSourceText(source) ?? undefined);
    if (source === SELECTED_TEXT_SOURCE) {
      return text
        ? this.deps.t('picker.selectedTextWith', { text })
        : this.deps.t('picker.selectedText');
    }
    return text ? this.deps.t('picker.typedTextWith', { text }) : this.deps.t('picker.typedText');
  }
}
