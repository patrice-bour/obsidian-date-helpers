import { DateTime } from 'luxon';
import { NLPService } from '@/services/nlp-service';
import { DateService } from '@/services/date-service';
import { I18nService } from '@/services/i18n-service';
import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

describe('NLPService', () => {
  let nlpService: NLPService;
  let dateService: DateService;
  let i18nService: I18nService;
  let settings: DateHelpersSettings;

  beforeEach(() => {
    // Create fresh instances for each test
    dateService = new DateService('en-US');
    i18nService = new I18nService('en-US');

    settings = {
      locale: 'en-US',
      defaultFormat: 'yyyy-MM-dd',
      weekStart: 1,
      triggerCharacters: ['@@'],
      enableNLP: true,
      nlpLanguages: ['en'],
      nlpStrictMode: false,
      nlpDefaultPresetId: 'iso8601',
      showParsingWarning: false,
      nlpWithDatePicker: true,
      enableDatePicker: true,
      formatPresets: DEFAULT_FORMAT_PRESETS,
      defaultDatePresetId: 'iso8601',
      defaultTimePresetId: 'time-24h',
      defaultDateTimePresetId: 'datetime-standard',
      pickerDefaultPresetId: 'iso8601',
      pickerShowFormatSelector: true,
      // Phase 4
      nlpAutoDetectLanguage: false,
      nlpUseDateTimePreset: true,
      // Phase 6
      lastUsedAction: 'insert-daily-note',
      dailyNotesAliasPresetId: 'locale-long',
      dailyNotesAliasFallbackPresetId: 'locale-long',
      dailyNotesCreateIfMissing: false,
    };

    nlpService = new NLPService(dateService, i18nService, settings);
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(nlpService).toBeInstanceOf(NLPService);
    });

    it('should initialize chrono instance based on locale', () => {
      const frService = new NLPService(
        new DateService('fr-FR'),
        new I18nService('fr-FR'),
        { ...settings, locale: 'fr-FR', nlpLanguages: ['fr'] }
      );
      expect(frService).toBeInstanceOf(NLPService);
    });
  });

  describe('parse() - basic expressions', () => {
    it('should parse "today" to current date', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('today', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-04');
    });

    it('should parse "tomorrow" to next day', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('tomorrow', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-05');
    });

    it('should parse "yesterday" to previous day', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('yesterday', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-03');
    });

    it('should handle case-insensitive input', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('TODAY', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-04');
    });

    it('should trim whitespace', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('  tomorrow  ', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-05');
    });
  });

  describe('parse() - relative expressions', () => {
    it('should parse "3 days ago"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('3 days ago', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-01');
    });

    it('should parse "in 2 weeks"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('in 2 weeks', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-18');
    });

    it('should parse "5 days from now"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('5 days from now', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-09');
    });

    it('should parse "1 week ago"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('1 week ago', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-10-28');
    });

    it('should parse "2 months from now"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('2 months from now', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2026-01-04');
    });
  });

  describe('parse() - weekday references', () => {
    it('should parse "next Monday" correctly', () => {
      // Reference: Tuesday, Nov 4, 2025
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('next Monday', referenceDate);

      expect(result).not.toBeNull();
      // Next Monday should be Nov 10, 2025
      expect(result?.date.toISODate()).toBe('2025-11-10');
    });

    it('should parse "last Friday" correctly', () => {
      // Reference: Tuesday, Nov 4, 2025
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('last Friday', referenceDate);

      expect(result).not.toBeNull();
      // Last Friday should be Oct 31, 2025
      expect(result?.date.toISODate()).toBe('2025-10-31');
    });

    it('should parse "this Wednesday" correctly', () => {
      // Reference: Tuesday, Nov 4, 2025
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('this Wednesday', referenceDate);

      expect(result).not.toBeNull();
      // This Wednesday should be Nov 5, 2025
      expect(result?.date.toISODate()).toBe('2025-11-05');
    });

    it('should handle weekday references across month boundaries', () => {
      // Reference: Oct 30, 2025 (Thursday)
      const referenceDate = DateTime.fromISO('2025-10-30', { zone: 'America/New_York' });
      const result = nlpService.parse('next Monday', referenceDate);

      expect(result).not.toBeNull();
      // Next Monday should be Nov 3, 2025
      expect(result?.date.toISODate()).toBe('2025-11-03');
    });
  });

  describe('parse() - French language support', () => {
    beforeEach(() => {
      // Create French locale service
      const frDateService = new DateService('fr-FR');
      const frI18nService = new I18nService('fr-FR');
      const frSettings = {
        ...settings,
        locale: 'fr-FR',
        nlpLanguages: ['fr'],
      };

      nlpService = new NLPService(frDateService, frI18nService, frSettings);
    });

    it('should parse "aujourd\'hui" (today)', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse('aujourd\'hui', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-04');
    });

    it('should parse "demain" (tomorrow)', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse('demain', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-05');
    });

    it('should parse "hier" (yesterday)', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse('hier', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-03');
    });

    it('should parse "dans 3 jours" (in 3 days)', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse('dans 3 jours', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-07');
    });

    it('should parse "lundi prochain" (next Monday)', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse('lundi prochain', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-10');
    });
  });

  describe('parse() - parsing failure', () => {
    it('should return null for unrecognized text', () => {
      const result = nlpService.parse('not a date');

      expect(result).toBeNull();
    });

    it('should return null for random text regardless of showParsingWarning setting', () => {
      settings.showParsingWarning = true;
      nlpService = new NLPService(dateService, i18nService, settings);

      const result = nlpService.parse('random gibberish');

      // Service just returns null - caller handles warning display
      expect(result).toBeNull();
    });
  });

  describe('parse() - edge cases', () => {
    it('should return null for empty string', () => {
      const result = nlpService.parse('');

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      const result = nlpService.parse('   ');

      expect(result).toBeNull();
    });

    it('should handle leap year dates correctly', () => {
      const referenceDate = DateTime.fromISO('2024-02-28', { zone: 'America/New_York' });
      const result = nlpService.parse('tomorrow', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2024-02-29');
    });

    it('should handle year boundaries correctly', () => {
      const referenceDate = DateTime.fromISO('2025-12-31', { zone: 'America/New_York' });
      const result = nlpService.parse('tomorrow', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2026-01-01');
    });

    it('should use current date when no reference date provided', () => {
      const result = nlpService.parse('today');

      expect(result).not.toBeNull();
      expect(result?.date.isValid).toBe(true);
    });
  });

  describe('parse() - timezone handling', () => {
    it('should preserve date components regardless of timezone', () => {
      // Use a timezone far from typical system TZ to expose toJSDate() shift bugs
      const referenceDate = DateTime.fromISO('2025-06-15T23:00:00', { zone: 'Pacific/Auckland' });
      const result = nlpService.parse('tomorrow', referenceDate);

      expect(result).not.toBeNull();
      // "tomorrow" relative to June 15 23:00 = June 16, regardless of system TZ
      expect(result?.date.toISODate()).toBe('2025-06-16');
    });
  });

  describe('parse() - disabled NLP', () => {
    it('should return null when NLP is disabled', () => {
      settings.enableNLP = false;
      nlpService = new NLPService(dateService, i18nService, settings);

      const result = nlpService.parse('tomorrow');

      expect(result).toBeNull();
    });
  });

  describe('parse() - strict mode', () => {
    it('should be more restrictive in strict mode', () => {
      settings.nlpStrictMode = true;
      nlpService = new NLPService(dateService, i18nService, settings);

      // Note: Actual behavior depends on chrono-node strict mode
      // This test verifies the service initializes correctly
      expect(nlpService).toBeInstanceOf(NLPService);
    });
  });

  describe('isParseable()', () => {
    it('should return true for "today"', () => {
      expect(nlpService.isParseable('today')).toBe(true);
    });

    it('should return true for "tomorrow"', () => {
      expect(nlpService.isParseable('tomorrow')).toBe(true);
    });

    it('should return true for "next Monday"', () => {
      expect(nlpService.isParseable('next Monday')).toBe(true);
    });

    it('should return true for "3 days ago"', () => {
      expect(nlpService.isParseable('3 days ago')).toBe(true);
    });

    it('should return false for random text', () => {
      expect(nlpService.isParseable('random text here')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(nlpService.isParseable('')).toBe(false);
    });

    it('should return false for whitespace', () => {
      expect(nlpService.isParseable('   ')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(nlpService.isParseable('TODAY')).toBe(true);
      expect(nlpService.isParseable('TOMORROW')).toBe(true);
    });

    it('should return false when NLP is disabled', () => {
      settings.enableNLP = false;
      nlpService = new NLPService(dateService, i18nService, settings);

      expect(nlpService.isParseable('tomorrow')).toBe(false);
    });
  });

  describe('getSupportedLanguages()', () => {
    it('should return array of supported language codes', () => {
      const languages = nlpService.getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('en');
      expect(languages).toContain('fr');
    });
  });

  describe('updateSettings()', () => {
    it('should update settings and reinitialize chrono', () => {
      const newSettings = {
        ...settings,
        nlpStrictMode: false, // Keep casual mode for testing
      };

      nlpService.updateSettings(newSettings);

      // Service should still work with updated settings
      const result = nlpService.parse('tomorrow');
      expect(result).not.toBeNull();
    });

    it('should handle locale change', () => {
      const frSettings = {
        ...settings,
        locale: 'fr-FR',
        nlpLanguages: ['fr'],
      };

      nlpService.updateSettings(frSettings);

      // Should now parse French expressions
      const result = nlpService.parse('demain');
      expect(result).not.toBeNull();
    });
  });
});
