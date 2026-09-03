import { DateHelpersSettings, TriggerConfig, isTriggerMode } from '@/types/settings';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { isValidLocale, normalizeLocale } from './locale';
import { VALID_PRESET_TYPES, VALID_WEEK_STARTS } from './constants';
import { FormatPreset } from '@/types/format-preset';
import { isAliasSourceId, LEGACY_TEXT_SOURCE } from '@/types/alias-source';
import enTranslations from '@/i18n/locales/en.json';

/**
 * Drop `name` and `description` from a stored built-in preset.
 *
 * Both are resolved from the preset id through i18n at display time. Keeping
 * the stored value would leave the obvious thing to read for anyone touching
 * this code later, and the next naive `preset.name` would silently bring the
 * English label back.
 *
 * The stored labels are only dropped when the locale files can put them back:
 * a preset whose translation entry is gone would otherwise degrade to its raw
 * id in the settings list, the dropdowns and the palette. And a stored preset
 * marked `builtin: false` keeps its labels whatever its id — those are the
 * user's words.
 */
function stripBuiltinLabels(preset: FormatPreset): FormatPreset {
  if (preset.builtin === false || !hasTranslatedLabel(preset.id)) return preset;

  const { name: _name, description: _description, ...withoutLabels } = preset;
  return withoutLabels;
}

/** Does `settings.presets.formats.<id>` exist in the reference locale? */
function hasTranslatedLabel(id: string): boolean {
  const entry = (enTranslations.settings.presets.formats as Record<string, unknown>)[id];
  return typeof entry === 'object' && entry !== null;
}

/**
 * A copy of a trigger list, entries included.
 *
 * Nothing here may hand back `DEFAULT_SETTINGS.triggerCharacters` or the
 * objects inside it. A trigger's mode is edited *in place* (`setTriggerMode`),
 * and the list is pushed to and spliced, so a shared reference would rewrite
 * the module's own defaults: the next reset would then restore the user's last
 * edit as if it were what the plugin ships. Copying is the only place that can
 * prevent it — the callers all mutate legitimately.
 */
function copyTriggers(triggers: readonly TriggerConfig[]): TriggerConfig[] {
  return triggers.map(trigger => ({ ...trigger }));
}

/**
 * A copy of the shipped presets, entries included.
 *
 * Same rule as `copyTriggers`, and for the same reason: a preset is edited *in
 * place* by the settings tab, which writes `stored.showInSuggest = value` on
 * the object it was handed (`presets-list-section.ts`). Returning
 * `DEFAULT_FORMAT_PRESETS` or the objects inside it would let one click on a
 * popup toggle rewrite the module's defaults for the rest of the session.
 */
function copyDefaultPresets(): FormatPreset[] {
  return DEFAULT_FORMAT_PRESETS.map(preset => ({ ...preset }));
}

/** Every id the plugin ships. Read by `freePresetId` and by the merge below. */
const SHIPPED_PRESET_IDS: ReadonlySet<string> = new Set(
  DEFAULT_FORMAT_PRESETS.map(preset => preset.id)
);

/**
 * A preset id that no other preset holds, derived from a duplicate one.
 *
 * The suffix used to be `Date.now()`. The loop below is synchronous over an
 * array in memory, so every entry sharing an id lands in the same millisecond
 * and gets the *same* replacement; the merge further down keys a `Map` by id,
 * so each collision after the first cost the user an entry — stored A/B/C came
 * back as A + C, and B was gone from `data.json` on the next save.
 *
 * Two sets are consulted, not one. `seen` holds the ids already handed out,
 * and `stored` holds every id `data.json` carries — including entries the loop
 * has not reached yet. Without `stored`, a repair would take an id a later
 * preset legitimately owns: `m`, `m`, `m-1` would rename the duplicate to
 * `m-1` and push the real `m-1` to `m-1-1`, so a `defaultDatePresetId` of
 * `m-1` would quietly point at a different preset. `Date.now()` never did
 * that, because no hand-written id looks like a timestamp — but `-1`, `-2` is
 * exactly the shape a hand-edited `data.json` holds.
 *
 * The shipped ids are the third set. None of the eleven ends in `-<digits>`
 * today, so a repair cannot reach one by accident — but that is a property of
 * the current defaults, not of this function. Shipping a preset id ending in
 * `-1` would otherwise let a repair hand a user's preset a shipped id, which
 * the merge below absorbs into the shipped slot and whose format it replaces.
 */
function freePresetId(id: string, seen: ReadonlySet<string>, stored: ReadonlySet<string>): string {
  let suffix = 1;
  let candidate = `${id}-${suffix}`;
  while (seen.has(candidate) || stored.has(candidate) || SHIPPED_PRESET_IDS.has(candidate)) {
    suffix += 1;
    candidate = `${id}-${suffix}`;
  }
  return candidate;
}

/**
 * Is this stored entry a usable trigger?
 *
 * Length is not checked here: `MAX_TRIGGER_LENGTH` is the add dialog's rule,
 * and lowering it must not silently delete triggers a user already relies on.
 */
function isValidTrigger(entry: unknown): entry is TriggerConfig {
  if (typeof entry !== 'object' || entry === null) return false;

  const { sequence, mode } = entry as Partial<TriggerConfig>;
  return typeof sequence === 'string' && sequence !== '' && isTriggerMode(mode);
}

/**
 * Validate and sanitize settings
 * @param settings - Partial or complete settings object
 * @returns Validated settings with defaults applied
 */
export function validateSettings(settings: Partial<DateHelpersSettings>): DateHelpersSettings {
  const validated: DateHelpersSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
  };

  // Validate weekStart (must be 0, 1, or 6)
  if (!(VALID_WEEK_STARTS as readonly number[]).includes(validated.weekStart)) {
    console.warn(`Invalid weekStart value: ${validated.weekStart}, resetting to default`);
    validated.weekStart = DEFAULT_SETTINGS.weekStart;
  }

  // Validate triggerCharacters entry by entry: a single malformed row must not
  // cost the user their other triggers. An empty result is the exception — the
  // picker registers no suggest at all on an empty list, so it would silently
  // stop working for good.
  if (!Array.isArray(validated.triggerCharacters)) {
    console.warn('triggerCharacters must be an array, resetting to default');
    validated.triggerCharacters = copyTriggers(DEFAULT_SETTINGS.triggerCharacters);
  } else {
    const stored = validated.triggerCharacters;
    // A sequence identifies a row everywhere downstream — `setTriggerMode` and
    // `removeTrigger` both resolve by `find`. Two rows sharing one would make
    // the second row's dropdown edit the first entry, in front of the user.
    // The add dialog already refuses a duplicate; this covers a hand-edited
    // `data.json` and the migration of a list that held one twice.
    const seen = new Set<string>();
    const kept = stored.filter((entry): entry is TriggerConfig => {
      if (!isValidTrigger(entry) || seen.has(entry.sequence)) return false;
      seen.add(entry.sequence);
      return true;
    });

    if (kept.length !== stored.length) {
      console.warn(`Dropped ${stored.length - kept.length} malformed or duplicate trigger(s)`);
    }
    // Losing every entry to validation is a data problem, and an empty list
    // silently disables the picker for good — main.ts registers no suggest on
    // it. A list the user emptied themselves is left as it is: that path is
    // theirs, and `enableDatePicker` is not the only way to reach it.
    //
    // `kept` is copied too: on a load with nothing stored, its entries *are*
    // the default objects, which `filter` alone would carry straight through.
    validated.triggerCharacters =
      kept.length === 0 && stored.length > 0
        ? copyTriggers(DEFAULT_SETTINGS.triggerCharacters)
        : copyTriggers(kept);
  }

  // Validate boolean fields
  if (typeof validated.enableNLP !== 'boolean') {
    console.warn('enableNLP must be a boolean, resetting to default');
    validated.enableNLP = DEFAULT_SETTINGS.enableNLP;
  }

  if (typeof validated.enableDatePicker !== 'boolean') {
    console.warn('enableDatePicker must be a boolean, resetting to default');
    validated.enableDatePicker = DEFAULT_SETTINGS.enableDatePicker;
  }

  if (typeof validated.nlpAutoDetectLanguage !== 'boolean') {
    console.warn('nlpAutoDetectLanguage must be a boolean, resetting to default');
    validated.nlpAutoDetectLanguage = DEFAULT_SETTINGS.nlpAutoDetectLanguage;
  }

  if (typeof validated.selectionNamesDate !== 'boolean') {
    console.warn('selectionNamesDate must be a boolean, resetting to default');
    validated.selectionNamesDate = DEFAULT_SETTINGS.selectionNamesDate;
  }

  // Validate locale is a string and has valid format
  if (typeof validated.locale !== 'string' || validated.locale.trim() === '') {
    console.warn('locale must be a non-empty string, resetting to default');
    validated.locale = DEFAULT_SETTINGS.locale;
  } else if (validated.locale !== 'auto') {
    // Normalize and validate locale format (unless it's 'auto')
    const normalized = normalizeLocale(validated.locale);
    if (!isValidLocale(normalized)) {
      console.warn(`Invalid locale format: ${validated.locale}, resetting to default`);
      validated.locale = DEFAULT_SETTINGS.locale;
    } else {
      validated.locale = normalized;
    }
  }

  // Phase 1: Validate format presets
  if (!Array.isArray(validated.formatPresets) || validated.formatPresets.length === 0) {
    console.warn('formatPresets must be a non-empty array, resetting to defaults');
    validated.formatPresets = copyDefaultPresets();
  } else {
    // Validate and deduplicate preset IDs
    const seenIds = new Set<string>();
    // Every id `data.json` carries, read before the loop starts: a repair must
    // not take an id an entry further down the array already owns.
    const storedIds = new Set<string>(
      validated.formatPresets
        .map((preset: FormatPreset) => preset?.id)
        .filter((id: unknown): id is string => typeof id === 'string')
    );
    validated.formatPresets = validated.formatPresets
      .map((preset: FormatPreset) => {
        // Validate preset structure. A name is not required: built-in presets
        // are labelled from their id through i18n, and a user-defined preset
        // without one falls back to its id.
        if (!preset.id || !preset.format || !preset.type) {
          console.warn('Invalid preset structure, skipping:', preset);
          return null;
        }

        // The type selects a translation key (`commands.prefix.<type>`) and a
        // settings section, so an unknown one surfaces as a raw key
        if (!(VALID_PRESET_TYPES as readonly string[]).includes(preset.type)) {
          console.warn(`Invalid preset type: ${preset.type}, skipping:`, preset);
          return null;
        }

        // Handle duplicate IDs by creating new object
        if (seenIds.has(preset.id)) {
          const newId = freePresetId(preset.id, seenIds, storedIds);
          console.warn(`Duplicate preset ID: ${preset.id}, regenerating as: ${newId}`);
          seenIds.add(newId);
          return { ...preset, id: newId }; // Create new object instead of mutating
        }

        seenIds.add(preset.id);
        return preset;
      })
      .filter((preset): preset is FormatPreset => preset !== null);

    // Ensure we have at least one preset
    if (validated.formatPresets.length === 0) {
      console.warn('No valid presets found, resetting to defaults');
      validated.formatPresets = copyDefaultPresets();
    }

    // The plugin owns one field on a preset it ships: the format string, which
    // it corrects from one version to the next. Everything else in the stored
    // entry is data the plugin never wrote — the type the preset is filed
    // under, its builtin flag, whether it shows in the popup — and a format
    // correction is no reason to take any of it back.
    //
    // Labels go through `stripBuiltinLabels` on every path, so a preset keeps
    // or loses them by what it says about itself, not by whether its format
    // happened to diverge. `builtin` is replaced whenever the stored entry does
    // not hold a boolean: the field is required by the type, phase 1 does not
    // check it, and the result is saved straight back to data.json — so a
    // missing or malformed flag would be persisted as it stands.
    //
    // A shipped preset is copied rather than handed on by reference, for the
    // reason `copyDefaultPresets` sets out. A user's own preset is not — it is the
    // caller's object, and nothing below mutates it.
    //
    // The user's presets come from the map, not from the array. Phase 1 now
    // guarantees every id is unique, so the two are equivalent; reading from
    // the map keeps the id the single key for the whole function.
    const storedById = new Map(validated.formatPresets.map(preset => [preset.id, preset]));

    validated.formatPresets = [
      ...DEFAULT_FORMAT_PRESETS.map(defaultPreset => {
        const existing = storedById.get(defaultPreset.id);
        return existing
          ? stripBuiltinLabels({
              ...existing,
              format: defaultPreset.format,
              builtin:
                typeof existing.builtin === 'boolean' ? existing.builtin : defaultPreset.builtin,
            })
          : { ...defaultPreset };
      }),
      // The user's own presets, in the order data.json holds them.
      ...[...storedById.values()].filter(preset => !SHIPPED_PRESET_IDS.has(preset.id)),
    ];

    // A data.json written before the inline popup existed carries no
    // `showInSuggest` on any preset. Left as is, every upgrading user gets a
    // popup holding nothing but its two fixed entries, while a fresh install
    // gets two pinned formats. Seed the defaults — but only when the flag is
    // absent everywhere, so "I unpinned them all" survives the next load.
    const pinningIsUnset = validated.formatPresets.every(
      preset => preset.showInSuggest === undefined
    );
    if (pinningIsUnset) {
      const pinnedByDefault = new Set(
        DEFAULT_FORMAT_PRESETS.filter(preset => preset.showInSuggest).map(preset => preset.id)
      );
      validated.formatPresets = validated.formatPresets.map(preset => ({
        ...preset,
        showInSuggest: pinnedByDefault.has(preset.id),
      }));
    }
  }

  // Validate default preset IDs exist
  const presetIds = new Set(validated.formatPresets.map(p => p.id));

  if (!validated.defaultDatePresetId || !presetIds.has(validated.defaultDatePresetId)) {
    console.warn(
      `Invalid defaultDatePresetId: ${validated.defaultDatePresetId}, resetting to default`
    );
    validated.defaultDatePresetId = DEFAULT_SETTINGS.defaultDatePresetId;
  }

  // Phase 7.2: Validate lastUsedAction (optional)
  if (validated.lastUsedAction !== undefined) {
    const validActions = ['insert-text', 'insert-daily-note', 'open-daily-note'];
    if (!validActions.includes(validated.lastUsedAction)) {
      console.warn(`Invalid lastUsedAction value: ${validated.lastUsedAction}, clearing`);
      validated.lastUsedAction = undefined;
    }
  }

  // Validate dailyNotesCreateIfMissing
  if (typeof validated.dailyNotesCreateIfMissing !== 'boolean') {
    console.warn('dailyNotesCreateIfMissing must be a boolean, resetting to default');
    validated.dailyNotesCreateIfMissing = DEFAULT_SETTINGS.dailyNotesCreateIfMissing;
  }

  // Validate dailyNotesAliasPresetId (can be a text alias source or a valid preset ID)
  if (validated.dailyNotesAliasPresetId) {
    const isTextSource = isAliasSourceId(validated.dailyNotesAliasPresetId);
    const isValidPreset = presetIds.has(validated.dailyNotesAliasPresetId);
    if (!isTextSource && !isValidPreset) {
      console.warn(
        `Invalid dailyNotesAliasPresetId: ${validated.dailyNotesAliasPresetId}, resetting to default`
      );
      validated.dailyNotesAliasPresetId = DEFAULT_SETTINGS.dailyNotesAliasPresetId;
    }
  }

  // Migration: if dailyNotesAliasFallbackPresetId is not set, default to 'locale-long'
  // This handles existing users who don't have the new setting
  if (!validated.dailyNotesAliasFallbackPresetId) {
    validated.dailyNotesAliasFallbackPresetId = DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId;
  }

  // Validate dailyNotesAliasFallbackPresetId (cannot be a text source, must be a valid preset).
  // The legacy 'original-text' is rejected here too: it is what the fallback holds when a
  // pre-split data.json escaped migrateSettings.
  if (
    isAliasSourceId(validated.dailyNotesAliasFallbackPresetId) ||
    validated.dailyNotesAliasFallbackPresetId === LEGACY_TEXT_SOURCE
  ) {
    console.warn(
      'dailyNotesAliasFallbackPresetId cannot be a text alias source, resetting to default'
    );
    validated.dailyNotesAliasFallbackPresetId = DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId;
  } else if (!presetIds.has(validated.dailyNotesAliasFallbackPresetId)) {
    console.warn(
      `Invalid dailyNotesAliasFallbackPresetId: ${validated.dailyNotesAliasFallbackPresetId}, resetting to default`
    );
    validated.dailyNotesAliasFallbackPresetId = DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId;
  }

  return validated;
}
