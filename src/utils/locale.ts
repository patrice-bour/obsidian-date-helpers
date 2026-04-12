import { DateTime } from 'luxon';
import { DEFAULT_LOCALE } from './constants';

/**
 * Detect system locale from Obsidian
 */
export function detectObsidianLocale(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locale = (window as any).moment?.locale();
    return locale || DEFAULT_LOCALE;
  } catch (error) {
    console.warn('Failed to detect Obsidian locale:', error);
    return DEFAULT_LOCALE;
  }
}

/**
 * Validate locale format by testing with Luxon
 * Supports full BCP 47 format: language[-script][-region][-variant]
 * Examples: en-US, zh-Hans-CN, sr-Latn-RS
 * @param locale - Locale string to validate
 * @returns True if locale is supported by Luxon
 */
export function isValidLocale(locale: string): boolean {
  if (!locale || typeof locale !== 'string') {
    return false;
  }

  // Basic format check: must match BCP 47 pattern
  // Language code (2-3 letters), optionally followed by script, region, variant
  const bcp47Pattern = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?(-[a-zA-Z0-9]+)?$/i;
  if (!bcp47Pattern.test(locale)) {
    return false;
  }

  try {
    // Test if Luxon can actually format with this locale
    // Use toLocaleString which throws on truly invalid locales
    const testDate = DateTime.fromObject(
      { year: 2025, month: 1, day: 1 },
      { locale }
    );

    // This will throw if the locale is invalid
    testDate.toLocaleString(DateTime.DATE_SHORT);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize locale string (e.g., 'en_US' -> 'en-US')
 */
export function normalizeLocale(locale: string): string {
  return locale.replace(/_/g, '-');
}
