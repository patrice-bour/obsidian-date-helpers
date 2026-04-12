import { FALLBACK_LOCALE } from '@/utils/constants';
import { detectObsidianLocale } from '@/utils/locale';
import { TranslationKey, TranslationParams } from '@/i18n/types';
import enTranslations from '@/i18n/locales/en.json';
import frTranslations from '@/i18n/locales/fr.json';

export class I18nService {
  private locale: string;
  private translations: Record<string, unknown>;

  constructor(locale: string = 'auto') {
    this.locale = this.resolveLocale(locale);
    this.translations = this.loadTranslations(this.locale);
  }

  /**
   * Translate a key to the current locale
   */
  t<K extends TranslationKey>(
    key: K,
    params?: K extends keyof TranslationParams ? TranslationParams[K] : never
  ): string {
    const value = this.getNestedValue(this.translations, key);

    if (typeof value !== 'string') {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    return this.interpolate(value, params);
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): string {
    return this.locale;
  }

  /**
   * Set locale and reload translations
   */
  setLocale(locale: string): void {
    this.locale = this.resolveLocale(locale);
    this.translations = this.loadTranslations(this.locale);
  }

  /**
   * Resolve locale from 'auto' or specific value
   */
  private resolveLocale(locale: string): string {
    if (locale === 'auto') {
      return detectObsidianLocale();
    }
    return locale;
  }

  /**
   * Load translation file for locale
   */
  private loadTranslations(locale: string): Record<string, unknown> {
    try {
      // Get language code (e.g., 'en' from 'en-US', 'fr' from 'fr-FR')
      const normalizedLocale = locale.split('-')[0];

      // Map of supported locales to their translation files
      const translationMap: Record<string, Record<string, unknown>> = {
        en: enTranslations as Record<string, unknown>,
        fr: frTranslations as Record<string, unknown>,
      };

      // Return translations for the locale, or fall back to English
      if (translationMap[normalizedLocale]) {
        return translationMap[normalizedLocale];
      }

      // Fallback to English for unsupported locales
      console.warn(
        `Translations not found for locale: ${locale}, falling back to ${FALLBACK_LOCALE}`
      );
      return enTranslations as Record<string, unknown>;
    } catch (error) {
      console.error('Failed to load translations:', error);
      return enTranslations as Record<string, unknown>;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj as unknown);
  }

  /**
   * Interpolate parameters into translation string
   */
  private interpolate(template: string, params?: Record<string, unknown>): string {
    if (!params) return template;

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = params[key]?.toString() || match;
      return this.escapeHtml(value);
    });
  }

  /**
   * Escape HTML characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }
}
