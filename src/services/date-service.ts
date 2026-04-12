import { DateTime } from 'luxon';

/**
 * DateService provides a clean abstraction over Luxon for date creation and manipulation.
 * All dates created by this service respect the configured locale.
 */
export interface IDateService {
  /**
   * Get current DateTime with configured locale
   */
  now(): DateTime;

  /**
   * Get DateTime for today at midnight (start of day)
   */
  today(): DateTime;

  /**
   * Get DateTime for tomorrow at midnight
   */
  tomorrow(): DateTime;

  /**
   * Get DateTime for yesterday at midnight
   */
  yesterday(): DateTime;

  /**
   * Parse ISO 8601 date string to DateTime
   * @param isoString - ISO 8601 formatted date string
   * @returns DateTime object or null if invalid
   */
  fromISO(isoString: string): DateTime | null;

  /**
   * Create DateTime from components
   * @param year - Full year
   * @param month - Month (1-12)
   * @param day - Day of month
   * @param hour - Hour (0-23, optional)
   * @param minute - Minute (0-59, optional)
   * @param second - Second (0-59, optional)
   * @returns DateTime object or null if components are invalid
   */
  fromComponents(
    year: number,
    month: number,
    day: number,
    hour?: number,
    minute?: number,
    second?: number
  ): DateTime | null;

  /**
   * Get the configured locale string
   */
  getLocale(): string;

  /**
   * Update the locale used for date operations
   * @param locale - IETF language tag (e.g., 'en-US', 'fr-FR')
   */
  setLocale(locale: string): void;

  /**
   * Check if a DateTime is valid
   */
  isValid(dateTime: DateTime): boolean;
}

/**
 * Implementation of IDateService using Luxon
 */
export class DateService implements IDateService {
  private locale: string;

  constructor(locale: string = 'en-US') {
    this.locale = locale;
  }

  now(): DateTime {
    return DateTime.now().setLocale(this.locale);
  }

  today(): DateTime {
    return DateTime.now().setLocale(this.locale).startOf('day');
  }

  tomorrow(): DateTime {
    return this.today().plus({ days: 1 });
  }

  yesterday(): DateTime {
    return this.today().minus({ days: 1 });
  }

  fromISO(isoString: string): DateTime | null {
    const dt = DateTime.fromISO(isoString, { locale: this.locale });
    return dt.isValid ? dt : null;
  }

  fromComponents(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0
  ): DateTime | null {
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute, second },
      { locale: this.locale }
    );
    return dt.isValid ? dt : null;
  }

  getLocale(): string {
    return this.locale;
  }

  setLocale(locale: string): void {
    this.locale = locale;
  }

  isValid(dateTime: DateTime): boolean {
    return dateTime.isValid;
  }
}
