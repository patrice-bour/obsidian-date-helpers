import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import en from '@/i18n/locales/en.json';
import { SRC_DIR, collectSourceFiles, flattenKeys } from '../../helpers/translation-keys';

/**
 * The mirror image of the hardcoded-string guardrail: a translation nothing
 * reads goes stale in silence. The `commands.*` keys proved it — complete in
 * both locales, never looked up, and already disagreeing with the registered
 * command names.
 *
 * Keys built at runtime (`settings.presets.formats.${id}.name`) are matched
 * against the template's static parts, so a dynamic lookup counts as a use.
 */

/**
 * The key union declares every key; declaring one is not reading it. Scanning
 * it would make every key look used and defeat the test.
 */
const KEY_DECLARATION = path.join(SRC_DIR, 'i18n', 'types.ts');

/** Dotted path that looks like a translation key, static or interpolated. */
const KEY_SHAPED = /^[a-z][A-Za-z0-9-]*(\.[A-Za-z0-9${}._-]+)+$/;

/** Every key-shaped literal in the source, as a matcher. */
function collectKeyMatchers(): RegExp[] {
  const matchers: RegExp[] = [];

  for (const filePath of collectSourceFiles(SRC_DIR, file => file === KEY_DECLARATION)) {
    const source = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (KEY_SHAPED.test(node.text)) {
          matchers.push(new RegExp(`^${escape(node.text)}$`));
        }
      } else if (ts.isTemplateExpression(node)) {
        // Static parts joined by a placeholder standing for one path segment
        const parts = [node.head.text, ...node.templateSpans.map(span => span.literal.text)];
        const pattern = parts.map(escape).join('[^.]+');
        if (KEY_SHAPED.test(parts.join('x'))) {
          matchers.push(new RegExp(`^${pattern}$`));
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return matchers;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('no unread translation keys', () => {
  it('has a lookup in the source for every key in en.json', () => {
    const matchers = collectKeyMatchers();
    const unread = flattenKeys(en).filter(key => !matchers.some(matcher => matcher.test(key)));

    expect(unread).toEqual([]);
  });
});
