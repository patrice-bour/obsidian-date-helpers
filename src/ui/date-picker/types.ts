/**
 * Shared types for the unified date picker modules
 */

/**
 * Action performed when a date is selected
 * - 'insert-text': Insert formatted plain text
 * - 'insert-daily-note': Insert wikilink to Daily Note
 * - 'open-daily-note': Navigate to Daily Note (no text insertion)
 */
export type DateAction = 'insert-text' | 'insert-daily-note' | 'open-daily-note';
