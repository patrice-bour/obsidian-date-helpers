import { DateTime } from 'luxon';
import { FormatPreset } from '@/types/format-preset';

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

  constructor(locale: string = 'en-US') {
    this.locale = locale;
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
      return `[Invalid format: ${format}]`;
    }
  }

  formatWithPreset(dateTime: DateTime, preset: FormatPreset): string {
    return this.format(dateTime, preset.format);
  }

  getFormatExample(format: string, sampleDate?: DateTime): string {
    const dt = sampleDate || DateTime.now().setLocale(this.locale);
    return this.format(dt, format);
  }

  isValidFormat(format: string): boolean {
    try {
      const testDate = DateTime.now();
      testDate.toFormat(format);
      return true;
    } catch {
      return false;
    }
  }

  getLocale(): string {
    return this.locale;
  }

  setLocale(locale: string): void {
    this.locale = locale;
  }
}
