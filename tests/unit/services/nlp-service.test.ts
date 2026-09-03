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
      weekStart: 1,
      triggerCharacters: [{ sequence: '@@', mode: 'picker' }],
      enableNLP: true,
      nlpStrictMode: false,
      enableDatePicker: true,
      formatPresets: DEFAULT_FORMAT_PRESETS,
      defaultDatePresetId: 'iso8601',
      nlpAutoDetectLanguage: false,
      // Le service NLP ne lit pas ce réglage — il vit dans les deux surfaces
      // qui l'appellent. Au défaut, donc, pour ne rien laisser croire d'autre.
      selectionNamesDate: true,
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
      const frService = new NLPService(new DateService('fr-FR'), new I18nService('fr-FR'), {
        ...settings,
        locale: 'fr-FR',
      });
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

    // Two wordings that only lived in convert-selection.test.ts, whose command
    // is gone. The unit under test was always NLPService, so they belong here —
    // against a fixed reference date rather than "now", which is what made the
    // originals weaker than the tests around them.
    it('should parse "2 weeks from now"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('2 weeks from now', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-11-18');
    });

    it('should parse "3 months ago"', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'America/New_York' });
      const result = nlpService.parse('3 months ago', referenceDate);

      expect(result).not.toBeNull();
      expect(result?.date.toISODate()).toBe('2025-08-04');
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
      };

      nlpService = new NLPService(frDateService, frI18nService, frSettings);
    });

    it('should parse "aujourd\'hui" (today)', () => {
      const referenceDate = DateTime.fromISO('2025-11-04', { zone: 'Europe/Paris' });
      const result = nlpService.parse("aujourd'hui", referenceDate);

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

  describe('parse() - two-day compounds', () => {
    // chrono does guard word boundaries — `avanthier` matches nothing — but a
    // hyphen and a space are both `\W`, so `demain` starts a legitimate word
    // inside `après-demain` and the compound resolves to the single-day
    // expression it contains. The date is wrong by one day and nothing says so,
    // which is why every case below asserts the date rather than merely that
    // something parsed.
    const REFERENCE = '2025-11-04'; // Tuesday
    const TWO_BEFORE = '2025-11-02';
    const TWO_AFTER = '2025-11-06';

    const serviceFor = (locale: string, overrides: Partial<DateHelpersSettings> = {}) =>
      new NLPService(new DateService(locale), new I18nService(locale), {
        ...settings,
        locale,
        ...overrides,
      });

    const parseIn = (locale: string, text: string) =>
      serviceFor(locale).parse(text, DateTime.fromISO(REFERENCE, { zone: 'Europe/Paris' }));

    describe.each([
      ['fr-FR', 'avant-hier', TWO_BEFORE],
      ['fr-FR', 'avant hier', TWO_BEFORE],
      ['fr-FR', 'avant-hier soir', TWO_BEFORE],
      ['fr-FR', 'après-demain', TWO_AFTER],
      ['fr-FR', 'apres-demain', TWO_AFTER],
      ['fr-FR', 'après demain', TWO_AFTER],
      // è/é is the most ordinary French typo, and it used to yield tomorrow.
      ['fr-FR', 'aprés-demain', TWO_AFTER],
      // Capitalised at the start of a sentence. Without the `i` flag the native
      // parser wins on the lowercase tail and the original bug returns.
      ['fr-FR', 'Avant-hier', TWO_BEFORE],
      ['fr-FR', 'Après-demain', TWO_AFTER],
      ['pt-PT', 'depois de amanhã', TWO_AFTER],
      ['pt-PT', 'depois de amanha', TWO_AFTER],
      ['pt-PT', 'antes de ontem', TWO_BEFORE],
      ['ja-JP', '一昨日', TWO_BEFORE],
      // Japanese has no word separators, so the parser carries no letter guard.
      ['ja-JP', '私は一昨日', TWO_BEFORE],
      // Three days back. The Japanese casual parser has no boundary at all, so
      // it finds 昨日 inside this one and answers yesterday.
      ['ja-JP', '一昨昨日', '2025-11-01'],
      // Correct in casual mode, wrong in strict — see the strict test below.
      ['en-US', 'the day before yesterday', TWO_BEFORE],
      ['en-US', 'the day after tomorrow', TWO_AFTER],
    ])('%s', (locale, text, expected) => {
      it(`should parse "${text}" as ${expected}`, () => {
        const result = parseIn(locale, text);

        expect(result).not.toBeNull();
        expect(result?.date.toISODate()).toBe(expected);
      });
    });

    // German ships its own compound parser and is left alone. The single-day
    // French expressions live in "French language support" above; duplicating
    // them here bought nothing, since no mutation kills one copy without the
    // other.
    describe.each([
      ['de-DE', 'vorgestern', TWO_BEFORE],
      ['de-DE', 'übermorgen', TWO_AFTER],
    ])('%s (unchanged)', (locale, text, expected) => {
      it(`should still parse "${text}" as ${expected}`, () => {
        const result = parseIn(locale, text);

        expect(result).not.toBeNull();
        expect(result?.date.toISODate()).toBe(expected);
      });
    });

    describe('word boundaries', () => {
      // Copying chrono's `\W` boundary would reproduce the defect one level up:
      // the compound would match inside a longer word and turn a correct parse,
      // or a silent no-match, into a wrong date. `-antes` is a productive
      // Portuguese suffix — visitantes, participantes, estudantes.
      it('should leave a sentence that merely ends in "hier" alone', () => {
        // The native parser answers yesterday here and is right to: "hier" is
        // its own word. Reading "avant hier" across the word break would make
        // it the day before.
        expect(parseIn('fr-FR', 'savant hier soir')?.date.toISODate()).toBe('2025-11-03');
      });

      it.each([
        // "hier" is its own word, but covers 4 characters of 15, so the
        // coverage guard rejects it and nothing is inserted. Reading a compound
        // here would turn silence into a wrong date.
        ['fr-FR', 'auparavant hier'],
        // `-antes` is a productive Portuguese suffix: visitantes,
        // participantes, estudantes.
        ['pt-PT', 'os visitantes de ontem'],
        ['pt-PT', 'participantes de ontem'],
        ['fr-FR', 'réunionavant-hier'],
        ['fr-FR', 'avant-hierx'],
        // An accented letter is `\W` to a JavaScript regex, so chrono's own
        // boundary would accept this one. The guard here counts letters.
        ['fr-FR', 'avant-hieré'],
        ['pt-PT', 'antes de ontemx'],
        ['pt-PT', 'antes de ontemé'],
        // The separator is required. chrono answers nothing here — its own
        // boundary refuses the glued form — and reading it as a compound would
        // contradict the very argument this parser is built on.
        ['fr-FR', 'avanthier'],
        ['fr-FR', 'apresdemain'],
      ])('should refuse a compound glued to another word (%s, %s)', (locale, text) => {
        expect(parseIn(locale, text)).toBeNull();
      });

      it('should not count the boundary character as part of the match', () => {
        // The pattern has to capture the character before the compound, since
        // Obsidian's lint refuses lookbehinds. Leaving it in the match would
        // lengthen it by one and inflate NLP_MIN_COVERAGE_RATIO: here the
        // compound covers 10 of 21 characters, just under half — and 11 of 21,
        // just over, if the captured space is counted.
        expect(parseIn('fr-FR', 'on se voit avant-hier')).toBeNull();
      });

      it.each([
        ['precomposed', 'panach\u00E9avant-hier'],
        // macOS types `é` as `e` + U+0301. Without `\p{M}` in the guard the
        // combining mark reads as a boundary and the compound is accepted.
        ['decomposed', 'panache\u0301avant-hier'],
        ['trailing combining mark', 'avant-hier\u0301'],
      ])('should count an accented letter as a letter (%s)', (_form, text) => {
        // `é` is `\W` to a JavaScript regex. Reusing chrono's boundary here
        // would read a compound glued to a word ending in one.
        expect(parseIn('fr-FR', text)).toBeNull();
      });

      it('should not read a compound across a line break', () => {
        // `\s` would match the newline and turn a plain "hier soir" on its own
        // line into the day before yesterday.
        expect(parseIn('fr-FR', 'en avant\nhier soir')?.date.toISODate()).toBe('2025-11-03');
      });
    });

    describe('strict mode', () => {
      const reference = DateTime.fromISO(REFERENCE, { zone: 'Europe/Paris' });
      const strictIn = (locale: string, text: string) =>
        serviceFor(locale, { nlpStrictMode: true }).parse(text, reference);

      it('should parse French compounds where the plain words do not', () => {
        // Strict is where a user who wants no guesswork sets the plugin.
        expect(strictIn('fr-FR', 'après-demain')?.date.toISODate()).toBe(TWO_AFTER);
        expect(strictIn('fr-FR', 'demain')).toBeNull();
      });

      it.each([
        ['the day after tomorrow', TWO_AFTER],
        ['the day before yesterday', TWO_BEFORE],
      ])('should parse English "%s" as %s', (text, expected) => {
        // Strict drops the casual parser, and what remains reads `the day
        // after` as a one-day offset covering 13 of 22 characters — enough to
        // pass the coverage guard. English was wrong here while casual was
        // right, which is why it now carries a compound pattern of its own.
        expect(strictIn('en-US', text)?.date.toISODate()).toBe(expected);
      });
    });

    it('should leave the shared chrono instances untouched', async () => {
      // `chrono.fr.casual` and its siblings are module-level singletons.
      // Registering the parser on one rather than on a clone would reach every
      // other consumer in the process — and would survive between tests,
      // hiding the missing clone.
      const chrono = await import('chrono-node');
      const before = [
        chrono.fr.casual.parsers.length,
        chrono.pt.casual.parsers.length,
        chrono.ja.casual.parsers.length,
        chrono.fr.strict.parsers.length,
      ];

      serviceFor('fr-FR');
      serviceFor('fr-FR', { nlpStrictMode: true });

      expect([
        chrono.fr.casual.parsers.length,
        chrono.pt.casual.parsers.length,
        chrono.ja.casual.parsers.length,
        chrono.fr.strict.parsers.length,
      ]).toEqual(before);
    });
  });

  describe('parse() - parsing failure', () => {
    it('should return null for unrecognized text', () => {
      const result = nlpService.parse('not a date');

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
      };

      nlpService.updateSettings(frSettings);

      // Should now parse French expressions
      const result = nlpService.parse('demain');
      expect(result).not.toBeNull();
    });
  });
});
