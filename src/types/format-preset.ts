/**
 * Represents a date/time format preset that can be used for formatting operations
 */
export interface FormatPreset {
  /** Unique identifier (kebab-case) */
  id: string;

  /**
   * Display name in UI and command palette.
   *
   * Absent on built-in presets: their label is resolved from the id through
   * i18n (`presetName`), so it follows the locale instead of freezing the
   * language in which the preset was first saved. Only user-defined presets
   * carry a name — the user's own words, never translated.
   */
  name?: string;

  /** Luxon format string */
  format: string;

  /** Type categorization */
  type: 'date' | 'time' | 'datetime';

  /** If true, cannot be deleted (can be edited) */
  builtin: boolean;

  /** Optional tooltip/help text */
  description?: string;

  /**
   * Whether this preset appears in the inline suggestion popup.
   *
   * An explicit per-preset choice, independent of display order: the popup is
   * a short list, and which formats belong on it is not the same question as
   * which order they are shown in elsewhere.
   */
  showInSuggest?: boolean;
}
