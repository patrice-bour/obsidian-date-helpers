/**
 * Represents a date/time format preset that can be used for formatting operations
 */
export interface FormatPreset {
  /** Unique identifier (kebab-case) */
  id: string;

  /** Display name in UI and command palette */
  name: string;

  /** Luxon format string */
  format: string;

  /** Type categorization */
  type: 'date' | 'time' | 'datetime';

  /** If true, cannot be deleted (can be edited) */
  builtin: boolean;

  /** Optional tooltip/help text */
  description?: string;
}
