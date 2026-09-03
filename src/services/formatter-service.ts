import { DateTime } from 'luxon';
import { FormatPreset } from '@/types/format-preset';
import { I18nService } from './i18n-service';
import { readFormat } from './format-syntax';

/**
 * FormatterService handles all date-to-string formatting operations using Luxon.
 * Provides format validation and locale-aware formatting.
 */
export interface IFormatterService {
  /**
   * Format a DateTime using a Luxon format string
   * @param dateTime - DateTime to format
   * @param format - Luxon format string (e.g., 'yyyy-MM-dd', 'DDD')
   * @returns Formatted string or error message if format invalid
   */
  format(dateTime: DateTime, format: string): string;

  /**
   * Format a DateTime using a format preset
   * @param dateTime - DateTime to format
   * @param preset - Format preset object
   * @returns Formatted string
   */
  formatWithPreset(dateTime: DateTime, preset: FormatPreset): string;

  /**
   * Get example output for a format string (for preview purposes)
   * @param format - Luxon format string
   * @param sampleDate - Optional sample date (defaults to now)
   * @returns Example formatted string
   */
  getFormatExample(format: string, sampleDate?: DateTime): string;

  /**
   * Validate a Luxon format string
   * @param format - Format string to validate
   * @returns True if format is valid
   */
  isValidFormat(format: string): boolean;

  /**
   * Get the locale used for formatting
   */
  getLocale(): string;

  /**
   * Update the locale used for formatting
   */
  setLocale(locale: string): void;
}

/**
 * Implementation of IFormatterService using Luxon
 */
export class FormatterService implements IFormatterService {
  private locale: string;
  private i18n: I18nService;

  /**
   * The invalid-format marker is the one string this service shows the user, and
   * it must follow the locale like everything else. Rather than thread the
   * plugin's i18n service through every construction site, the formatter
   * derives one from the locale it already carries, and keeps the two in step
   * in `setLocale`.
   */
  constructor(locale: string = 'en-US') {
    this.locale = locale;
    this.i18n = new I18nService(locale);
  }

  format(dateTime: DateTime, format: string): string {
    try {
      // Ensure DateTime has correct locale
      const localizedDt = dateTime.setLocale(this.locale);

      // Handle special locale-aware formats using toLocaleString
      // These adapt the component order based on locale
      if (format === 'LOCALE_MED') {
        // Medium date with abbreviated month - adapts order to locale
        // EN: Nov 4, 2025 | FR: 4 nov. 2025
        return localizedDt.toLocaleString(DateTime.DATE_MED);
      }
      if (format === 'LOCALE_MED_TIME') {
        // Medium date + 24h time - adapts order to locale
        // EN: Nov 4, 2025, 14:30 | FR: 4 nov. 2025 à 14:30
        const datePart = localizedDt.toLocaleString(DateTime.DATE_MED);
        const timePart = localizedDt.toFormat('HH:mm');
        // Remove locale-specific time connectors (like "à" in French)
        // and use simple space separator
        return `${datePart} ${timePart}`;
      }

      // Standard Luxon format string
      return localizedDt.toFormat(format);
    } catch (error) {
      console.error('Format error:', error);
      return this.i18n.t('errors.invalidFormat', { format });
    }
  }

  formatWithPreset(dateTime: DateTime, preset: FormatPreset): string {
    return this.format(dateTime, preset.format);
  }

  getFormatExample(format: string, sampleDate?: DateTime): string {
    const dt = sampleDate || DateTime.now().setLocale(this.locale);
    return this.format(dt, format);
  }

  /**
   * Whether `format` names a date this plugin can render.
   *
   * By token, not by whether `toFormat` throws — it never does, so the old
   * check answered yes to everything. Why that matters: `format-syntax.ts`.
   */
  isValidFormat(format: string): boolean {
    // The two locale sentinels first: they are the stored format of two shipped
    // presets, handled by `format()` above and by no token vocabulary. Read as
    // a format string, `LOCALE_MED` is a run of letters nobody knows.
    if (format === 'LOCALE_MED' || format === 'LOCALE_MED_TIME') return true;
    return readFormat(format).ok;
  }

  getLocale(): string {
    return this.locale;
  }

  setLocale(locale: string): void {
    this.locale = locale;
    this.i18n.setLocale(locale);
  }
}
