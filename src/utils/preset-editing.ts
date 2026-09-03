import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { RefusalReason, readFormat } from '@/services/format-syntax';

/** What the user typed into the preset editor, before it is anything else. */
export interface PresetDraft {
  name: string;
  format: string;
  type: FormatPreset['type'];
}

/** Why a draft cannot be saved. A reason, not a sentence: the wording is i18n's. */
export type DraftProblem =
  | { field: 'name'; reason: 'empty' | 'duplicate' }
  | { field: 'format'; reason: RefusalReason; offender?: string };

/**
 * Read a draft, or say what stops it.
 *
 * The format comes back translated to the engine's syntax: what is validated
 * has to be what is stored. Why the two differ: `format-syntax.ts`.
 */
export function readDraft(
  draft: PresetDraft,
  existing: FormatPreset[],
  editingId?: string
): // `name` narrowed to a plain string: the reading guarantees it is there, and
  // the id is derived from it, so leaving it optional would make the caller
  // handle an absence this function has already ruled out.
  | { ok: true; preset: Omit<FormatPreset, 'id' | 'showInSuggest' | 'name'> & { name: string } }
  | { ok: false; problem: DraftProblem } {
  const name = draft.name.trim();
  if (name === '') return { ok: false, problem: { field: 'name', reason: 'empty' } };

  // Against every preset's DISPLAYED name would need the i18n service; against
  // the user's own is what a user can actually collide with, and the built-in
  // names are translated anyway — a French user's "Court" is an English user's
  // "Short", so a name that clashes in one locale is free in another.
  const clash = existing.some(
    preset => preset.id !== editingId && !preset.builtin && preset.name?.trim() === name
  );
  if (clash) return { ok: false, problem: { field: 'name', reason: 'duplicate' } };

  const lu = readFormat(draft.format);
  if (!lu.ok) {
    return { ok: false, problem: { field: 'format', reason: lu.reason, offender: lu.offender } };
  }

  return {
    ok: true,
    // No `showInSuggest`: it is not in the draft, and an edit that carried a
    // default for it would unpin a preset the user had pinned, in silence.
    preset: { name, format: lu.format, type: draft.type, builtin: false },
  };
}

/**
 * The mark on every id this function makes.
 *
 * Without it, a preset named "Compact" takes the id `compact` — and the day a
 * release ships a built-in by that id, the validator's merge folds the user's
 * entry into the shipped one and replaces its format, keeping its name, without
 * a word. No shipped id may carry this prefix.
 */
export const USER_PRESET_PREFIX = 'user-';

/**
 * An id for a preset named `name`, unique among `existing`.
 *
 * From the name rather than a counter, because the id is what a command is
 * registered under and what a user reads in `data.json` — `insert-date-user-compact`
 * says something, `insert-date-user-3` says nothing. A name that reduces to
 * nothing usable, or to something already taken, falls back to a suffix.
 */
export function idForName(name: string, existing: FormatPreset[]): string {
  const taken = new Set(existing.map(preset => preset.id));
  const base =
    USER_PRESET_PREFIX +
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  if (base === USER_PRESET_PREFIX) return uniqueFrom(`${USER_PRESET_PREFIX}preset`, taken);
  return uniqueFrom(base, taken);
}

function uniqueFrom(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Why a preset may not be deleted, or `undefined` when it may. */
export type DeletionBlock = 'builtin' | 'defaultDate' | 'aliasSource' | 'aliasFallback';

/**
 * Whether `preset` can be removed.
 *
 * Refused rather than silently reassigned: a preset serving as the default or
 * as an alias source is named in settings the user chose, and quietly moving
 * those to something else is a change nobody asked for and nobody is told
 * about.
 */
export function blocksDeletion(
  preset: FormatPreset,
  settings: DateHelpersSettings
): DeletionBlock | undefined {
  if (preset.builtin) return 'builtin';
  if (settings.defaultDatePresetId === preset.id) return 'defaultDate';
  if (settings.dailyNotesAliasPresetId === preset.id) return 'aliasSource';
  if (settings.dailyNotesAliasFallbackPresetId === preset.id) return 'aliasFallback';
  return undefined;
}
