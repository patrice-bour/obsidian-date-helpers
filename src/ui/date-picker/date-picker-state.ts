import { DateTime } from 'luxon';
import { DateService } from '@/services/date-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { isSameDay } from '@/utils/calendar-grid';
import {
  ALIAS_SOURCE_IDS,
  AliasSourceId,
  isAliasSourceId,
  SELECTED_TEXT_SOURCE,
} from '@/types/alias-source';
import { DateAction } from './types';

export interface DatePickerStateOptions {
  /** Action the user asked for, by running a command. Remembered on opening. */
  initialAction?: DateAction;
  /**
   * Tab the picker opens on because the context calls for it, not because the
   * user chose it — a trigger typed over a selection opens on the link tab,
   * the only one an alias means anything to.
   *
   * Deliberately not `initialAction`: that one is written to `lastUsedAction`
   * at construction, and a tab nobody asked for must not overwrite what the
   * user last did. Confirming from it still remembers, as confirming always has.
   */
  openOnAction?: DateAction;
  initialNLPText?: string;
  /**
   * Text selected in the editor when the picker opened. A source of its own,
   * never merged into the NLP field: the user can type an expression without
   * losing the selection as an alias candidate.
   */
  selectionText?: string;
}

/**
 * Result of feeding new NLP text into the state
 */
export interface NLPTextUpdate {
  trimmedText: string;
  /** True when text availability flipped (none ↔ some) */
  availabilityChanged: boolean;
}

/**
 * All non-DOM state of the unified date picker: selected action and
 * preset, calendar view month and focused day, NLP text tracking
 * (including the explicit-clear semantics), and preset resolution.
 *
 * Persists user choices to settings via the injected saveSettings,
 * exactly like the original modal did. Owns no DOM.
 */
export class DatePickerState {
  selectedAction: DateAction;
  selectedPreset: FormatPreset;
  viewMonth: DateTime;
  focusedDay: DateTime;

  /** Initial text (e.g. from "Convert selection to date") */
  initialNLPText: string | null;
  /** Current NLP text (from input field or initial selection) */
  currentNLPText: string | null;
  /**
   * Date parsed from the NLP expression (validates typed-text alias usage).
   *
   * Private, with `setNLPParseResult` as its only door: assigning it directly
   * would leave `nlpParseAttempted` behind, and the validation reads both.
   */
  private nlpParsedDate: DateTime | null = null;
  /** Whether the NLP text has been through the parser — see {@link selectionParseAttempted} */
  private nlpParseAttempted = false;
  /** Whether the user explicitly cleared the NLP field */
  nlpTextWasCleared = false;

  /** Editor selection carried into the picker; unaffected by NLP input */
  readonly selectionText: string | null;
  /** Date the selection parsed to, when it parsed at all */
  selectionParsedDate: DateTime | null = null;
  /**
   * Whether the selection has been through the parser. Distinguishes "parsed
   * to no date", which exempts the text from date validation, from "not parsed
   * yet", about which nothing can be concluded.
   */
  private selectionParseAttempted = false;

  /**
   * Set once the user picks an entry in the format selector. Until then the
   * selection, when there is one, outranks the stored preference — after that
   * the user's explicit choice holds for the rest of the session.
   */
  private aliasSourceChosenByUser = false;

  constructor(
    private presets: FormatPreset[],
    private settings: DateHelpersSettings,
    private dateService: DateService,
    private saveSettings: () => Promise<void>,
    opts: DatePickerStateOptions = {}
  ) {
    if (!presets || presets.length === 0) {
      throw new Error('UnifiedDatePickerModal requires at least one format preset');
    }

    this.selectedAction =
      opts.initialAction || opts.openOnAction || settings.lastUsedAction || 'insert-text';

    // If initialAction was provided (direct command), persist it immediately
    if (opts.initialAction) {
      this.settings.lastUsedAction = opts.initialAction;
      this.persist();
    }

    // Store the text sources BEFORE preset resolution (getPresetIdForAction reads both)
    this.initialNLPText = opts.initialNLPText || null;
    this.currentNLPText = this.initialNLPText;
    this.selectionText = opts.selectionText?.trim() || null;

    // Determine initial preset based on selected action
    this.selectedPreset = this.resolveBackingPreset(this.getPresetIdForAction(this.selectedAction));

    // Initialize calendar to current month/day
    const now = this.dateService.now();
    this.viewMonth = now.startOf('month');
    this.focusedDay = now.startOf('day');
  }

  /**
   * Fire-and-forget settings persistence (matches original modal behavior)
   */
  private persist(): void {
    this.saveSettings().catch(e => console.error('Failed to save settings:', e));
  }

  /**
   * Resolve a preset id to a concrete preset. A text alias source has no
   * matching FormatPreset — the fallback preset backs it.
   */
  private resolveBackingPreset(presetId: string): FormatPreset {
    if (isAliasSourceId(presetId)) {
      const fallbackId = this.settings.dailyNotesAliasFallbackPresetId;
      return this.presets.find(p => p.id === fallbackId) || this.presets[0];
    }
    return this.presets.find(p => p.id === presetId) || this.presets[0];
  }

  /**
   * Update selected action, resolve its preset, persist.
   * Returns the resolved preset ID (a text alias source included) so the
   * caller can sync the format selector.
   */
  setSelectedAction(action: DateAction): string {
    this.selectedAction = action;
    this.settings.lastUsedAction = action;

    const presetId = this.getPresetIdForAction(action);
    if (isAliasSourceId(presetId)) {
      this.selectedPreset = this.resolveBackingPreset(presetId);
    } else {
      // Unknown ids keep the previous preset (unlike construction)
      const preset = this.presets.find(p => p.id === presetId);
      if (preset) {
        this.selectedPreset = preset;
      }
    }

    this.persist();
    return presetId;
  }

  /**
   * Update selected preset by ID and persist it to the setting matching
   * the current action. Handles the text alias sources.
   */
  setSelectedPreset(presetId: string): void {
    if (isAliasSourceId(presetId)) {
      if (
        this.selectedAction === 'insert-daily-note' ||
        this.selectedAction === 'open-daily-note'
      ) {
        this.settings.dailyNotesAliasPresetId = presetId;
        this.aliasSourceChosenByUser = true;
        this.persist();
      }
      return;
    }

    const preset = this.presets.find(p => p.id === presetId);
    if (preset) {
      this.selectedPreset = preset;

      // Persist to correct setting based on current action
      if (this.selectedAction === 'insert-text') {
        this.settings.defaultDatePresetId = presetId;
      } else if (
        this.selectedAction === 'insert-daily-note' ||
        this.selectedAction === 'open-daily-note'
      ) {
        this.settings.dailyNotesAliasPresetId = presetId;
        this.aliasSourceChosenByUser = true;
      }

      this.persist();
    }
  }

  /**
   * Set focused day; view month follows when the day is in another month
   */
  setFocusedDay(day: DateTime): void {
    this.focusedDay = day.startOf('day');
    if (!this.viewMonth.hasSame(day, 'month')) {
      this.viewMonth = day.startOf('month');
    }
  }

  setViewMonth(month: DateTime): void {
    this.viewMonth = month.startOf('month');
  }

  /**
   * Navigate view month; clears NLP state (calendar-driven interaction)
   */
  navigateMonth(direction: 'next' | 'prev'): void {
    this.clearNLPInput();
    this.viewMonth =
      direction === 'next'
        ? this.viewMonth.plus({ months: 1 })
        : this.viewMonth.minus({ months: 1 });
  }

  /**
   * Navigate view year; clears NLP state (calendar-driven interaction)
   */
  navigateYear(direction: 'next' | 'prev'): void {
    this.clearNLPInput();
    this.viewMonth =
      direction === 'next' ? this.viewMonth.plus({ years: 1 }) : this.viewMonth.minus({ years: 1 });
  }

  /**
   * Compute the new focused day for a keyboard move; clears NLP state.
   * The caller applies it through setFocusedDay (which also syncs the
   * view month and lets the UI refresh examples).
   */
  navigateDay(direction: 'next' | 'prev' | 'up' | 'down'): DateTime {
    let newDay: DateTime;
    switch (direction) {
      case 'next':
        newDay = this.focusedDay.plus({ days: 1 });
        break;
      case 'prev':
        newDay = this.focusedDay.minus({ days: 1 });
        break;
      case 'down':
        newDay = this.focusedDay.plus({ weeks: 1 });
        break;
      case 'up':
        newDay = this.focusedDay.minus({ weeks: 1 });
        break;
    }
    this.clearNLPInput();
    return newDay;
  }

  /**
   * Today's date (start of day); clears NLP state
   */
  today(): DateTime {
    this.clearNLPInput();
    return this.dateService.now().startOf('day');
  }

  /**
   * Clear NLP input state when the user interacts with calendar controls.
   * Prevents NLP from overriding calendar-driven state on re-render.
   */
  clearNLPInput(): void {
    this.currentNLPText = null;
    this.initialNLPText = null;
    this.nlpParsedDate = null;
    this.nlpParseAttempted = false;
  }

  /**
   * Track new NLP input text, maintaining the explicit-clear flag.
   * Returns whether text availability flipped (drives the Original Text
   * option lifecycle in the format selector).
   */
  updateNLPText(text: string): NLPTextUpdate {
    const trimmedText = text?.trim() || '';
    const previousHadText = !!this.currentNLPText;
    this.currentNLPText = trimmedText || null;
    const nowHasText = !!this.currentNLPText;

    if (!nowHasText && previousHadText) {
      this.nlpTextWasCleared = true;
    } else if (nowHasText) {
      this.nlpTextWasCleared = false;
    }

    return { trimmedText, availabilityChanged: previousHadText !== nowHasText };
  }

  /**
   * Text to restore into the NLP field on re-render.
   * Never falls back to initialNLPText after an explicit clear.
   */
  getRestorableNLPText(): string | null {
    return this.nlpTextWasCleared ? null : this.currentNLPText || this.initialNLPText;
  }

  /**
   * Get the appropriate preset ID for the given action.
   * Falls back when the configured alias source holds no text.
   */
  getPresetIdForAction(action: DateAction): string {
    if (action === 'insert-daily-note' || action === 'open-daily-note') {
      // A selection is the alias the user just pointed at, so it outranks
      // the stored preference — until the user picks something else.
      if (this.selectionText && !this.aliasSourceChosenByUser) {
        return SELECTED_TEXT_SOURCE;
      }

      // The two settings split on one question: is there text to reuse?
      const sources = this.aliasSourcesWithText(action);
      if (sources.length === 0) return this.settings.dailyNotesAliasFallbackPresetId;

      const presetId = this.settings.dailyNotesAliasPresetId;
      if (!isAliasSourceId(presetId)) return presetId;
      if (this.getAliasSourceText(presetId)) return presetId;

      // The configured source holds no text, but the setting says "use my own
      // words": honour that with whichever source does hold some. Falling
      // through to a format preset would silently drop the text being typed —
      // which is the whole point of the setting.
      return sources[0];
    }

    // insert-text: one memory, whether or not the NLP field holds text —
    // this is the key setSelectedPreset writes.
    return this.settings.defaultDatePresetId;
  }

  /**
   * The text alias sources currently offerable, in display order: the editor
   * selection first, then the NLP field. Only the Daily Notes actions produce
   * a wikilink, so only they can carry an alias.
   */
  availableAliasSources(): AliasSourceId[] {
    return this.aliasSourcesWithText(this.selectedAction);
  }

  /** The same, for an action the state has not switched to yet */
  private aliasSourcesWithText(action: DateAction): AliasSourceId[] {
    if (action !== 'insert-daily-note' && action !== 'open-daily-note') return [];
    return ALIAS_SOURCE_IDS.filter(source => !!this.getAliasSourceText(source));
  }

  /**
   * Record what the selection parsed to — a date, or null when it parses to
   * none. Either way the selection stays an alias candidate; only the date
   * validation reads the result.
   */
  setSelectionParseResult(date: DateTime | null): void {
    this.selectionParsedDate = date ? date.startOf('day') : null;
    this.selectionParseAttempted = true;
  }

  /** The same, for the NLP field. Both sources answer to one rule. */
  setNLPParseResult(date: DateTime | null): void {
    this.nlpParsedDate = date ? date.startOf('day') : null;
    this.nlpParseAttempted = true;
  }

  /** Forget any parse result: an empty field has nothing to have parsed. */
  clearNLPParseResult(): void {
    this.nlpParsedDate = null;
    this.nlpParseAttempted = false;
  }

  /** The text a given source holds, or null when it holds none */
  getAliasSourceText(source: AliasSourceId): string | null {
    return source === SELECTED_TEXT_SOURCE ? this.selectionText : this.currentNLPText;
  }

  /**
   * The alias source the format selector should show as chosen, or null when
   * a format preset is chosen instead.
   */
  selectedAliasSource(): AliasSourceId | null {
    const presetId = this.getPresetIdForAction(this.selectedAction);
    if (!isAliasSourceId(presetId)) return null;
    return this.availableAliasSources().includes(presetId) ? presetId : null;
  }

  /**
   * How the wikilink for `date` should be aliased: with a source's text when
   * that text may speak for this date, with a format preset otherwise.
   *
   * The single answer to that question. The preview and the executor both build
   * the same link from the same state, and when only one of them ran the date
   * validation the preview promised an alias the insertion then refused.
   */
  aliasOptionsForDate(date: DateTime): { customAlias?: string; presetId?: string } {
    const source = this.selectedAliasSource();
    if (source && this.canUseAliasSourceForDate(source, date)) {
      return { customAlias: this.getAliasSourceText(source) ?? undefined };
    }
    return { presetId: this.selectedPreset.id };
  }

  /**
   * Whether a source's text may serve as the alias for a specific date.
   *
   * A text that parsed to a date may only alias that date — "next friday" over
   * a Monday would lie. A text that parsed to *no* date has no date to
   * contradict, so it aliases whatever the user confirms: that is what makes
   * `[[2026-08-17|réunion de cadrage]]` possible.
   */
  canUseAliasSourceForDate(source: AliasSourceId, date: DateTime): boolean {
    if (!this.getAliasSourceText(source)) return false;

    const isSelection = source === SELECTED_TEXT_SOURCE;
    const parseAttempted = isSelection ? this.selectionParseAttempted : this.nlpParseAttempted;
    if (!parseAttempted) return false;

    const parsedDate = isSelection ? this.selectionParsedDate : this.nlpParsedDate;
    if (!parsedDate) return true; // parsed to no date: nothing to contradict

    // Field-based comparison (robust against timezone edge cases)
    return isSameDay(date, parsedDate);
  }
}
