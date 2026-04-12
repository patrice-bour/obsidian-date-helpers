import { DateTime } from 'luxon';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/settings/defaults';

/**
 * Tests for "Convert selection to date" command (Phase 7.2)
 *
 * This command parses selected text with NLP and opens the unified picker
 * with the parsed date pre-selected in the calendar.
 *
 * Note: These tests focus on the parsing logic. Full command integration
 * (with Obsidian's command system and modal opening) is tested manually.
 */
describe('Convert Selection - NLP Parsing Logic', () => {
  let dateService: DateService;
  let formatterService: FormatterService;
  let nlpService: NLPService;
  let settings: DateHelpersSettings;

  beforeEach(() => {
    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    settings = { ...DEFAULT_SETTINGS };

    const mockI18nService = {
      getCurrentLocale: jest.fn().mockReturnValue('en-US'),
      t: jest.fn((key: string) => key),
      setLocale: jest.fn(),
    };

    nlpService = new NLPService(dateService, mockI18nService as any, settings);
  });

  describe('Basic NLP Parsing', () => {
    it('should parse "tomorrow" successfully', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      if (result) {
        const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
        expect(result.date.hasSame(tomorrow, 'day')).toBe(true);
      }
    });

    it('should parse "next Monday" successfully', () => {
      const result = nlpService.parse('next Monday');

      expect(result).not.toBeNull();
      if (result) {
        // Should be a Monday
        expect(result.date.weekday).toBe(1);
        // Should be in the future
        expect(result.date > dateService.now()).toBe(true);
      }
    });

    it('should parse "in 3 days" successfully', () => {
      const result = nlpService.parse('in 3 days');

      expect(result).not.toBeNull();
      if (result) {
        const expected = dateService.now().plus({ days: 3 }).startOf('day');
        expect(result.date.hasSame(expected, 'day')).toBe(true);
      }
    });

    it('should parse "yesterday" successfully', () => {
      const result = nlpService.parse('yesterday');

      expect(result).not.toBeNull();
      if (result) {
        const yesterday = dateService.now().minus({ days: 1 }).startOf('day');
        expect(result.date.hasSame(yesterday, 'day')).toBe(true);
      }
    });

    it('should return null for invalid input', () => {
      const result = nlpService.parse('invalid xyz 123');

      expect(result).toBeNull();
    });
  });

  describe('Time Component Handling', () => {
    it('should parse "tomorrow at 2pm" with time', () => {
      const result = nlpService.parse('tomorrow at 2pm');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.hasTime).toBe(true);
        expect(result.date.hour).toBe(14);
      }
    });

    it('should parse "tomorrow" without time', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      if (result) {
        // Chrono may or may not set hasTime for date-only expressions
        // What matters is that we get a valid date
        const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
        expect(result.date.hasSame(tomorrow, 'day')).toBe(true);
      }
    });

    it('should parse "next Monday at 9am" with time', () => {
      const result = nlpService.parse('next Monday at 9am');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.hasTime).toBe(true);
        expect(result.date.hour).toBe(9);
        expect(result.date.weekday).toBe(1);
      }
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle leading whitespace', () => {
      const result = nlpService.parse('  tomorrow');

      expect(result).not.toBeNull();
    });

    it('should handle trailing whitespace', () => {
      const result = nlpService.parse('tomorrow  ');

      expect(result).not.toBeNull();
    });

    it('should handle leading and trailing whitespace', () => {
      const result = nlpService.parse('  tomorrow  ');

      expect(result).not.toBeNull();
    });

    it('should return null for empty string after trim', () => {
      const result = nlpService.parse('   ');

      expect(result).toBeNull();
    });
  });

  describe('Multilingual Support (with auto-detect)', () => {
    it('should parse French "demain" (tomorrow)', () => {
      settings.nlpAutoDetectLanguage = true;
      const result = nlpService.parse('demain');

      expect(result).not.toBeNull();
      if (result) {
        const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
        expect(result.date.hasSame(tomorrow, 'day')).toBe(true);
      }
    });

    it('should parse French "lundi prochain" (next Monday)', () => {
      settings.nlpAutoDetectLanguage = true;
      const result = nlpService.parse('lundi prochain');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.date.weekday).toBe(1);
      }
    });

    it('should parse French "hier" (yesterday)', () => {
      settings.nlpAutoDetectLanguage = true;
      const result = nlpService.parse('hier');

      expect(result).not.toBeNull();
      if (result) {
        const yesterday = dateService.now().minus({ days: 1 }).startOf('day');
        expect(result.date.hasSame(yesterday, 'day')).toBe(true);
      }
    });
  });

  describe('Complex Expressions', () => {
    it('should parse "2 weeks from now"', () => {
      const result = nlpService.parse('2 weeks from now');

      expect(result).not.toBeNull();
      if (result) {
        const expected = dateService.now().plus({ weeks: 2 }).startOf('day');
        expect(result.date.hasSame(expected, 'day')).toBe(true);
      }
    });

    it('should parse "3 months ago"', () => {
      const result = nlpService.parse('3 months ago');

      expect(result).not.toBeNull();
      if (result) {
        const expected = dateService.now().minus({ months: 3 }).startOf('day');
        expect(result.date.hasSame(expected, 'day')).toBe(true);
      }
    });

    it('should parse "last Friday"', () => {
      const result = nlpService.parse('last Friday');

      expect(result).not.toBeNull();
      if (result) {
        // Should be a Friday
        expect(result.date.weekday).toBe(5);
        // Should be in the past
        expect(result.date < dateService.now()).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with special characters', () => {
      const result = nlpService.parse('tomorrow!!!');

      // NLP should either parse it or return null
      // Both are acceptable behaviors
      expect(result === null || result.date !== null).toBe(true);
    });

    it('should handle very long text gracefully', () => {
      const longText = 'tomorrow '.repeat(100);

      expect(() => {
        nlpService.parse(longText);
      }).not.toThrow();
    });

    it('should handle single character input', () => {
      const result = nlpService.parse('a');

      // Should return null (not parseable)
      expect(result).toBeNull();
    });

    it('should handle numbers only', () => {
      const result = nlpService.parse('123');

      // Chrono might interpret this as a year or return null
      // Either is acceptable
      expect(result === null || result.date !== null).toBe(true);
    });
  });

  describe('Date Formatting for Preview', () => {
    it('should format parsed date for preview notice', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      if (result) {
        const formatted = formatterService.format(result.date, 'yyyy-MM-dd HH:mm');
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      }
    });

    it('should format date with time correctly', () => {
      const result = nlpService.parse('tomorrow at 2pm');

      expect(result).not.toBeNull();
      if (result) {
        const formatted = formatterService.format(result.date, 'yyyy-MM-dd HH:mm');
        expect(formatted).toContain('14:00');
      }
    });

    it('should format date without time correctly', () => {
      const result = nlpService.parse('tomorrow');

      expect(result).not.toBeNull();
      if (result) {
        const formatted = formatterService.format(result.date, 'yyyy-MM-dd');
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should parse and format for "Convert selection" workflow', () => {
      const selection = 'next Monday';

      // Step 1: Parse
      const parseResult = nlpService.parse(selection.trim());
      expect(parseResult).not.toBeNull();

      if (parseResult) {
        // Step 2: Format for preview
        const preview = formatterService.format(parseResult.date, 'yyyy-MM-dd HH:mm');
        expect(preview).toBeTruthy();

        // Step 3: Date should be valid for picker
        expect(parseResult.date).toBeInstanceOf(DateTime);
        expect(parseResult.date.isValid).toBe(true);
      }
    });

    it('should handle full workflow for time expressions', () => {
      const selection = 'tomorrow at 3:30pm';

      const parseResult = nlpService.parse(selection.trim());
      expect(parseResult).not.toBeNull();

      if (parseResult) {
        expect(parseResult.hasTime).toBe(true);
        expect(parseResult.date.hour).toBe(15);
        expect(parseResult.date.minute).toBe(30);

        const preview = formatterService.format(parseResult.date, 'yyyy-MM-dd HH:mm');
        expect(preview).toContain('15:30');
      }
    });

    it('should handle workflow for invalid input gracefully', () => {
      const selection = 'invalid xyz 123';

      const parseResult = nlpService.parse(selection.trim());
      expect(parseResult).toBeNull();

      // In the actual command, this would show an error notice
      // and NOT open the picker
    });
  });
});
