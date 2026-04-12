import { DateTime } from 'luxon';
import { DateService } from '@/services/date-service';

describe('DateService', () => {
  let service: DateService;

  beforeEach(() => {
    service = new DateService('en-US');
  });

  describe('constructor', () => {
    it('should initialize with provided locale', () => {
      expect(service.getLocale()).toBe('en-US');
    });

    it('should use default locale when not provided', () => {
      const defaultService = new DateService();
      expect(defaultService.getLocale()).toBe('en-US');
    });
  });

  describe('now()', () => {
    it('should return current DateTime with configured locale', () => {
      const result = service.now();
      expect(result).toBeInstanceOf(DateTime);
      expect(result.locale).toBe('en-US');
      expect(result.isValid).toBe(true);
    });

    it('should return DateTime close to current time', () => {
      const before = DateTime.now().toMillis();
      const result = service.now();
      const after = DateTime.now().toMillis();

      expect(result.toMillis()).toBeGreaterThanOrEqual(before);
      expect(result.toMillis()).toBeLessThanOrEqual(after);
    });

    it('should respect locale setting', () => {
      service.setLocale('fr-FR');
      const result = service.now();
      expect(result.locale).toBe('fr-FR');
    });
  });

  describe('today()', () => {
    it('should return midnight of current day', () => {
      const result = service.today();
      expect(result).toBeInstanceOf(DateTime);
      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
      expect(result.second).toBe(0);
      expect(result.millisecond).toBe(0);
    });

    it('should have same date as now()', () => {
      const now = service.now();
      const today = service.today();

      expect(today.year).toBe(now.year);
      expect(today.month).toBe(now.month);
      expect(today.day).toBe(now.day);
    });

    it('should respect locale setting', () => {
      service.setLocale('de-DE');
      const result = service.today();
      expect(result.locale).toBe('de-DE');
    });
  });

  describe('tomorrow()', () => {
    it('should return midnight of next day', () => {
      const today = service.today();
      const tomorrow = service.tomorrow();

      expect(tomorrow.toMillis()).toBe(today.plus({ days: 1 }).toMillis());
      expect(tomorrow.hour).toBe(0);
      expect(tomorrow.minute).toBe(0);
      expect(tomorrow.second).toBe(0);
    });

    it('should be exactly 24 hours after today', () => {
      const today = service.today();
      const tomorrow = service.tomorrow();
      const diff = tomorrow.diff(today, 'hours').hours;

      expect(diff).toBe(24);
    });
  });

  describe('yesterday()', () => {
    it('should return midnight of previous day', () => {
      const today = service.today();
      const yesterday = service.yesterday();

      expect(yesterday.toMillis()).toBe(today.minus({ days: 1 }).toMillis());
      expect(yesterday.hour).toBe(0);
      expect(yesterday.minute).toBe(0);
      expect(yesterday.second).toBe(0);
    });

    it('should be exactly 24 hours before today', () => {
      const today = service.today();
      const yesterday = service.yesterday();
      const diff = today.diff(yesterday, 'hours').hours;

      expect(diff).toBe(24);
    });
  });

  describe('fromISO()', () => {
    it('should parse valid ISO 8601 date strings', () => {
      const result = service.fromISO('2025-11-02');
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.month).toBe(11);
      expect(result?.day).toBe(2);
    });

    it('should parse ISO datetime strings', () => {
      const result = service.fromISO('2025-11-02T14:30:45');
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.month).toBe(11);
      expect(result?.day).toBe(2);
      expect(result?.hour).toBe(14);
      expect(result?.minute).toBe(30);
      expect(result?.second).toBe(45);
    });

    it('should return null for invalid ISO strings', () => {
      expect(service.fromISO('not-a-date')).toBeNull();
      expect(service.fromISO('2025-13-01')).toBeNull(); // Invalid month
      expect(service.fromISO('2025-02-30')).toBeNull(); // Invalid day
      expect(service.fromISO('')).toBeNull();
    });

    it('should use configured locale for parsed DateTime', () => {
      service.setLocale('ja-JP');
      const result = service.fromISO('2025-11-02');
      expect(result?.locale).toBe('ja-JP');
    });
  });

  describe('fromComponents()', () => {
    it('should create DateTime from date components', () => {
      const result = service.fromComponents(2025, 11, 2);
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.month).toBe(11);
      expect(result?.day).toBe(2);
      expect(result?.hour).toBe(0);
      expect(result?.minute).toBe(0);
      expect(result?.second).toBe(0);
    });

    it('should create DateTime from full components', () => {
      const result = service.fromComponents(2025, 11, 2, 14, 30, 45);
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.month).toBe(11);
      expect(result?.day).toBe(2);
      expect(result?.hour).toBe(14);
      expect(result?.minute).toBe(30);
      expect(result?.second).toBe(45);
    });

    it('should use configured locale', () => {
      service.setLocale('fr-FR');
      const result = service.fromComponents(2025, 11, 2);
      expect(result).not.toBeNull();
      expect(result?.locale).toBe('fr-FR');
    });

    it('should return null for invalid component values', () => {
      const result = service.fromComponents(2025, 13, 32); // Invalid month and day
      expect(result).toBeNull();
    });
  });

  describe('getLocale()', () => {
    it('should return current locale', () => {
      expect(service.getLocale()).toBe('en-US');
    });

    it('should reflect locale changes', () => {
      service.setLocale('de-DE');
      expect(service.getLocale()).toBe('de-DE');
    });
  });

  describe('setLocale()', () => {
    it('should update locale for subsequent operations', () => {
      service.setLocale('fr-FR');
      expect(service.getLocale()).toBe('fr-FR');

      const result = service.now();
      expect(result.locale).toBe('fr-FR');
    });

    it('should affect all date creation methods', () => {
      service.setLocale('de-DE');

      expect(service.now().locale).toBe('de-DE');
      expect(service.today().locale).toBe('de-DE');
      expect(service.tomorrow().locale).toBe('de-DE');
      expect(service.yesterday().locale).toBe('de-DE');
    });
  });

  describe('isValid()', () => {
    it('should return true for valid DateTimes', () => {
      const valid = service.now();
      expect(service.isValid(valid)).toBe(true);
    });

    it('should return false for invalid DateTimes', () => {
      // Create an invalid DateTime directly (not through fromComponents which now returns null)
      const invalid = DateTime.invalid('test');
      expect(service.isValid(invalid)).toBe(false);
    });

    it('should correctly validate parsed ISO dates', () => {
      const valid = service.fromISO('2025-11-02');

      if (valid) {
        expect(service.isValid(valid)).toBe(true);
      }
      // fromISO returns null for invalid dates
    });
  });
});
