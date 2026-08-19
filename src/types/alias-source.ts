/**
 * Text alias sources — the pseudo-presets that put user text, rather than a
 * formatted date, in a wikilink alias.
 *
 * They live alongside format preset ids in `dailyNotesAliasPresetId` and in the
 * picker's format selector, but they back no `FormatPreset`: each names a place
 * the text comes from (the editor selection, or the picker's NLP field).
 */

/** The editor selection carried into the picker */
export const SELECTED_TEXT_SOURCE = 'selected-text';

/** The text typed in the picker's NLP field */
export const TYPED_TEXT_SOURCE = 'typed-text';

/**
 * The single source id used before the split. Stored settings may still hold
 * it; `migrateSettings` rewrites it to {@link SELECTED_TEXT_SOURCE}.
 */
export const LEGACY_TEXT_SOURCE = 'original-text';

export const ALIAS_SOURCE_IDS = [SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE] as const;

export type AliasSourceId = (typeof ALIAS_SOURCE_IDS)[number];

/** Is this id a text alias source rather than a format preset id? */
export function isAliasSourceId(id: string | undefined | null): id is AliasSourceId {
  return id === SELECTED_TEXT_SOURCE || id === TYPED_TEXT_SOURCE;
}
