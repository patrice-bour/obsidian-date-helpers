import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';
import { DateService } from './date-service';
import { I18nService } from './i18n-service';
import { DateHelpersSettings } from '@/types/settings';

/**
 * Parse result with additional metadata
 */
export interface ParseResult {
  /**
   * Parsed date/datetime
   */
  date: DateTime;

  /**
   * Whether the expression included a time component
   */
  hasTime: boolean;

  /**
   * Detected language (if auto-detection enabled)
   */
  detectedLanguage?: string;

  /**
   * Original text that was parsed
   */
  text: string;
}

/**
 * Enhanced Natural Language Processing service
 * Phase 4 additions:
 * - Language auto-detection
 * - Time expression integration
 */
export class NLPService {
  private dateService: DateService;
  private i18nService: I18nService;
  private settings: DateHelpersSettings;
  private chronoInstances: Map<string, chrono.Chrono>;

  constructor(
    dateService: DateService,
    i18nService: I18nService,
    settings: DateHelpersSettings
  ) {
    this.dateService = dateService;
    this.i18nService = i18nService;
    this.settings = settings;

    this.chronoInstances = new Map();

    this.initializeChrono();
  }

  /**
   * Initialize chrono parser instances for all supported languages
   */
  private initializeChrono(): void {
    const mode = this.settings.nlpStrictMode ? 'strict' : 'casual';

    // Create chrono instances for each supported language
    this.chronoInstances.set('en', chrono.en[mode]);
    this.chronoInstances.set('fr', chrono.fr[mode]);
    this.chronoInstances.set('de', chrono.de[mode]);
    this.chronoInstances.set('ja', chrono.ja[mode]);
    this.chronoInstances.set('pt', chrono.pt[mode]);
    this.chronoInstances.set('nl', chrono.nl[mode]);
  }

  /**
   * Get language code from locale
   */
  private getLocaleLanguage(): string {
    let locale = this.settings.locale;
    if (locale === 'auto') {
      locale = this.i18nService.getCurrentLocale();
    }
    return locale.split('-')[0];
  }

  /**
   * Try parsing with a specific language
   * Returns null if no results or if the match quality is too poor
   *
   * Match Quality Filter:
   * - Calculates coverage ratio: (matched text length) / (input length)
   * - Requires ≥50% coverage to accept the match
   * - Rationale: Prevents partial matches from wrong-language parsers
   *   Example: French parser matching "9am" (16.7% coverage) in "next Monday at 9am"
   *   would return today at 9am (incorrect). The 50% threshold rejects this,
   *   allowing the English parser to match the full expression (100% coverage).
   * - 50% chosen as optimal balance:
   *   * Too low (e.g., 30%): Accepts time-only partial matches
   *   * Too high (e.g., 80%): Rejects valid abbreviated expressions
   *   * 50%: Ensures substantial portion of input is recognized
   *
   * @param text - Natural language expression to parse
   * @param language - Language code (en, fr, de, ja, pt, nl)
   * @param referenceDate - Optional reference date for relative expressions
   * @returns Parsed results or null if no match or poor quality match
   */
  private tryParse(
    text: string,
    language: string,
    referenceDate?: DateTime
  ): chrono.ParsedResult[] | null {
    const chronoInstance = this.chronoInstances.get(language);
    if (!chronoInstance) {
      return null;
    }

    // Create a JS Date that preserves the DateTime's calendar components
    // (year, month, day, hour, minute) regardless of timezone.
    // Direct toJSDate() would shift the date when system TZ differs from the DateTime's zone.
    const dt = referenceDate || this.dateService.now();
    const refDate = new Date(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second);

    try {
      const results = chronoInstance.parse(text, refDate);
      if (results.length === 0) {
        return null;
      }

      // Check match quality: the matched text should cover a significant portion
      // of the input to avoid partial matches (e.g., French parser matching "9am" in "next Monday at 9am")
      const firstResult = results[0];
      const matchedLength = firstResult.text.length;
      const inputLength = text.trim().length;
      const coverageRatio = matchedLength / inputLength;

      // Require at least 50% coverage to accept the match
      // This prevents partial matches from being accepted
      if (coverageRatio < 0.5) {
        return null;
      }

      return results;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse with language auto-detection
   * Tries locale language first, then other supported languages
   */
  private parseWithAutoDetect(
    text: string,
    referenceDate?: DateTime
  ): { results: chrono.ParsedResult[]; language: string } | null {
    if (!this.settings.nlpAutoDetectLanguage) {
      // Auto-detection disabled, use locale language only
      const lang = this.getLocaleLanguage();
      const results = this.tryParse(text, lang, referenceDate);
      return results ? { results, language: lang } : null;
    }

    // Try locale language first (most likely)
    const localeLang = this.getLocaleLanguage();
    const localeResults = this.tryParse(text, localeLang, referenceDate);
    if (localeResults) {
      return { results: localeResults, language: localeLang };
    }

    // Try other supported languages
    for (const lang of this.chronoInstances.keys()) {
      if (lang === localeLang) continue; // Already tried

      const results = this.tryParse(text, lang, referenceDate);
      if (results) {
        return { results, language: lang };
      }
    }

    return null;
  }

  /**
   * Parse natural language text to DateTime with metadata
   * @param text - Natural language expression (e.g., "tomorrow", "next Monday at 2pm")
   * @param referenceDate - Optional reference date (defaults to now)
   * @returns Parsed result with metadata or null if parsing fails
   */
  parse(text: string, referenceDate?: DateTime): ParseResult | null {
    if (!this.settings.enableNLP) {
      return null;
    }

    const normalizedText = text.trim();
    if (!normalizedText) {
      return null;
    }

    const refDate = referenceDate || this.dateService.now();

    try {
      // Parse with auto-detection
      const parseResult = this.parseWithAutoDetect(normalizedText, refDate);

      if (!parseResult) {
        // Parsing failed - return null (caller handles warning if enabled)
        return null;
      }

      if (parseResult.results.length === 0) {
        return null;
      }

      // Take first result (most confident)
      const result = parseResult.results[0];

      // Check if time component is present and certain
      const hasTime = result.start.isCertain('hour');

      // Convert to DateTime
      const jsDate = result.start.date();
      const dt = DateTime.fromJSDate(jsDate).setLocale(
        this.i18nService.getCurrentLocale()
      );

      return {
        date: dt,
        hasTime,
        detectedLanguage: parseResult.language,
        text: normalizedText,
      };
    } catch (error) {
      console.error('NLP parsing error:', {
        text: normalizedText,
        locale: this.settings.locale,
        autoDetect: this.settings.nlpAutoDetectLanguage,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if text contains a parseable date expression
   * Uses heuristics for quick rejection before expensive parsing
   * @param text - Text to check
   * @returns true if text is likely a date expression
   */
  isParseable(text: string): boolean {
    if (!this.settings.enableNLP) {
      return false;
    }

    const normalizedText = text.trim();
    if (!normalizedText) {
      return false;
    }

    // Quick heuristic check before expensive parsing
    const dateKeywords = [
      // English
      'today',
      'tomorrow',
      'yesterday',
      'next',
      'last',
      'this',
      'ago',
      'from now',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      // French
      "aujourd'hui",
      'demain',
      'hier',
      'prochain',
      'prochaine',
      'dernier',
      'dernière',
      'dans',
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
      'dimanche',
      'semaine',
      'mois',
      // German
      'heute',
      'morgen',
      'gestern',
      'nächste',
      'letzte',
      'montag',
      'dienstag',
      'mittwoch',
      'donnerstag',
      'freitag',
      'samstag',
      'sonntag',
    ];

    const lowerText = normalizedText.toLowerCase();
    return dateKeywords.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * Get available languages for NLP parsing
   * @returns Array of supported language codes
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.chronoInstances.keys());
  }

  /**
   * Update settings and reinitialize chrono
   * @param settings - New settings
   */
  updateSettings(settings: DateHelpersSettings): void {
    this.settings = settings;
    this.initializeChrono();
  }
}
