import * as chrono from 'chrono-node';

/**
 * Chrono parsers for compounds built from a shorter relative day — "the day
 * before yesterday", "après-demain" — which the bundled parsers resolve to the
 * shorter expression they contain.
 *
 * Two distinct mechanisms produce it. In French, Portuguese and English the
 * parser does check word boundaries, through `AbstractParserWithWordBoundary`
 * prepending `(\W|^)` — which is why `avanthier` matches nothing there. But a
 * hyphen and a space are `\W`, so `demain` legitimately starts a word inside
 * `après-demain`. The Japanese casual parser implements `Parser` directly and
 * carries no boundary at all, so `昨日` matches anywhere, `一昨昨日` included.
 *
 * Whether the user then sees a wrong date or nothing depends on
 * `NLP_MIN_COVERAGE_RATIO`, which rejects a match covering less than half the
 * input — an unrelated guard that catches `avant-hier` (4 of 10) and lets
 * `après-demain` through (6 of 12).
 *
 * A parser matching the whole compound wins: chrono keeps the longer result and
 * drops the overlapping native one, so each expression yields exactly one date.
 *
 * German is absent: `vorgestern` and `übermorgen` are single words, correct in
 * casual mode and absent from strict, so no reading of them is ever wrong.
 * Dutch is absent because its compounds are not recognised at all — a missing
 * feature rather than a wrong answer.
 */

/**
 * Group `back` means two days before, `back3` three, anything else two after.
 *
 * Each pattern opens on `head` — start of input, or one character that is
 * neither a letter, a digit nor a combining mark — and closes on the same lookahead, so
 * a compound is never found inside a word. Reusing chrono's `\W` would
 * reproduce the defect one level up: `de ontem` inside `os visitantes de ontem`
 * (`-antes` is a productive Portuguese suffix), `avant hier` inside
 * `savant hier soir`, and `avant-hieré` would be accepted. Combining marks
 * count too: macOS types `é` as `e` + U+0301, and without `\p{M}` the guard
 * would see the mark as a boundary and accept `panache\u0301avant-hier`.
 *
 * `head` is a captured group rather than a lookbehind because Obsidian's plugin
 * lint refuses lookbehinds — iOS had none before 16.4 and this plugin ships for
 * mobile. `extract` strips it back off, the way chrono's own
 * `AbstractParserWithWordBoundaryChecking` does; leaving it in would inflate the
 * matched text and skew `NLP_MIN_COVERAGE_RATIO`.
 *
 * The inner separators accept spaces, tabs, non-breaking spaces and hyphens,
 * but never a line break: a compound does not span lines, and `\s` would read
 * `en avant\nhier soir` as the day before yesterday when the plain reading is
 * `hier soir`.
 */
const COMPOUNDS: Record<string, RegExp> = {
  // Strict mode drops the casual parser, and what remains reads `the day
  // after` as a one-day offset — so English is wrong there even though casual
  // is right.
  en: /(?<head>^|[^\p{L}\p{N}\p{M}])(?:(?<back>the[\t \u00A0]+day[\t \u00A0]+before[\t \u00A0]+yesterday)|the[\t \u00A0]+day[\t \u00A0]+after[\t \u00A0]+tomorrow)(?![\p{L}\p{N}\p{M}])/iu,
  // Hyphen or space, and `apres` with any accent or none — the è/é confusion
  // is the most ordinary French typo, and it used to yield tomorrow.
  fr: /(?<head>^|[^\p{L}\p{N}\p{M}])(?:(?<back>avant[-\t \u00A0]+hier)|apr[eèéê]s[-\t \u00A0]+demain)(?![\p{L}\p{N}\p{M}])/iu,
  // `amanhã` is routinely typed without the tilde.
  pt: /(?<head>^|[^\p{L}\p{N}\p{M}])(?:(?<back>antes[\t \u00A0]+de[\t \u00A0]+ontem)|depois[\t \u00A0]+de[\t \u00A0]+amanh[ãa])(?![\p{L}\p{N}\p{M}])/iu,
  // No boundaries: Japanese does not separate words, so a letter guard would
  // reject 一昨日 after any kana — `私は一昨日` is the ordinary way to write it.
  // 一昨昨日 comes first so the longer compound wins the alternation.
  ja: /(?<back3>一昨昨日)|(?<back>一昨日)/u,
};

const DAYS = 2;

function compoundDayParser(language: string): chrono.Parser | null {
  const pattern = COMPOUNDS[language];
  if (!pattern) return null;

  return {
    pattern: () => pattern,
    extract: (context, match) => {
      const groups = match.groups ?? {};

      // Hand back the boundary character the pattern had to capture, so the
      // result covers the compound alone. Japanese carries no boundary, so
      // there is nothing to strip.
      const head = groups.head ?? '';
      if (head) {
        match.index = (match.index ?? 0) + head.length;
        match[0] = match[0].substring(head.length);
      }

      const offset = groups.back3 ? -3 : groups.back ? -DAYS : DAYS;

      // `context.refDate` is always set; `context.reference.instant` is
      // optional and would silently fall back to "now", which is exactly the
      // bug a reference date exists to prevent.
      const reference = context.refDate;
      const target = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        reference.getDate() + offset
      );

      return {
        day: target.getDate(),
        month: target.getMonth() + 1,
        year: target.getFullYear(),
      };
    },
  };
}

/**
 * `chrono.fr.casual` and its siblings are module-level singletons. Registering
 * a parser on one reaches every other consumer in the process, and survives
 * between tests — so a missing clone would hide itself.
 */
export function withCompoundDays(instance: chrono.Chrono, language: string): chrono.Chrono {
  const parser = compoundDayParser(language);
  if (!parser) return instance;

  const clone = instance.clone();
  clone.parsers.unshift(parser);
  return clone;
}
