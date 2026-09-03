/**
 * Reading what the user typed into the preset editor, and deciding what may be
 * deleted.
 *
 * The data model has carried user presets since before any interface created
 * one — a `name`, `builtin: false`, and a validator that preserves both. What
 * was missing was the reading between a field and a stored preset.
 */

import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { blocksDeletion, idForName, readDraft } from '@/utils/preset-editing';

const utilisateur = (over: Partial<FormatPreset> = {}): FormatPreset => ({
  id: 'compact',
  name: 'Compact',
  format: 'yyyyMMdd',
  type: 'date',
  builtin: false,
  showInSuggest: false,
  ...over,
});

function settings(patch: Partial<DateHelpersSettings> = {}): DateHelpersSettings {
  return { ...DEFAULT_SETTINGS, formatPresets: [...DEFAULT_SETTINGS.formatPresets], ...patch };
}

describe('reading a preset draft', () => {
  it('stores the format translated to the engine syntax', () => {
    const lu = readDraft({ name: 'Compact', format: 'YYYY-MM-DD', type: 'date' }, []);

    expect(lu.ok).toBe(true);
    // What is validated has to be what is stored, or the field accepts one
    // string and Luxon renders another.
    expect(lu.ok && lu.preset.format).toBe('yyyy-MM-dd');
  });

  it('marks the preset as the user’s, never as shipped', () => {
    const lu = readDraft({ name: 'Compact', format: 'yyyyMMdd', type: 'date' }, []);

    expect(lu.ok && lu.preset.builtin).toBe(false);
    expect(lu.ok && lu.preset.name).toBe('Compact');
  });

  it('trims the name, so two names that look alike are alike', () => {
    const lu = readDraft({ name: '  Compact  ', format: 'yyyyMMdd', type: 'date' }, []);

    expect(lu.ok && lu.preset.name).toBe('Compact');
  });

  it.each([
    ['empty', ''],
    ['nothing but spaces', '   '],
  ])('refuses a name that is %s', (_cas, name) => {
    const lu = readDraft({ name, format: 'yyyyMMdd', type: 'date' }, []);

    expect(lu).toEqual({ ok: false, problem: { field: 'name', reason: 'empty' } });
  });

  it('refuses a name another user preset already carries', () => {
    const lu = readDraft({ name: 'Compact', format: 'yyyyMMdd', type: 'date' }, [utilisateur()]);

    expect(lu).toEqual({ ok: false, problem: { field: 'name', reason: 'duplicate' } });
  });

  // Editing a preset must not collide with itself, or its name could never be
  // kept while its format changed.
  it('lets a preset keep its own name while being edited', () => {
    const lu = readDraft(
      { name: 'Compact', format: 'yyyy-MM-dd', type: 'date' },
      [utilisateur()],
      'compact'
    );

    expect(lu.ok).toBe(true);
  });

  // Built-in names are translated, so a clash in one locale is free in another:
  // the collision that matters is with the user's own names.
  //
  // The fixture carries a stored `name` on the built-in, which is the whole
  // point: the shipped presets carry none, so against them this test would have
  // passed with the `builtin` clause removed — it would have measured nothing.
  // A `data.json` written before `stripBuiltinLabels` is exactly this shape.
  it('does not collide with a built-in preset’s stored name', () => {
    const natifNomme: FormatPreset = { ...DEFAULT_SETTINGS.formatPresets[0], name: 'Compact' };

    const lu = readDraft({ name: 'Compact', format: 'yyyyMMdd', type: 'date' }, [natifNomme]);

    expect(lu.ok).toBe(true);
  });

  it('passes the format refusal through, offender included', () => {
    const lu = readDraft({ name: 'Compact', format: 'yyyy-VV-dd', type: 'date' }, []);

    expect(lu).toEqual({
      ok: false,
      problem: { field: 'format', reason: 'unknownToken', offender: 'VV' },
    });
  });
});

describe('choosing an id', () => {
  it('builds it from the name, so the command reads as something', () => {
    expect(idForName('Compact date', [])).toBe('user-compact-date');
  });

  it('strips accents rather than dropping the letters', () => {
    expect(idForName('Année courte', [])).toBe('user-annee-courte');
  });

  // Without the mark, "Compact" takes `compact` — and the day a release ships a
  // built-in by that id, the validator's merge folds the user's entry into it
  // and replaces the format, keeping the name, without a word.
  it('marks every id as the user’s, so no shipped id can absorb it', () => {
    expect(idForName('ISO 8601', [])).toBe('user-iso-8601');
    expect(DEFAULT_SETTINGS.formatPresets.some(p => p.id.startsWith('user-'))).toBe(false);
  });

  it('suffixes rather than collide with an id already taken', () => {
    expect(idForName('Compact', [utilisateur({ id: 'user-compact' })])).toBe('user-compact-2');
  });

  it('suffixes past every collision, not only the first', () => {
    const pris = [utilisateur({ id: 'user-compact' }), utilisateur({ id: 'user-compact-2' })];

    expect(idForName('Compact', pris)).toBe('user-compact-3');
  });

  it('falls back when a name reduces to nothing usable', () => {
    expect(idForName('!!!', [])).toBe('user-preset');
  });
});

describe('deciding what may be deleted', () => {
  it('lets an unreferenced user preset go', () => {
    expect(blocksDeletion(utilisateur(), settings())).toBeUndefined();
  });

  it('refuses a built-in preset', () => {
    const natif = DEFAULT_SETTINGS.formatPresets[0];

    expect(blocksDeletion(natif, settings())).toBe('builtin');
  });

  it.each([
    ['defaultDate', { defaultDatePresetId: 'compact' }],
    ['aliasSource', { dailyNotesAliasPresetId: 'compact' }],
    ['aliasFallback', { dailyNotesAliasFallbackPresetId: 'compact' }],
  ])('refuses a preset still referenced as %s', (attendu, patch) => {
    expect(blocksDeletion(utilisateur(), settings(patch))).toBe(attendu);
  });
});
