import { DateTime } from 'luxon';
import { FormatterService } from '@/services/formatter-service';
import { FormatPreset } from '@/types/format-preset';

describe('FormatterService', () => {
  let service: FormatterService;
  let testDate: DateTime;

  beforeEach(() => {
    service = new FormatterService('en-US');
    // Fixed test date: November 2, 2025, 14:30:45
    testDate = DateTime.fromObject(
      { year: 2025, month: 11, day: 2, hour: 14, minute: 30, second: 45 },
      { locale: 'en-US' }
    );
  });

  describe('constructor', () => {
    it('should initialize with provided locale', () => {
      expect(service.getLocale()).toBe('en-US');
    });

    it('should use default locale when not provided', () => {
      const defaultService = new FormatterService();
      expect(defaultService.getLocale()).toBe('en-US');
    });
  });

  describe('format()', () => {
    it('should format date with standard format strings', () => {
      expect(service.format(testDate, 'yyyy-MM-dd')).toBe('2025-11-02');
      expect(service.format(testDate, 'MM/dd/yyyy')).toBe('11/02/2025');
      expect(service.format(testDate, 'dd.MM.yyyy')).toBe('02.11.2025');
    });

    it('should format time with standard format strings', () => {
      expect(service.format(testDate, 'HH:mm')).toBe('14:30');
      expect(service.format(testDate, 'HH:mm:ss')).toBe('14:30:45');
      expect(service.format(testDate, 'h:mm a')).toBe('2:30 PM');
    });

    it('should format datetime with combined format strings', () => {
      expect(service.format(testDate, "yyyy-MM-dd'T'HH:mm:ss")).toBe(
        '2025-11-02T14:30:45'
      );
      expect(service.format(testDate, 'MMM d, yyyy h:mm a')).toBe(
        'Nov 2, 2025 2:30 PM'
      );
    });

    it('should respect locale for month and day names', () => {
      service.setLocale('en-US');
      expect(service.format(testDate, 'MMMM')).toBe('November');
      expect(service.format(testDate, 'MMM')).toBe('Nov');
      expect(service.format(testDate, 'EEEE')).toBe('Sunday');
      expect(service.format(testDate, 'EEE')).toBe('Sun');
    });

    it('should format month names in different locales', () => {
      service.setLocale('fr-FR');
      const frDate = testDate.setLocale('fr-FR');
      expect(service.format(frDate, 'MMMM')).toBe('novembre');
      expect(service.format(frDate, 'MMM')).toBe('nov.');

      service.setLocale('de-DE');
      const deDate = testDate.setLocale('de-DE');
      expect(service.format(deDate, 'MMMM')).toBe('November');
      expect(service.format(deDate, 'MMM')).toBe('Nov.');
    });

    it('should handle Luxon preset formats', () => {
      expect(service.format(testDate, 'D')).toBeTruthy(); // Locale short date
      expect(service.format(testDate, 'DD')).toBeTruthy(); // Locale medium date
      expect(service.format(testDate, 'DDD')).toBe('November 2, 2025'); // Locale long date
    });

    it('should treat unknown tokens as literals', () => {
      // Luxon treats unrecognized format tokens as literal text
      const result = service.format(testDate, 'invalid%%%format');
      expect(result).toBeTruthy();
      // The result will contain some interpretation of the format string
    });

    it('should handle empty format string gracefully', () => {
      const result = service.format(testDate, '');
      expect(result).toBe('');
    });

    it('should handle LOCALE_MED format', () => {
      service.setLocale('en-US');
      const result = service.format(testDate, 'LOCALE_MED');
      expect(result).toMatch(/Nov/);
      expect(result).toMatch(/2/);
      expect(result).toMatch(/2025/);
    });

    it('should handle LOCALE_MED_TIME format', () => {
      service.setLocale('en-US');
      const result = service.format(testDate, 'LOCALE_MED_TIME');
      expect(result).toMatch(/Nov/);
      expect(result).toMatch(/2025/);
      expect(result).toContain('14:30');
    });

    it('should handle LOCALE_MED_TIME in French locale', () => {
      service.setLocale('fr-FR');
      const frDate = testDate.setLocale('fr-FR');
      const result = service.format(frDate, 'LOCALE_MED_TIME');
      expect(result).toMatch(/nov/);
      expect(result).toContain('14:30');
    });

    it('should return error string when format throws', () => {
      // Mock setLocale to throw, simulating an internal error
      const dt = testDate;
      jest.spyOn(dt, 'setLocale').mockImplementation(() => {
        throw new Error('Locale error');
      });
      const result = service.format(dt, 'yyyy-MM-dd');
      expect(result).toBe('[Invalid format: yyyy-MM-dd]');
    });
  });

  describe('formatWithPreset()', () => {
    it('should format using preset format string', () => {
      const preset: FormatPreset = {
        id: 'iso8601',
        name: 'ISO 8601',
        format: 'yyyy-MM-dd',
        type: 'date',
        builtin: true,
      };

      expect(service.formatWithPreset(testDate, preset)).toBe('2025-11-02');
    });

    it('should work with time presets', () => {
      const preset: FormatPreset = {
        id: 'time-24h',
        name: '24-hour',
        format: 'HH:mm',
        type: 'time',
        builtin: true,
      };

      expect(service.formatWithPreset(testDate, preset)).toBe('14:30');
    });

    it('should work with datetime presets', () => {
      const preset: FormatPreset = {
        id: 'datetime-readable',
        name: 'Readable',
        format: 'MMM d, yyyy h:mm a',
        type: 'datetime',
        builtin: false,
      };

      expect(service.formatWithPreset(testDate, preset)).toBe('Nov 2, 2025 2:30 PM');
    });

    it('should handle preset with unusual format strings', () => {
      const preset: FormatPreset = {
        id: 'unusual-preset',
        name: 'Unusual',
        format: 'invalid%%%',
        type: 'date',
        builtin: false,
      };

      const result = service.formatWithPreset(testDate, preset);
      // Luxon will treat this as literal text
      expect(result).toBeTruthy();
    });
  });

  describe('isValidFormat()', () => {
    it('should return true for valid format strings', () => {
      expect(service.isValidFormat('yyyy-MM-dd')).toBe(true);
      expect(service.isValidFormat('HH:mm:ss')).toBe(true);
      expect(service.isValidFormat('MMMM d, yyyy')).toBe(true);
      expect(service.isValidFormat('D')).toBe(true);
      expect(service.isValidFormat('DDD')).toBe(true);
    });

    it('should return true for any string that Luxon can process', () => {
      // Luxon is very permissive - it treats unrecognized tokens as literals
      // So most strings are technically "valid" even if they don't contain format tokens
      expect(service.isValidFormat('invalid%%%')).toBe(true);
      expect(service.isValidFormat('xyz123')).toBe(true);
    });

    it('should return true for empty string', () => {
      // Empty format is technically valid (returns empty string)
      expect(service.isValidFormat('')).toBe(true);
    });
  });

  describe('getFormatExample()', () => {
    it('should generate example output for format string', () => {
      const example = service.getFormatExample('yyyy-MM-dd');
      expect(example).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should use provided sample date', () => {
      const example = service.getFormatExample('yyyy-MM-dd', testDate);
      expect(example).toBe('2025-11-02');
    });

    it('should respect current locale', () => {
      service.setLocale('en-US');
      const example = service.getFormatExample('MMMM', testDate);
      expect(example).toBe('November');
    });

    it('should use current time when no sample date provided', () => {
      const example = service.getFormatExample('yyyy');
      const currentYear = DateTime.now().year;
      expect(example).toBe(currentYear.toString());
    });

    it('should handle unusual formats', () => {
      const example = service.getFormatExample('invalid%%%');
      // Luxon treats this as literals, so it will return something
      expect(example).toBeTruthy();
    });
  });

  describe('getLocale()', () => {
    it('should return current locale', () => {
      expect(service.getLocale()).toBe('en-US');
    });

    it('should reflect locale changes', () => {
      service.setLocale('fr-FR');
      expect(service.getLocale()).toBe('fr-FR');
    });
  });

  describe('setLocale()', () => {
    it('should update locale for subsequent formatting', () => {
      service.setLocale('de-DE');
      expect(service.getLocale()).toBe('de-DE');

      const deDate = testDate.setLocale('de-DE');
      const result = service.format(deDate, 'MMMM');
      expect(result).toBe('November');
    });

    it('should affect format examples', () => {
      service.setLocale('fr-FR');
      const frDate = testDate.setLocale('fr-FR');
      const example = service.getFormatExample('MMMM', frDate);
      expect(example).toBe('novembre');
    });
  });

  describe('edge cases', () => {
    it('should handle leap year dates', () => {
      const leapDate = DateTime.fromObject(
        { year: 2024, month: 2, day: 29 },
        { locale: 'en-US' }
      );
      expect(service.format(leapDate, 'yyyy-MM-dd')).toBe('2024-02-29');
    });

    it('should handle end of year dates', () => {
      const endOfYear = DateTime.fromObject(
        { year: 2025, month: 12, day: 31 },
        { locale: 'en-US' }
      );
      expect(service.format(endOfYear, 'yyyy-MM-dd')).toBe('2025-12-31');
    });

    it('should handle midnight times', () => {
      const midnight = DateTime.fromObject(
        { year: 2025, month: 11, day: 2, hour: 0, minute: 0, second: 0 },
        { locale: 'en-US' }
      );
      expect(service.format(midnight, 'HH:mm:ss')).toBe('00:00:00');
    });

    it('should handle complex format strings with literals', () => {
      const result = service.format(testDate, "'Today is' EEEE, MMMM d");
      expect(result).toBe('Today is Sunday, November 2');
    });
  });
});
