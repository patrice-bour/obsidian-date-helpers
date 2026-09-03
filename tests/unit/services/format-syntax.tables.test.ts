/**
 * The translation tables, checked against the engines rather than against
 * themselves.
 *
 * The rest of the suite compares a translated string to an expected string,
 * which cannot see a mapping that is wrong but consistent with itself: five
 * entries were listed as Luxon tokens that Luxon renders literally, and moment
 * `ZZ` was mapped to a Luxon `ZZ` that writes `+02:00` where moment writes
 * `+0200`. Nine of eighty entries were exercised, and none of those nine.
 *
 * So each table is asked of the engine it claims to speak for. `moment` is a
 * dependency already, pulled in by nothing else this plugin ships.
 */

import moment from 'moment';
import { DateTime } from 'luxon';
import { LUXON_TOKENS, MOMENT_TO_LUXON, readFormat } from '@/services/format-syntax';

/** A moment that exercises every field: a Friday, PM, with a fraction. */
const QUAND = new Date(2026, 7, 28, 14, 5, 6, 78);
const luxon = DateTime.fromJSDate(QUAND);

describe('the moment table says what moment says', () => {
  it.each(MOMENT_TO_LUXON.map(([from, to]) => [from, to]))(
    'moment %s and Luxon %s write the same thing',
    (from, to) => {
      expect(luxon.toFormat(to)).toBe(moment(QUAND).format(from));
    }
  );

  // A mapping that is merely self-consistent is what the rest of the suite
  // cannot see: a token rendering itself has not been translated, it has been
  // passed through.
  it.each(MOMENT_TO_LUXON.map(([from]) => from))('moment %s renders as something', from => {
    expect(moment(QUAND).format(from)).not.toBe(from);
  });
});

describe('the Luxon table says what Luxon says', () => {
  it.each(LUXON_TOKENS.map(token => [token]))('%s is a token Luxon renders', token => {
    // Luxon renders what it does not recognise as a literal, so a token that
    // comes back as itself is not a token — it is text the guard let through.
    expect(luxon.toFormat(token)).not.toBe(token);
  });

  it('lists no token twice', () => {
    expect(new Set(LUXON_TOKENS).size).toBe(LUXON_TOKENS.length);
  });

  // Longest first, or a short run masks the long one it starts.
  it('reads every listed token back as itself', () => {
    for (const token of LUXON_TOKENS) {
      const lu = readFormat(token);
      expect(lu.ok && lu.format).toBe(token);
    }
  });
});

describe('every moment format the ecosystem writes', () => {
  // The formats Obsidian core, Daily Notes and Templater put in front of people.
  it.each([
    ['YYYY-MM-DD'],
    ['YYYY-MM-DD HH:mm'],
    ['DD/MM/YYYY'],
    ['MM/DD/YYYY'],
    ['YYYY-MM-DD dddd'],
    ['YYYY [W]WW'],
    ['YYYY-MM-DD HH:mm:ss'],
  ])('%s is read, and writes what moment writes', saisie => {
    const lu = readFormat(saisie);
    expect(lu.ok).toBe(true);
    expect(luxon.toFormat((lu as { format: string }).format)).toBe(moment(QUAND).format(saisie));
  });
});
