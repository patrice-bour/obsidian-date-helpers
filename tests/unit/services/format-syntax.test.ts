/**
 * Reading a format string the user typed. Why the module exists, and why the
 * two syntaxes cannot simply be tried in turn: `src/services/format-syntax.ts`.
 */

import { DateTime } from 'luxon';
import { readFormat } from '@/services/format-syntax';

/** The Luxon format a string reads as, or `null` when it is refused */
function luxon(saisie: string): string | null {
  const lu = readFormat(saisie);
  return lu.ok ? lu.format : null;
}

/** Why a string was refused, and about what */
function refus(saisie: string): { reason: string; offender?: string } {
  const lu = readFormat(saisie);
  if (lu.ok) throw new Error(`« ${saisie} » a été acceptée, elle rend ${lu.format}`);
  return { reason: lu.reason, offender: lu.offender };
}

describe('reading a format string', () => {
  describe('moment syntax, recognised by a token Luxon never uses', () => {
    it.each([
      ['YYYY-MM-DD', 'yyyy-MM-dd'],
      ['DD/MM/YYYY', 'dd/MM/yyyy'],
      ['YYYY', 'yyyy'],
      ['YY', 'yy'],
      ['dddd D MMMM YYYY', 'cccc d MMMM yyyy'],
      ['YYYY-MM-DD HH:mm', 'yyyy-MM-dd HH:mm'],
      ['h:mm A', 'h:mm a'],
    ])('reads %s as %s', (saisie, attendu) => {
      expect(luxon(saisie)).toBe(attendu);
    });

    // The point of the whole module: the translated format has to render what
    // the user meant, not merely be accepted.
    it('renders the date the user meant, not a literal Y', () => {
      const jour = DateTime.fromISO('2026-08-28');
      const format = luxon('YYYY-MM-DD');

      expect(format).not.toBeNull();
      expect(jour.toFormat(format as string)).toBe('2026-08-28');
      // What Luxon does with the untranslated string, and why this exists.
      expect(jour.toFormat('YYYY-MM-DD')).toContain('YYYY');
    });
  });

  describe('Luxon syntax, taken as written', () => {
    it.each([['yyyy-MM-dd'], ['dd/MM/yyyy'], ['cccc d MMMM yyyy'], ['HH:mm:ss'], ['yyyy']])(
      'keeps %s as it stands',
      saisie => {
        expect(luxon(saisie)).toBe(saisie);
      }
    );
  });

  describe('literals', () => {
    it('turns a bracketed moment literal into a quoted Luxon one', () => {
      expect(luxon('[le] DD/MM/YYYY')).toBe("'le' dd/MM/yyyy");
    });

    // Inside a literal, a token is not a token: `[YYYY]` prints the letters.
    it('does not translate inside a literal', () => {
      expect(luxon('[YYYY] YYYY')).toBe("'YYYY' yyyy");
    });

    it('leaves a Luxon quoted literal alone', () => {
      expect(luxon("'at' HH:mm")).toBe("'at' HH:mm");
    });
  });

  describe('a run of letters is one token, never two', () => {
    // Luxon reads a run as a single token and renders an unknown one
    // literally. Consumed by prefix, `oo` matched `o` and the preset wrote
    // `oo` on every day of the year — accepted, with a green preview.
    it.each([['oo'], ['yyy'], ['EE'], ['qqq'], ['MMMMMM']])(
      'refuses %s rather than reading its first letters',
      saisie => {
        expect(refus(saisie).reason).toBe('unknownToken');
      }
    );

    it('names the whole run, not the letter it starts with', () => {
      expect(refus('yyyy-oo-dd')).toEqual({ reason: 'unknownToken', offender: 'oo' });
    });
  });

  describe('a bracket literal keeps what is inside it', () => {
    // Copied straight through, `[Today's date]` became `'Today's date'`: the
    // apostrophe closed the literal and the `s` rendered as the seconds.
    it('escapes an apostrophe rather than letting it close the literal', () => {
      const lu = readFormat("[Today's date] YYYY");

      expect(lu.ok).toBe(true);
      expect(DateTime.fromISO('2026-08-28').toFormat((lu as { format: string }).format)).toBe(
        "Today's date 2026"
      );
    });

    it('drops an empty pair rather than writing a stray apostrophe', () => {
      const lu = readFormat('YYYY []');

      expect(lu.ok).toBe(true);
      expect(DateTime.fromISO('2026-08-28').toFormat((lu as { format: string }).format)).toBe(
        '2026 '
      );
    });
  });

  describe('what is refused, and named', () => {
    // `Do` rather than `X`: `X` is a unix timestamp in both vocabularies and
    // is accepted. The ordinal is the real case — moment writes `28th`, Luxon
    // has no ordinal token at all, so no mapping would be honest.
    it('refuses a moment token with no Luxon equivalent, naming it', () => {
      expect(refus('YYYY Do')).toEqual({ reason: 'unknownToken', offender: 'o' });
    });

    // The whole run, not the first letter: `VV` reads back as what was typed.
    it('refuses a token that belongs to neither vocabulary, naming the run', () => {
      expect(refus('yyyy-VV-dd')).toEqual({ reason: 'unknownToken', offender: 'VV' });
    });

    it('refuses an unterminated literal, naming what opened it', () => {
      expect(refus('[le DD/MM/YYYY')).toEqual({ reason: 'unclosedLiteral', offender: '[' });
    });

    it('refuses an empty format', () => {
      expect(refus('   ').reason).toBe('empty');
    });
  });

  // Separators, spaces and punctuation are not tokens and must survive.
  it('carries punctuation through untouched', () => {
    expect(luxon('YYYY-MM-DD, HH:mm')).toBe('yyyy-MM-dd, HH:mm');
  });

  // A format made only of punctuation names nothing: accepting it would let the
  // user store a preset that renders the same string for every day.
  it('refuses a format that names nothing at all', () => {
    expect(refus('---').reason).toBe('noToken');
  });
});
