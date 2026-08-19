import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import { I18nService } from '@/services/i18n-service';
import { MAX_TRIGGER_LENGTH } from '@/utils/constants';
import { translateByName } from '../../helpers/translate';

/**
 * The trigger length limit is a constant, and two strings tell the user what it
 * is. Written as a literal, they drift the day the constant moves: the dialog
 * would accept a longer sequence while its description still names the old
 * limit, and the error it raises would name it too. Nothing else would catch
 * it — `unused-translation-keys` checks that a key is *used*, never what it
 * says.
 *
 * So the strings interpolate `{{max}}`, and this pins that they do.
 */
describe('the strings naming MAX_TRIGGER_LENGTH', () => {
  const STRINGS: Array<[string, string]> = [
    ['en settings.triggers.characters.desc', en.settings.triggers.characters.desc],
    ['fr settings.triggers.characters.desc', fr.settings.triggers.characters.desc],
    ['en settings.triggers.validation.tooLong', en.settings.triggers.validation.tooLong],
    ['fr settings.triggers.validation.tooLong', fr.settings.triggers.validation.tooLong],
  ];

  it.each(STRINGS)('%s interpolates the limit instead of spelling it out', (_label, value) => {
    expect(value).toContain('{{max}}');
    // The limit as a bare number is what this test exists to forbid. Other
    // digits are fine — the examples `@@` and `//d` carry none, but a future
    // rewrite might.
    expect(value).not.toContain(String(MAX_TRIGGER_LENGTH));
  });

  it.each([['settings.triggers.characters.desc'], ['settings.triggers.validation.tooLong']])(
    'renders %s with the constant, in both locales',
    key => {
      for (const locale of ['en', 'fr']) {
        const rendered = translateByName(new I18nService(locale))(key, {
          max: MAX_TRIGGER_LENGTH,
        });

        expect(rendered).toContain(String(MAX_TRIGGER_LENGTH));
        expect(rendered).not.toContain('{{max}}');
      }
    }
  );
});
