import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { REPO_ROOT, SRC_DIR, collectSourceFiles } from './translation-keys';

/**
 * Scanner for user-facing string literals left in the source.
 *
 * Backs the guardrail test: every string the user can read must come from the
 * i18n service. Translations that nothing reads drift silently — the
 * `commands.*` keys were complete in both locales, unread, and already
 * disagreed with the registered command names.
 *
 * Two complementary layers, because either alone has a hole:
 *
 * 1. **Display sites** — `new Notice(...)`, `setName/setDesc/setPlaceholder/
 *    setButtonText/setText(...)`, and `name:`/`desc:`/`label:`/`text:`/
 *    `heading:`/`description:`/`emptyState:` properties. Catches single words
 *    ("Today") that layer 2 lets through.
 * 2. **Sentence-shaped literals anywhere** — any literal holding two words.
 *    Catches text that reaches a display site through a helper function, which
 *    is exactly how `Original Text (…)` escaped layer 1.
 */

/** Methods whose first argument is rendered to the user. */
const DISPLAY_METHODS = new Set([
  'setName',
  'setDesc',
  'setPlaceholder',
  'setButtonText',
  'setText',
  'setTitle',
  'setTooltip',
  'setMessage',
  'setAriaLabel',
  'setValue',
]);

/** Object properties rendered to the user (command names, tab labels, rows). */
const DISPLAY_PROPS = new Set([
  'name',
  'desc',
  'description',
  'label',
  'text',
  'heading',
  'emptyState',
  'placeholder',
]);

export interface UserFacingLiteral {
  /** Path relative to the repository root */
  file: string;
  line: number;
  /** The literal text, or the static parts of a template literal */
  text: string;
  /** Which layer reported it */
  kind: 'display-site' | 'sentence';
}

/**
 * Literals that legitimately stay in the source. Each entry states why.
 * A `file` of `*` matches any file.
 */
export const ALLOWLIST: Array<{ file: string; text: string; reason: string }> = [
  {
    file: '*',
    text: 'yyyy-MM-dd HH:mm',
    reason: 'Luxon format pattern, not prose — never displayed as such',
  },
  {
    file: 'src/settings/defaults.ts',
    text: 'EEEE d MMMM yyyy',
    reason: 'Luxon format pattern for the verbose date preset',
  },
  {
    file: 'src/settings/defaults.ts',
    text: 'h:mm a',
    reason: 'Luxon format pattern for the 12-hour time preset',
  },
  {
    file: 'src/settings/defaults.ts',
    text: 'yyyy-MM-dd HH:mm:ss',
    reason: 'Luxon format pattern for the standard datetime preset',
  },
  {
    file: 'src/services/nlp-service.ts',
    text: 'from now',
    reason: 'English keyword the parser matches against, not text shown to anyone',
  },
  {
    file: 'src/ui/date-picker/date-picker-state.ts',
    text: 'UnifiedDatePickerModal requires at least one format preset',
    reason: 'Programming error: thrown at construction, logged, never displayed',
  },
];

function isAllowed(literal: UserFacingLiteral): boolean {
  return ALLOWLIST.some(
    entry => entry.text === literal.text && (entry.file === '*' || entry.file === literal.file)
  );
}

/**
 * Prose, not an identifier: two runs of letters separated by a space, where one
 * of the two may be a single letter ("Pick a date", "Add a trigger"). Ids and
 * CSS classes have no space; format patterns that do are allowlisted.
 */
const SENTENCE = /[A-Za-z]+[^\S\n]+\S*[A-Za-z]+/;

/** Any letter at all — an id like `insert-text` has none once split on `-`. */
const HAS_WORD = /[A-Za-z]{2,}/;

/**
 * The literals a display site can hand over indirectly: both branches of a
 * conditional, and every operand of a concatenation. Without this, `setText(ok
 * ? 'Yes' : 'No')` and `new Notice('Failed: ' + err)` walk straight through.
 */
function displayedParts(node: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(node)) return displayedParts(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [...displayedParts(node.whenTrue), ...displayedParts(node.whenFalse)];
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...displayedParts(node.left), ...displayedParts(node.right)];
  }
  return [node];
}

/** Static text of a literal, or of a template literal's fixed parts. */
function staticText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('');
  }
  return null;
}

/** CSS class helpers: their arguments are class lists, not prose. */
const CLASS_METHODS = new Set(['addClass', 'removeClass', 'toggleClass', 'hasClass']);

/** Console output, import paths and CSS class names are not user-facing. */
function isExcludedContext(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return true;
    if (ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) {
      if (current.name.text === 'cls') return true;
    }
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      if (ts.isPropertyAccessExpression(callee) && CLASS_METHODS.has(callee.name.text)) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'console'
      ) {
        return true;
      }
      // A translation key passed to t(...) / ctx.t(...) / i18n.t(...)
      const isTranslate =
        (ts.isIdentifier(callee) && callee.text === 't') ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === 't');
      if (isTranslate && current.arguments.includes(node as ts.Expression)) return true;
    }
  }
  return false;
}

export function scanUserFacingLiterals(): UserFacingLiteral[] {
  const found: UserFacingLiteral[] = [];

  for (const filePath of collectSourceFiles(SRC_DIR, file => file.endsWith('.d.ts'))) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relative = path.relative(REPO_ROOT, filePath);
    const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    const record = (node: ts.Node, text: string, kind: UserFacingLiteral['kind']) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      const literal = { file: relative, line: line + 1, text, kind };
      if (!isAllowed(literal)) found.push(literal);
    };

    const visit = (node: ts.Node): void => {
      const displayed = displayedExpression(node);
      if (displayed) {
        displayedParts(displayed).forEach(part => {
          const text = staticText(part);
          if (text !== null && HAS_WORD.test(text) && !isExcludedContext(part)) {
            record(part, text, 'display-site');
          }
        });
      }

      const text = staticText(node);
      if (
        text !== null &&
        SENTENCE.test(text) &&
        !isExcludedContext(node) &&
        !found.some(f => f.file === relative && f.text === text)
      ) {
        record(node, text, 'sentence');
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return found;
}

/** The expression a node hands to the user, if it is a display site. */
function displayedExpression(node: ts.Node): ts.Expression | null {
  if (ts.isNewExpression(node)) {
    const callee = node.expression;
    if (ts.isIdentifier(callee) && callee.text === 'Notice') {
      return node.arguments?.[0] ?? null;
    }
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee) && DISPLAY_METHODS.has(callee.name.text)) {
      return node.arguments[0] ?? null;
    }
  }
  if (ts.isPropertyAssignment(node)) {
    const name =
      ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
    if (name && DISPLAY_PROPS.has(name)) {
      return node.initializer;
    }
  }
  return null;
}
