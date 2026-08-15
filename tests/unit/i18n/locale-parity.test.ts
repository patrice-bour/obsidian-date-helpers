import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import { SRC_DIR, flattenKeys, lookupKey } from '../../helpers/translation-keys';

/**
 * The three ways a key can go wrong, each with its own failure at runtime:
 *
 * - present in `en`, missing in `fr` — the French user reads English
 * - present in `fr`, missing in `en` — nothing falls back to it
 * - present in the files, missing from the `TranslationKey` union — the lookup
 *   does not compile, and the union is maintained by hand
 *
 * `I18nService.t` renders a missing key as the key itself, which is visible but
 * only once someone opens that surface in that language.
 */

const KEY_UNION = path.join(SRC_DIR, 'i18n', 'types.ts');

/** The string literals of the exported `TranslationKey` union. */
function declaredKeys(): string[] {
  const source = ts.createSourceFile(
    KEY_UNION,
    fs.readFileSync(KEY_UNION, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  const keys: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === 'TranslationKey' &&
      ts.isUnionTypeNode(node.type)
    ) {
      node.type.types.forEach(member => {
        if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
          keys.push(member.literal.text);
        }
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return keys;
}

describe('locale parity', () => {
  const enKeys = flattenKeys(en);
  const frKeys = flattenKeys(fr);

  it('translates every English key into French', () => {
    expect(enKeys.filter(key => !frKeys.includes(key))).toEqual([]);
  });

  it('has no French key without an English counterpart', () => {
    expect(frKeys.filter(key => !enKeys.includes(key))).toEqual([]);
  });

  it('declares every key in the TranslationKey union', () => {
    expect(enKeys.filter(key => !declaredKeys().includes(key))).toEqual([]);
  });

  it('declares no key that the locale files do not carry', () => {
    expect(declaredKeys().filter(key => !enKeys.includes(key))).toEqual([]);
  });

  it('leaves no French value identical to its English source by accident', () => {
    // Product names and format labels legitimately match across locales
    const sharedByDesign = new Set([
      'settings.locale.name',
      'settings.presets.formats.iso8601.name',
      'settings.presets.formats.datetime-standard.name',
      'settings.weekStart.desc',
    ]);

    const untranslated = enKeys.filter(key => {
      if (sharedByDesign.has(key)) return false;
      const value = lookupKey(en, key);
      // A short label may coincide; only flag prose
      return typeof value === 'string' && value.includes(' ') && lookupKey(fr, key) === value;
    });

    expect(untranslated).toEqual([]);
  });
});
