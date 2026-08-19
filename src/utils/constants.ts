/**
 * Default locale (fallback)
 */
export const DEFAULT_LOCALE = 'en';

/**
 * Fallback locale when user's locale is unavailable
 */
export const FALLBACK_LOCALE = 'en';

/**
 * Minimum NLP match coverage ratio: (matched text length) / (input length).
 *
 * Prevents partial matches from wrong-language parsers. Example: the French
 * parser matching "9am" (16.7% coverage) in "next Monday at 9am" would return
 * today at 9am (incorrect); rejecting it lets the English parser match the
 * full expression (100% coverage).
 *
 * 0.5 is the optimal balance:
 * - Too low (e.g., 0.3): accepts time-only partial matches
 * - Too high (e.g., 0.8): rejects valid abbreviated expressions
 * - 0.5: ensures a substantial portion of the input is recognized
 */
export const NLP_MIN_COVERAGE_RATIO = 0.5;

/**
 * Valid first-day-of-week values (0 = Sunday, 1 = Monday, 6 = Saturday)
 */
export const VALID_WEEK_STARTS = [0, 1, 6] as const;

/**
 * The preset types the plugin knows how to label and command.
 *
 * Stored data is not trusted: a preset carrying anything else would build its
 * command name from `commands.prefix.<type>`, a key that does not exist, and
 * the palette would show the key itself.
 */
export const VALID_PRESET_TYPES = ['date', 'time', 'datetime'] as const;

/**
 * First day of week type derived from VALID_WEEK_STARTS
 */
export type WeekStart = (typeof VALID_WEEK_STARTS)[number];

/**
 * What a trigger may open. Stored data is not trusted: an entry carrying
 * anything else is dropped rather than guessed at, since guessing would open
 * the surface the user did not ask for.
 */
export const VALID_TRIGGER_MODES = ['picker', 'inline'] as const;

/**
 * Maximum length of a trigger character sequence
 */
export const MAX_TRIGGER_LENGTH = 5;

/**
 * Debounce delay (ms) before rebuilding the settings tab after a locale change.
 *
 * The value itself is persisted immediately — this delay only defers the
 * rebuild that refreshes translated labels and format examples, so that
 * rebuilding does not steal focus from the field being typed into.
 */
export const LOCALE_REFRESH_DEBOUNCE_MS = 500;
