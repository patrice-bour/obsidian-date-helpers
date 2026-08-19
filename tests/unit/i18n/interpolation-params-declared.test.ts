import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import { I18nService } from '@/services/i18n-service';
import { SRC_DIR, flattenKeys, lookupKey } from '../../helpers/translation-keys';
import { translateByName } from '../../helpers/translate';

/**
 * Making `params` required stops a call site from forgetting its argument. It
 * does not stop a template and its declaration from naming different things:
 * `{{maxi}}` fed `{ max: 3 }` compiles, and the user reads the raw template.
 *
 * So the templates are the source of truth here. Every placeholder they carry
 * must be declared in `TranslationParams`, in both locales, and nothing else may
 * be declared.
 */

const TYPES_FILE = path.join(SRC_DIR, 'i18n', 'types.ts');

/**
 * `{{max}} of {{total}}` → `['max', 'total']`, deduplicated.
 *
 * Deliberately WIDER than the pattern `I18nService.interpolate` substitutes
 * with (`/\{\{(\w+)\}\}/g`): this one also matches inner spaces, dots and
 * dashes. That gap is what gives the rendering block below its killing power —
 * a translator who writes `{{ max }}` is caught there, and nowhere else. Do not
 * align the two patterns "for consistency": it would empty those assertions
 * without turning a single test red.
 */
function placeholdersOf(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(/{{\s*([\w.-]+)\s*}}/g), match => match[1]))];
}

/** Keys of one locale file whose value carries a template. */
function templatedKeys(translations: unknown): string[] {
  return flattenKeys(translations).filter(key =>
    String(lookupKey(translations, key)).includes('{{')
  );
}

/** `TranslationParams` as data: key → declared property names. */
function declaredParams(): Map<string, string[]> {
  const source = ts.createSourceFile(
    TYPES_FILE,
    fs.readFileSync(TYPES_FILE, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const declared = new Map<string, string[]>();

  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'TranslationParams') {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.name) continue;
        const key = ts.isStringLiteral(member.name) ? member.name.text : member.name.getText();
        const shape = member.type;
        declared.set(
          key,
          shape && ts.isTypeLiteralNode(shape)
            ? shape.members.map(field => field.name?.getText().replace(/^['"]|['"]$/g, '') ?? '')
            : []
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return declared;
}

const LOCALES: Array<[string, unknown]> = [
  ['en', en],
  ['fr', fr],
];

describe('interpolation parameters', () => {
  const declared = declaredParams();

  /**
   * Guards the guard: if the interface stops parsing, every `toEqual([])` below
   * would pass against an empty map and the suite would prove nothing.
   */
  it('reads TranslationParams out of the source', () => {
    expect(declared.size).toBeGreaterThan(0);
    expect(declared.get('settings.triggers.validation.tooLong')).toEqual(['max']);
  });

  describe.each(LOCALES)('%s', (_name, translations) => {
    const templated = templatedKeys(translations);

    it('has at least one templated key', () => {
      expect(templated.length).toBeGreaterThan(0);
    });

    it.each(templated.map(key => [key]))('%s declares every placeholder it carries', key => {
      const template = String(lookupKey(translations, key));

      // Sorted on both sides: the interface declares its properties in one
      // order and a translation may interpolate them in another. Order is not
      // the rule being pinned here.
      expect([...(declared.get(key) ?? [])].sort()).toEqual([...placeholdersOf(template)].sort());
    });
  });

  it('declares no key that carries no template', () => {
    const templatedInEnglish = new Set(templatedKeys(en));

    expect([...declared.keys()].filter(key => !templatedInEnglish.has(key))).toEqual([]);
  });

  /**
   * Per-locale, a key that loses its template simply drops out of that locale's
   * list and stops being checked at all. Dropping `{{date}}` from the French
   * `errors.dailyNoteMissing` would leave every test green, and a French user
   * would read the notice with no date in it. So the union is what is walked.
   */
  it('carries the same placeholders in every locale', () => {
    const templatedAnywhere = new Set([...templatedKeys(en), ...templatedKeys(fr)]);

    expect(templatedAnywhere.size).toBeGreaterThan(0);
    for (const key of templatedAnywhere) {
      const french = placeholdersOf(String(lookupKey(fr, key))).sort();

      expect(french).toEqual(placeholdersOf(String(lookupKey(en, key))).sort());
    }
  });

  describe.each(LOCALES)('%s rendering', (name, translations) => {
    const i18n = new I18nService(name);

    it.each(templatedKeys(translations).map(key => [key]))(
      '%s leaves no placeholder unresolved',
      key => {
        const filled = Object.fromEntries(
          placeholdersOf(String(lookupKey(translations, key))).map(placeholder => [
            placeholder,
            'x',
          ])
        );

        expect(translateByName(i18n)(key, filled)).not.toContain('{{');
      }
    );
  });
});
