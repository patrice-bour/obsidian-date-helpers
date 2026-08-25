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
      expect(result).toBe('Insert date as text…');
    });
  });

  describe('t()', () => {
    it('should translate known keys', () => {
      expect(service.t('commands.insertText.name')).toBe('Insert date as text…');
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
      const result = service.t('picker.openPreview', { date: '2026-08-16' });
      expect(result).toBe('Open: 2026-08-16');
    });

    it('should handle interpolation with multiple parameters', () => {
      const result = service.t('commands.presetCommand', {
        prefix: 'Insert date',
        name: 'ISO 8601',
      });
      expect(result).toBe('Insert date: ISO 8601');
    });

    it('should return original template if params are missing', () => {
      const result = service.t('picker.openPreview' as any);
      expect(result).toBe('Open: {{date}}');
    });

    // Interpolated values are shown as text, never as HTML: Notice, setText and
    // setName all assign textContent. Escaping them would show the entity to
    // the user — an apostrophe is common in the selected text these carry.
    it('should insert the value verbatim, entities included', () => {
      const result = service.t('picker.openPreview', { date: "l'année prochaine" });
      expect(result).toBe("Open: l'année prochaine");
    });

    it('should not escape angle brackets or ampersands', () => {
      const result = service.t('picker.openPreview', { date: '<b> A & B' });
      expect(result).toBe('Open: <b> A & B');
    });

    // The following cases exercise interpolate()'s runtime behaviour for
    // non-string param values. The public `t()` signature is typed to accept
    // string params only; we call through `unknown` to bypass the type check
    // on purpose.
    const callT = (params: Record<string, unknown>): string =>
      (
        service.t as unknown as (
          key: 'picker.openPreview',
          params: Record<string, unknown>
        ) => string
      ).call(service, 'picker.openPreview', params);

    it('should emit empty string when param is empty string', () => {
      expect(callT({ date: '' })).toBe('Open: ');
    });

    it('should emit "0" when param is the number zero', () => {
      expect(callT({ date: 0 })).toBe('Open: 0');
    });

    it('should emit "false" when param is the boolean false', () => {
      expect(callT({ date: false })).toBe('Open: false');
    });

    it('should preserve placeholder when param value is null', () => {
      expect(callT({ date: null })).toBe('Open: {{date}}');
    });

    it('should preserve placeholder when param key is missing', () => {
      expect(callT({ other: 'x' })).toBe('Open: {{date}}');
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
      expect(service.t('commands.insertText.name')).toBe('Insert date as text…');
    });

    it('should resolve "auto" when setting locale', () => {
      service.setLocale('auto');
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('should fallback to English for unsupported locales', () => {
      service.setLocale('xx-XX');
      expect(service.getCurrentLocale()).toBe('xx-XX');
      // Translation should still work (fallback to en)
      expect(service.t('commands.insertText.name')).toBe('Insert date as text…');
    });
  });
});
