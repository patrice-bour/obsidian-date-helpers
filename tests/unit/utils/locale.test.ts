import { detectObsidianLocale, isValidLocale, normalizeLocale } from '@/utils/locale';

describe('Locale utilities', () => {
  describe('detectObsidianLocale()', () => {
    it('should return default locale when moment is unavailable', () => {
      const originalMoment = (global as any).window.moment;
      delete (global as any).window.moment;

      const result = detectObsidianLocale();
      expect(result).toBe('en');

      // Restore
      (global as any).window.moment = originalMoment;
    });

    it('should return locale from window.moment when available', () => {
      const result = detectObsidianLocale();
      expect(result).toBe('en');
    });
  });

  describe('isValidLocale()', () => {
    it('should validate simple locale formats', () => {
      expect(isValidLocale('en')).toBe(true);
      expect(isValidLocale('fr')).toBe(true);
      expect(isValidLocale('de')).toBe(true);
      expect(isValidLocale('ja')).toBe(true);
    });

    it('should validate locale with region', () => {
      expect(isValidLocale('en-US')).toBe(true);
      expect(isValidLocale('en-GB')).toBe(true);
      expect(isValidLocale('pt-BR')).toBe(true);
      expect(isValidLocale('de-DE')).toBe(true);
      expect(isValidLocale('fr-FR')).toBe(true);
    });

    it('should validate complex BCP 47 locales with script', () => {
      expect(isValidLocale('zh-Hans')).toBe(true);
      expect(isValidLocale('zh-Hans-CN')).toBe(true);
      expect(isValidLocale('sr-Latn')).toBe(true);
      expect(isValidLocale('sr-Latn-RS')).toBe(true);
    });

    it('should reject null, undefined, and empty strings', () => {
      expect(isValidLocale('')).toBe(false);
      expect(isValidLocale(null as any)).toBe(false);
      expect(isValidLocale(undefined as any)).toBe(false);
    });

    it('should validate BCP 47 format and Luxon compatibility', () => {
      // Valid BCP 47 locale codes
      expect(isValidLocale('en')).toBe(true);
      expect(isValidLocale('fr-FR')).toBe(true);
      expect(isValidLocale('zh-Hans-CN')).toBe(true);

      // Invalid: word-like strings not matching BCP 47
      expect(isValidLocale('english')).toBe(false);

      // Invalid: malformed locales
      expect(isValidLocale('123')).toBe(false);
      expect(isValidLocale('en-')).toBe(false); // incomplete
      expect(isValidLocale('invalid-locale-xyz')).toBe(false);
    });

    it('should handle underscores if not normalized first', () => {
      // Underscores should be normalized before validation
      // This test documents current behavior - may need normalization first
      expect(isValidLocale('en_US')).toBe(false);
    });
  });

  describe('normalizeLocale()', () => {
    it('should convert underscore to hyphen', () => {
      expect(normalizeLocale('en_US')).toBe('en-US');
      expect(normalizeLocale('pt_BR')).toBe('pt-BR');
      expect(normalizeLocale('fr_FR')).toBe('fr-FR');
    });

    it('should leave valid locales unchanged', () => {
      expect(normalizeLocale('en-US')).toBe('en-US');
      expect(normalizeLocale('fr')).toBe('fr');
      expect(normalizeLocale('de-DE')).toBe('de-DE');
    });

    it('should handle multiple underscores', () => {
      expect(normalizeLocale('en_US_POSIX')).toBe('en-US-POSIX');
    });
  });
});
