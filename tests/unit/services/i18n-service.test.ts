import { I18nService } from '@/services/i18n-service';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService('en');
  });

  describe('constructor', () => {
    it('should initialize with provided locale', () => {
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('should resolve "auto" to detected locale', () => {
      const autoService = new I18nService('auto');
      expect(autoService.getCurrentLocale()).toBe('en');
    });

    it('should load translations for the locale', () => {
      const result = service.t('commands.insertText.name');
      expect(result).toBe('Insert date as text');
    });
  });

  describe('t()', () => {
    it('should translate known keys', () => {
      expect(service.t('commands.insertText.name')).toBe('Insert date as text');
      expect(service.t('settings.locale.name')).toBe('Locale');
      expect(service.t('settings.weekStart.monday')).toBe('Monday');
    });

    it('should return key for unknown translations', () => {
      const result = service.t('unknown.key' as any);
      expect(result).toBe('unknown.key');
    });

    it('should handle nested keys correctly', () => {
      expect(service.t('settings.weekStart.sunday')).toBe('Sunday');
      expect(service.t('settings.weekStart.monday')).toBe('Monday');
      expect(service.t('settings.weekStart.saturday')).toBe('Saturday');
    });

    it('should interpolate parameters', () => {
      const result = service.t('errors.invalidDate', { date: '2025-13-01' });
      expect(result).toBe('Invalid date: 2025-13-01');
    });

    it('should handle interpolation with multiple parameters', () => {
      // Add a translation with multiple params for testing
      const result = service.t('errors.invalidDate', { date: 'test' });
      expect(result).toContain('test');
    });

    it('should return original template if params are missing', () => {
      const result = service.t('errors.invalidDate' as any);
      expect(result).toBe('Invalid date: {{date}}');
    });

    it('should escape HTML characters in interpolated parameters', () => {
      const result = service.t('errors.invalidDate', { date: '<script>alert("xss")</script>' });
      expect(result).toBe('Invalid date: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands in interpolated parameters', () => {
      const result = service.t('errors.invalidDate', { date: 'A & B' });
      expect(result).toBe('Invalid date: A &amp; B');
    });
  });

  describe('getCurrentLocale()', () => {
    it('should return current locale', () => {
      expect(service.getCurrentLocale()).toBe('en');
    });
  });

  describe('setLocale()', () => {
    it('should change locale and reload translations', () => {
      service.setLocale('en');
      expect(service.getCurrentLocale()).toBe('en');
      expect(service.t('commands.insertText.name')).toBe('Insert date as text');
    });

    it('should resolve "auto" when setting locale', () => {
      service.setLocale('auto');
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('should fallback to English for unsupported locales', () => {
      service.setLocale('xx-XX');
      expect(service.getCurrentLocale()).toBe('xx-XX');
      // Translation should still work (fallback to en)
      expect(service.t('commands.insertText.name')).toBe('Insert date as text');
    });
  });
});
