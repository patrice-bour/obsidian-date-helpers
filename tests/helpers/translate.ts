import type { Translate } from '@/i18n/types';
import type { I18nService } from '@/services/i18n-service';

/**
 * A `Translate` backed by a real service.
 *
 * Stubs used to be written inline as `key => i18n.t(key)`, which dropped the
 * interpolation argument and so rendered `{{max}}` wherever a test crossed a
 * templated key. Forwarding `...params` is the whole point: a stub that cannot
 * carry a parameter is not a `Translate`.
 */
export function translateWith(i18n: Pick<I18nService, 't'>): Translate {
  return (key, ...params) => i18n.t(key, ...params);
}

/**
 * The same lookup, untyped, for the guardrails that iterate over keys read from
 * a locale file at runtime. A dotted string is not a `TranslationKey` to the
 * compiler, and casting it to `never` collapses the variadic tuple to `never`
 * too — so the cast belongs on the function, once, not on every call.
 */
export function translateByName(
  i18n: Pick<I18nService, 't'>
): (key: string, params?: Record<string, unknown>) => string {
  return i18n.t.bind(i18n) as (key: string, params?: Record<string, unknown>) => string;
}
