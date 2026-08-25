import { FormatterService } from '@/services/formatter-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { Translate } from '@/i18n/types';
import { AliasSourceId, isAliasSourceId } from '@/types/alias-source';
import { DatePickerState } from './date-picker-state';
import { outputForOption, OutputDeps } from './output';
import { shortenOutputLabel } from './option-label';

export interface FormatSelectorDeps {
  state: DatePickerState;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
  presets: FormatPreset[];
  settings: DateHelpersSettings;
  formatterService: FormatterService;
  dailyNotesService: DailyNotesService;
  /** User picked a preset in the dropdown */
  onChange(presetId: string): void;
}

/**
 * The format preset <select>, including the text alias source pseudo-presets
 * whose lifecycle follows their own text availability.
 *
 * It is the picker's preview surface: every option is labelled with the output
 * it would write, not with the name of a preset. A name made the user imagine
 * the result; the result itself needs no imagining. The options keep a stable
 * order — alias sources, then format presets — and the closed control shows the
 * active one, which is what puts the active output under the eye.
 */
export class FormatSelector {
  private selectEl: HTMLSelectElement | null = null;

  constructor(private deps: FormatSelectorDeps) {}

  /**
   * Build the selector inside the footer. The caller decides whether the
   * selector should exist at all (hidden for open-daily-note).
   */
  render(footer: HTMLElement): void {
    const { state, presets } = this.deps;

    this.selectEl = footer.createEl('select', {
      cls: 'date-picker-format-selector',
    });

    const selectedSource = state.selectedAliasSource();

    // Alias sources come first, in the state's display order
    state.availableAliasSources().forEach(source => {
      if (!this.selectEl) return;
      const option = this.selectEl.createEl('option', {
        value: source,
        text: this.optionLabel(source),
      });
      if (source === selectedSource) {
        option.selected = true;
      }
    });

    // Add format presets
    presets.forEach(preset => {
      if (!this.selectEl) return;

      const option = this.selectEl.createEl('option', {
        value: preset.id,
        text: this.optionLabel(preset.id),
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
   * Relabel every option against the focused day.
   *
   * The labels ARE the preview, so this runs wherever the focused day moves —
   * an arrow key, a parsed expression, the Today button.
   */
  updateExamples(): void {
    if (!this.selectEl) return;

    const options = this.selectEl.options;
    for (let i = 0; i < options.length; i++) {
      options[i].text = this.optionLabel(options[i].value);
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
        text: this.optionLabel(source),
      });
      this.selectEl.insertBefore(option, this.selectEl.options[index] ?? null);
    });

    // Drop sources whose text is gone
    removed.forEach(source => {
      if (!this.selectEl) return;
      const index = Array.from(this.selectEl.options).findIndex(o => o.value === source);
      if (index >= 0) this.selectEl.remove(index);
    });

    // Relabel everything that stayed. Not only the alias sources: a keystroke
    // moves the focused day when the expression parses, and every label — the
    // format ones included — is built against that day.
    this.updateExamples();

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

  /**
   * What this option would write, shortened to fit a dropdown line.
   *
   * Through the same path the insertion takes, so the label cannot promise an
   * alias the insertion would refuse — including the cleanup a wikilink alias
   * goes through.
   */
  private optionLabel(optionId: string): string {
    const deps: OutputDeps = {
      state: this.deps.state,
      formatterService: this.deps.formatterService,
      dailyNotesService: this.deps.dailyNotesService,
      t: this.deps.t,
    };
    return shortenOutputLabel(outputForOption(optionId, this.deps.state.focusedDay, deps));
  }
}
