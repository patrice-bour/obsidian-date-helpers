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
 * First day of week type derived from VALID_WEEK_STARTS
 */
export type WeekStart = (typeof VALID_WEEK_STARTS)[number];

/**
 * Maximum length of a trigger character sequence
 */
export const MAX_TRIGGER_LENGTH = 5;

/**
 * Debounce delay (ms) for locale input validation in settings
 */
export const LOCALE_INPUT_DEBOUNCE_MS = 500;
