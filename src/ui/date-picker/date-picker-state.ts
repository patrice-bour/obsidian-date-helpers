import { DateTime } from 'luxon';
import { DateService } from '@/services/date-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { isSameDay } from '@/utils/calendar-grid';
import { DateAction } from './types';

export interface DatePickerStateOptions {
  initialAction?: DateAction;
  initialNLPText?: string;
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
  /** Date parsed from the NLP expression (validates "Original Text" usage) */
  nlpParsedDate: DateTime | null = null;
  /** Whether the user explicitly cleared the NLP field */
  nlpTextWasCleared = false;

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

    this.selectedAction = opts.initialAction || settings.lastUsedAction || 'insert-text';

    // If initialAction was provided (direct command), persist it immediately
    if (opts.initialAction) {
      this.settings.lastUsedAction = opts.initialAction;
      this.persist();
    }

    // Store initial NLP text BEFORE preset resolution (getPresetIdForAction reads currentNLPText)
    this.initialNLPText = opts.initialNLPText || null;
    this.currentNLPText = this.initialNLPText;

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
   * Resolve a preset id to a concrete preset. The "original-text"
   * pseudo-preset has no matching FormatPreset — the fallback preset
   * backs it.
   */
  private resolveBackingPreset(presetId: string): FormatPreset {
    if (presetId === 'original-text') {
      const fallbackId = this.settings.dailyNotesAliasFallbackPresetId;
      return this.presets.find(p => p.id === fallbackId) || this.presets[0];
    }
    return this.presets.find(p => p.id === presetId) || this.presets[0];
  }

  /**
   * Update selected action, resolve its preset, persist.
   * Returns the resolved preset ID ('original-text' included) so the
   * caller can sync the format selector.
   */
  setSelectedAction(action: DateAction): string {
    this.selectedAction = action;
    this.settings.lastUsedAction = action;

    const presetId = this.getPresetIdForAction(action);
    if (presetId === 'original-text') {
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
   * the current action. Handles the "original-text" pseudo-preset.
   */
  setSelectedPreset(presetId: string): void {
    // Handle "original-text" pseudo-preset
    if (presetId === 'original-text') {
      if (
        this.selectedAction === 'insert-daily-note' ||
        this.selectedAction === 'open-daily-note'
      ) {
        this.settings.dailyNotesAliasPresetId = 'original-text';
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
   * Handles "original-text" fallback when no text is available.
   */
  getPresetIdForAction(action: DateAction): string {
    switch (action) {
      case 'insert-text':
        if (this.currentNLPText && this.settings.nlpDefaultPresetId) {
          return this.settings.nlpDefaultPresetId;
        }
        return this.settings.defaultDatePresetId;
      case 'insert-daily-note':
      case 'open-daily-note': {
        const presetId = this.settings.dailyNotesAliasPresetId;
        // If "original-text" is configured but no text is available, use fallback
        if (presetId === 'original-text' && !this.currentNLPText) {
          return this.settings.dailyNotesAliasFallbackPresetId;
        }
        return presetId;
      }
      default:
        return this.settings.defaultDatePresetId;
    }
  }

  /**
   * Check if "Original Text" option should be available:
   * Daily Notes actions with text present (initial selection OR NLP input)
   */
  isOriginalTextAvailable(): boolean {
    return (
      (this.selectedAction === 'insert-daily-note' || this.selectedAction === 'open-daily-note') &&
      !!this.currentNLPText
    );
  }

  /**
   * Current text to use as alias (initial selection or NLP input)
   */
  getOriginalText(): string | null {
    return this.currentNLPText;
  }

  /**
   * Check if "Original Text" can be used for a specific date:
   * only valid when the date matches the NLP-parsed date
   */
  canUseOriginalTextForDate(date: DateTime): boolean {
    if (!this.nlpParsedDate || !this.currentNLPText) {
      return false;
    }
    // Field-based comparison (robust against timezone edge cases)
    return isSameDay(date, this.nlpParsedDate);
  }

  /**
   * Check if "Original Text" is currently selected
   */
  isOriginalTextSelected(): boolean {
    return (
      this.settings.dailyNotesAliasPresetId === 'original-text' && this.isOriginalTextAvailable()
    );
  }
}
