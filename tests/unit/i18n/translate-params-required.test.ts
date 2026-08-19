import { I18nService } from '@/services/i18n-service';
import type { PlainTranslationKey, Translate } from '@/i18n/types';
import { MAX_TRIGGER_LENGTH } from '@/utils/constants';

/**
 * `params` used to be optional for every key. A call site that forgot its
 * argument compiled, and the user read `{{max}}` instead of `3`. The behavioural
 * guard in `settings-tab.test.ts` caught it in one dialog only; this pins the
 * signature itself, for every key at once.
 *
 * The `@ts-expect-error` directives ARE the assertions. ts-jest typechecks this
 * file, and an unused directive is a compile error (TS2578), so a signature that
 * stops rejecting the call fails the suite.
 *
 * A directive suppresses EVERY error on the line that follows it, so each one
 * below sits on a line with a single error surface: no type annotation, no
 * second call. Otherwise an unrelated future error would keep the directive
 * "used" and this file green while the rule it guards was gone.
 */
describe('the translate signature', () => {
  const i18n = new I18nService('en');

  it('rejects a key that expects a parameter and gets none', () => {
    // @ts-expect-error `settings.triggers.validation.tooLong` interpolates {{max}}
    const rendered = i18n.t('settings.triggers.validation.tooLong');

    // The call still runs — only the compiler objects. It renders the raw
    // template, which is exactly the user-visible defect being forbidden.
    expect(rendered).toContain('{{max}}');
  });

  it('rejects a parameter passed to a key that expects none', () => {
    // @ts-expect-error `picker.today` carries no template
    const rendered = i18n.t('picker.today', { max: MAX_TRIGGER_LENGTH });

    expect(rendered).not.toContain('{{');
  });

  it('accepts a parameterless key with no argument', () => {
    expect(i18n.t('picker.today')).not.toContain('{{');
  });

  it('accepts a parameterised key with its argument', () => {
    expect(i18n.t('settings.triggers.validation.tooLong', { max: MAX_TRIGGER_LENGTH })).toContain(
      String(MAX_TRIGGER_LENGTH)
    );
  });

  /**
   * `Translate` and `I18nService.t` are two declarations of one signature. They
   * are only useful while they agree: a component handed a `Translate` must be
   * able to forward to the service without widening anything.
   */
  describe('the Translate type it mirrors', () => {
    const t: Translate = (key, ...params) => i18n.t(key, ...params);

    it('forwards a parameterised call through the type', () => {
      expect(t('settings.triggers.validation.tooLong', { max: MAX_TRIGGER_LENGTH })).toContain(
        String(MAX_TRIGGER_LENGTH)
      );
    });

    /**
     * Also keeps the key below pinned outside a directive. A key that appears
     * ONLY under `@ts-expect-error` can be deleted from the locale files and the
     * directive stays "used" — on an unknown-key error instead of the missing
     * argument it was written for.
     */
    it('forwards the other parameterised key too', () => {
      expect(t('settings.triggers.characters.desc', { max: MAX_TRIGGER_LENGTH })).toContain(
        String(MAX_TRIGGER_LENGTH)
      );
    });

    it('rejects a key that expects a parameter and gets none', () => {
      // @ts-expect-error same rule, through the type rather than the service
      const rendered = t('settings.triggers.characters.desc');

      expect(rendered).toContain('{{max}}');
    });
  });

  /**
   * The variadic tuple distributes over a union, so the empty branch survives
   * when `K` is the whole `TranslationKey`: `t(someWideKey)` compiles even for a
   * key that needs a parameter. `PlainTranslationKey` is what closes that hole,
   * and every helper taking a key as data must use it.
   */
  describe('PlainTranslationKey', () => {
    it('rejects a parameterised key', () => {
      // @ts-expect-error `picker.openPreview` interpolates {{date}}
      const key: PlainTranslationKey = 'picker.openPreview';

      expect(i18n.t(key)).toBeTruthy();
    });

    it('accepts a parameterless key, and looks it up with no argument', () => {
      const key: PlainTranslationKey = 'picker.today';

      expect(i18n.t(key)).not.toContain('{{');
    });
  });
});
