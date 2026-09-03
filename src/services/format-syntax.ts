/**
 * Reading a format string the user typed, in either syntax.
 *
 * The engine is Luxon; the ecosystem the user comes from is moment — Obsidian
 * core, Daily Notes and Templater all take `YYYY-MM-DD`. The two cannot be
 * tried in turn, because Luxon does not reject moment tokens: it renders them.
 * `YYYY-MM-DD` comes out as `YYYY-08-28 August 2026`, `Y` being left literal
 * while `DD` is a real Luxon token — the localized long date. A format that
 * looks wrong is accepted, and one that looks right lies.
 *
 * So the string is read as a whole, in one syntax, and translated once. Both
 * tables are checked against the engines themselves in
 * `format-syntax.tables.test.ts`: a mapping consistent only with itself is
 * exactly what a string-to-string test cannot see.
 */

/** A format read successfully, in the syntax the engine takes. */
export interface FormatRead {
  ok: true;
  /** The Luxon format string, whichever syntax was written */
  format: string;
}

/** Why a format was refused. A reason, not a sentence: the wording is i18n's. */
export type RefusalReason = 'empty' | 'unclosedLiteral' | 'unknownToken' | 'noToken';

export interface FormatRefused {
  ok: false;
  reason: RefusalReason;
  /**
   * What the reason is about, when it is about something: the offending run of
   * letters, or the character that opened a literal nobody closed.
   */
  offender?: string;
}

/**
 * Runs of letters that exist in moment and in no Luxon vocabulary.
 *
 * This is what decides the reading, and it is deliberately the only thing that
 * does. `D`, `DD` and `dd` are legal in BOTH with different meanings — day of
 * month in moment, localized date and 2-digit day in Luxon — so their presence
 * proves nothing. These do: Luxon has no `Y`, no `A`, no `Q`, no run of three
 * `d`, and reads `k` and `GG` as something else entirely.
 */
const MOMENT_EVIDENCE = /Y|A|Do|d{3,}|Q|G{2,}|k/;

/**
 * moment → Luxon, exact equivalences only.
 *
 * Deliberately closed and deliberately short. A moment token whose Luxon
 * counterpart writes something else is NOT here — it is refused by name, which
 * tells the user something true, where a near-enough mapping would quietly
 * write a different date. Left out for that reason: `Do` (Luxon has no ordinal
 * at all), `z` and `zz` (Luxon's `z` is the IANA name, `Europe/Paris`, where
 * moment writes `CEST`), `w`/`ww` (moment's local week against Luxon's ISO one
 * — equal in August, apart in January), and lowercase `a` (moment writes `pm`,
 * Luxon's only meridiem token writes `PM`).
 */
export const MOMENT_TO_LUXON: ReadonlyArray<readonly [string, string]> = [
  ['YYYY', 'yyyy'],
  ['YY', 'yy'],
  ['MMMM', 'MMMM'],
  ['MMM', 'MMM'],
  ['MM', 'MM'],
  ['M', 'M'],
  ['DD', 'dd'],
  ['D', 'd'],
  ['dddd', 'cccc'],
  ['ddd', 'ccc'],
  ['HH', 'HH'],
  ['H', 'H'],
  ['hh', 'hh'],
  ['h', 'h'],
  ['mm', 'mm'],
  ['m', 'm'],
  ['ss', 'ss'],
  ['s', 's'],
  ['SSS', 'SSS'],
  ['A', 'a'],
  ['Q', 'q'],
  // ISO week and its year, the pair Daily Notes writes for weekly notes.
  ['WW', 'WW'],
  ['W', 'W'],
  ['GGGG', 'kkkk'],
  ['GG', 'kk'],
  // Offset: moment `ZZ` writes `+0200`, which is Luxon's `ZZZ`, not its `ZZ`.
  ['ZZ', 'ZZZ'],
  ['Z', 'ZZ'],
  ['X', 'X'],
  ['x', 'x'],
];

/**
 * Every Luxon token this plugin accepts, longest run first.
 *
 * Not every token Luxon has. Two families are left out on purpose.
 *
 * The localized macros — `D`, `DD`, `f`, `F`, `t`, `T` and their runs — are the
 * trap named at the top of this file, and in a format the user writes by hand
 * to choose a shape, a macro that chooses the shape for them answers a question
 * nobody asked. The shipped presets already cover the localized forms.
 *
 * And the runs the moment evidence claims: `kk`, `kkkk`, `GG`, `GGGGG`. A token
 * that is itself evidence of the other syntax can never be reached in this one,
 * so listing it would promise something the reader cannot deliver. The same
 * dates are written the moment way — `GGGG-[W]WW` reads as `kkkk-'W'WW`.
 */
export const LUXON_TOKENS: ReadonlyArray<string> = [
  'yyyy',
  'yy',
  'y',
  'MMMMM',
  'MMMM',
  'MMM',
  'MM',
  'M',
  'LLLLL',
  'LLLL',
  'LLL',
  'LL',
  'L',
  'dd',
  'd',
  'ccccc',
  'cccc',
  'ccc',
  'c',
  'EEEEE',
  'EEEE',
  'EEE',
  'E',
  'HH',
  'H',
  'hh',
  'h',
  'mm',
  'm',
  'ss',
  's',
  'SSS',
  'S',
  'uuu',
  'uu',
  'u',
  'a',
  'ooo',
  'o',
  'qq',
  'q',
  'WW',
  'W',
  'ZZZZZ',
  'ZZZZ',
  'ZZZ',
  'ZZ',
  'Z',
  'z',
  'G',
  'X',
  'x',
];

/** The Luxon table in the shape the reader takes, built once. */
const LUXON_PAIRS: ReadonlyArray<readonly [string, string]> = LUXON_TOKENS.map(
  token => [token, token] as const
);

/**
 * Read `input` and give back the Luxon format it means.
 *
 * Refuses rather than guesses: a run of letters this module cannot place is
 * named back to the user, because the alternative — handing it to Luxon — is
 * the silent nonsense the module exists to prevent.
 */
export function readFormat(input: string): FormatRead | FormatRefused {
  const format = input.trim();
  if (format === '') return { ok: false, reason: 'empty' };

  const table = MOMENT_EVIDENCE.test(stripLiterals(format)) ? MOMENT_TO_LUXON : LUXON_PAIRS;

  let out = '';
  let named = false;
  let i = 0;

  while (i < format.length) {
    const ch = format[i];

    // A literal is not read: `[YYYY]` prints the letters, and so does `'YYYY'`.
    if (ch === '[' || ch === "'") {
      const close = ch === '[' ? ']' : "'";
      const end = format.indexOf(close, i + 1);
      if (end === -1) return { ok: false, reason: 'unclosedLiteral', offender: ch };

      if (ch === '[') {
        // Re-quoted, with any apostrophe escaped the way Luxon escapes one —
        // four of them. Copied straight through, `[Today's date]` became
        // `'Today's date'`, whose `s` then rendered as the seconds. An empty
        // pair is dropped rather than written as `''`, which Luxon renders as
        // a lone apostrophe.
        const inside = format.slice(i + 1, end);
        if (inside !== '') out += `'${inside.split("'").join("''''")}'`;
      } else {
        // A Luxon literal is already in the engine's own notation, escapes
        // included: copied verbatim, `'it''''s'` survives.
        out += format.slice(i, end + 1);
      }
      i = end + 1;
      continue;
    }

    if (!/[A-Za-z]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    // By RUN, never by prefix: Luxon reads a run as one token and renders an
    // unknown one literally, so `oo` read as `o` plus `o` wrote `oo` every day.
    const run = /^(.)\1*/.exec(format.slice(i)) as RegExpExecArray;
    const found = table.find(([from]) => from === run[0]);
    if (!found) return { ok: false, reason: 'unknownToken', offender: run[0] };

    out += found[1];
    named = true;
    i += run[0].length;
  }

  if (!named) return { ok: false, reason: 'noToken' };

  return { ok: true, format: out };
}

/** The string with literal contents blanked, so evidence is not read from them. */
function stripLiterals(format: string): string {
  return format.replace(/\[[^\]]*\]/g, '[]').replace(/'[^']*'/g, "''");
}
