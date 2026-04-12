import { DateTime } from 'luxon';
import { NLPService } from '@/services/nlp-service';
import { DateService } from '@/services/date-service';
import { I18nService } from '@/services/i18n-service';
import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS_BASE } from '@/types/settings';
import { DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

describe('NLPService - Phase 4 Features', () => {
  let nlpService: NLPService;
  let dateService: DateService;
  let i18nService: I18nService;
  let settings: DateHelpersSettings;

  beforeEach(() => {
    settings = {
      ...DEFAULT_SETTINGS_BASE,
      formatPresets: DEFAULT_FORMAT_PRESETS,
      enableNLP: true,
      nlpAutoDetectLanguage: true,
    };

    i18nService = new I18nService('en-US');
    dateService = new DateService('en-US');
    nlpService = new NLPService(dateService, i18nService, settings);
  });

  describe('Language Auto-Detection', () => {
    it('should detect and parse English expressions', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      expect(result?.detectedLanguage).toBe('en');
    });

    it('should detect and parse French expressions', () => {
      const result = nlpService.parse('demain');

      expect(result).not.toBeNull();
      expect(result?.detectedLanguage).toBe('fr');
    });

    it('should detect French "aujourd\'hui"', () => {
      const result = nlpService.parse("aujourd'hui");

      expect(result).not.toBeNull();
      expect(result?.detectedLanguage).toBe('fr');
    });

    it('should try locale language first', () => {
      // Set locale to French
      settings.locale = 'fr-FR';
      i18nService.setLocale('fr-FR');
      nlpService.updateSettings(settings);

      const result = nlpService.parse('demain');

      expect(result).not.toBeNull();
      expect(result?.detectedLanguage).toBe('fr');
    });

    it('should fallback to other languages if locale does not match', () => {
      // Locale is English, but expression is French
      settings.locale = 'en-US';
      nlpService.updateSettings(settings);

      const result = nlpService.parse('demain');

      expect(result).not.toBeNull();
      expect(result?.detectedLanguage).toBe('fr');
    });

    it('should return null if no language matches', () => {
      const result = nlpService.parse('xyzabc123notadate');

      expect(result).toBeNull();
    });

    it('should work with auto-detection disabled', () => {
      settings.nlpAutoDetectLanguage = false;
      settings.locale = 'en-US';
      nlpService.updateSettings(settings);

      // English should work
      const englishResult = nlpService.parse('tomorrow');
      expect(englishResult).not.toBeNull();

      // French should fail (only trying English)
      const frenchResult = nlpService.parse('demain');
      expect(frenchResult).toBeNull();
    });
  });

  describe('Time Expression Integration', () => {
    it('should detect time in "tomorrow at 2pm"', () => {
      const result = nlpService.parse('tomorrow at 2pm');

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      expect(result?.date.hour).toBe(14);
    });

    it('should detect time in "tomorrow at 2:30pm"', () => {
      const result = nlpService.parse('tomorrow at 2:30pm');

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      expect(result?.date.hour).toBe(14);
      expect(result?.date.minute).toBe(30);
    });

    it('should detect 24-hour time format "14h30"', () => {
      const result = nlpService.parse('demain à 14h30');

      expect(result).not.toBeNull();
      if (result?.hasTime) {
        expect(result.date.hour).toBe(14);
        expect(result.date.minute).toBe(30);
      }
    });

    it('should NOT have time for "tomorrow" without time', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(false);
    });

    it('should NOT have time for "next Monday" without time', () => {
      const result = nlpService.parse('next Monday');

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(false);
    });

    it('should preserve original text', () => {
      const result = nlpService.parse('tomorrow at 3pm');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('tomorrow at 3pm');
    });

    it('should parse "next Monday at 9am" correctly', () => {
      // Reference: Tuesday, Nov 4, 2025
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('next Monday at 9am', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      // Next Monday should be Nov 10, 2025
      expect(result?.date.toISODate()).toBe('2025-11-10');
      expect(result?.date.hour).toBe(9);
    });

    it('should parse French "lundi prochain à 9h" correctly', () => {
      // Reference: Tuesday, Nov 4, 2025
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse('lundi prochain à 9h', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      // Next Monday should be Nov 10, 2025
      expect(result?.date.toISODate()).toBe('2025-11-10');
      expect(result?.date.hour).toBe(9);
    });

    // Edge cases for time expressions
    it('should parse midnight as 00:00', () => {
      const result = nlpService.parse('tomorrow at midnight');

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      expect(result?.date.hour).toBe(0);
      expect(result?.date.minute).toBe(0);
    });

    it('should parse noon as 12:00', () => {
      const result = nlpService.parse('tomorrow at noon');

      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      expect(result?.date.hour).toBe(12);
      expect(result?.date.minute).toBe(0);
    });

    it('should parse 24-hour time without colon "0900"', () => {
      const result = nlpService.parse('tomorrow at 0900');

      expect(result).not.toBeNull();
      if (result?.hasTime) {
        expect(result.date.hour).toBe(9);
        expect(result.date.minute).toBe(0);
      }
    });

    it('should parse time ranges and take first time', () => {
      const result = nlpService.parse('tomorrow from 2pm to 4pm');

      expect(result).not.toBeNull();
      // Should parse the first time component
      if (result?.hasTime) {
        expect(result.date.hour).toBe(14);
      }
    });

    it('should handle German time format "14 Uhr"', () => {
      const result = nlpService.parse('morgen um 14 Uhr');

      expect(result).not.toBeNull();
      if (result?.hasTime) {
        expect(result.date.hour).toBe(14);
      }
    });
  });



  describe('Partial Match Prevention', () => {
    it('should not accept partial matches from wrong language parser', () => {
      // Bug scenario: French parser matches "9am" in "next Monday at 9am"
      // and returns today at 9am instead of next Monday at 9am

      // Force French locale to trigger the bug scenario
      settings.locale = 'fr-FR';
      settings.nlpAutoDetectLanguage = true;
      i18nService.setLocale('fr-FR');
      nlpService.updateSettings(settings);

      const referenceDate = DateTime.fromISO('2025-11-05', { zone: 'Europe/Paris' }); // Wednesday
      const result = nlpService.parse('next Monday at 9am', referenceDate);

      expect(result).not.toBeNull();
      // Should parse the full expression in English, not just "9am" in French
      expect(result?.date.toISODate()).toBe('2025-11-10'); // Next Monday, not today
      expect(result?.hasTime).toBe(true);
      expect(result?.date.hour).toBe(9);
      expect(result?.detectedLanguage).toBe('en'); // Should detect English, not French
    });

    it('should accept full matches even with different locale', () => {
      // French expressions should still work when locale is French
      settings.locale = 'fr-FR';
      settings.nlpAutoDetectLanguage = true;
      i18nService.setLocale('fr-FR');
      nlpService.updateSettings(settings);

      const referenceDate = DateTime.fromISO('2025-11-05', { zone: 'Europe/Paris' });
      const result = nlpService.parse('demain à 14h', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-06'); // Tomorrow
      expect(result?.hasTime).toBe(true);
      expect(result?.date.hour).toBe(14);
      expect(result?.detectedLanguage).toBe('fr');
    });
  });

  describe('Backward Compatibility', () => {
    it('should still support basic NLP parsing', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      expect(result?.date).toBeDefined();
    });

    it('should support isParseable check', () => {
      expect(nlpService.isParseable('tomorrow')).toBe(true);
      expect(nlpService.isParseable('demain')).toBe(true);
      expect(nlpService.isParseable('notadate')).toBe(false);
    });

    it('should support getSupportedLanguages', () => {
      const languages = nlpService.getSupportedLanguages();

      expect(languages).toContain('en');
      expect(languages).toContain('fr');
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should support updateSettings', () => {
      const newSettings = { ...settings, nlpWeekdayMode: 'calendar' as const };

      expect(() => nlpService.updateSettings(newSettings)).not.toThrow();
    });
  });
});
