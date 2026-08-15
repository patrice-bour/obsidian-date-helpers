import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { isValidLocale, normalizeLocale } from './locale';
import { VALID_PRESET_TYPES, VALID_WEEK_STARTS } from './constants';
import { FormatPreset } from '@/types/format-preset';
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
 * Validate and sanitize settings
 * @param settings - Partial or complete settings object
 * @returns Validated settings with defaults applied
 */
export function validateSettings(settings: Partial<DateHelpersSettings>): DateHelpersSettings {
  // Migration: nlpFallbackBehavior → showParsingWarning
  const rawSettings = settings as Record<string, unknown>;
  if ('nlpFallbackBehavior' in rawSettings && !('showParsingWarning' in rawSettings)) {
    rawSettings.showParsingWarning = rawSettings.nlpFallbackBehavior === 'error';
    delete rawSettings.nlpFallbackBehavior;
  }

  const validated: DateHelpersSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
  };

  // Validate weekStart (must be 0, 1, or 6)
  if (!(VALID_WEEK_STARTS as readonly number[]).includes(validated.weekStart)) {
    console.warn(`Invalid weekStart value: ${validated.weekStart}, resetting to default`);
    validated.weekStart = DEFAULT_SETTINGS.weekStart;
  }

  // Validate triggerCharacters is an array
  if (!Array.isArray(validated.triggerCharacters)) {
    console.warn('triggerCharacters must be an array, resetting to default');
    validated.triggerCharacters = DEFAULT_SETTINGS.triggerCharacters;
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

  // Validate showParsingWarning boolean field
  if (typeof validated.showParsingWarning !== 'boolean') {
    console.warn('showParsingWarning must be a boolean, resetting to default');
    validated.showParsingWarning = DEFAULT_SETTINGS.showParsingWarning;
  }

  // Phase 4: Validate advanced NLP boolean fields
  if (typeof validated.nlpAutoDetectLanguage !== 'boolean') {
    console.warn('nlpAutoDetectLanguage must be a boolean, resetting to default');
    validated.nlpAutoDetectLanguage = DEFAULT_SETTINGS.nlpAutoDetectLanguage;
  }

  if (typeof validated.nlpUseDateTimePreset !== 'boolean') {
    console.warn('nlpUseDateTimePreset must be a boolean, resetting to default');
    validated.nlpUseDateTimePreset = DEFAULT_SETTINGS.nlpUseDateTimePreset;
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
    validated.formatPresets = [...DEFAULT_FORMAT_PRESETS];
  } else {
    // Validate and deduplicate preset IDs
    const seenIds = new Set<string>();
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
          const newId = `${preset.id}-${Date.now()}`;
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
      validated.formatPresets = [...DEFAULT_FORMAT_PRESETS];
    }

    // Update builtin presets to latest version and add missing ones (for plugin updates)
    const existingPresetsMap = new Map(validated.formatPresets.map(p => [p.id, p]));
    const updatedPresets: FormatPreset[] = [];

    // Process all default builtin presets
    DEFAULT_FORMAT_PRESETS.forEach(defaultPreset => {
      if (!defaultPreset.builtin) return;

      const existing = existingPresetsMap.get(defaultPreset.id);
      if (existing) {
        // Check if builtin preset needs updating
        if (existing.format !== defaultPreset.format) {
          // Update to latest version
          updatedPresets.push({ ...defaultPreset });
        } else {
          // Keep existing, minus the labels 0.1.4 and earlier wrote into
          // data.json: a built-in preset is labelled from its id, and a stored
          // English name would outlive every later translation.
          updatedPresets.push(stripBuiltinLabels(existing));
        }
        existingPresetsMap.delete(defaultPreset.id);
      } else {
        // Add missing builtin preset
        updatedPresets.push({ ...defaultPreset });
      }
    });

    // Keep user's custom presets (non-builtin or not in defaults)
    existingPresetsMap.forEach(preset => {
      updatedPresets.push(preset);
    });

    validated.formatPresets = updatedPresets;

    // No logging for preset updates — handled silently
  }

  // Validate default preset IDs exist
  const presetIds = new Set(validated.formatPresets.map(p => p.id));

  if (!validated.defaultDatePresetId || !presetIds.has(validated.defaultDatePresetId)) {
    console.warn(
      `Invalid defaultDatePresetId: ${validated.defaultDatePresetId}, resetting to default`
    );
    validated.defaultDatePresetId = DEFAULT_SETTINGS.defaultDatePresetId;
  }

  if (!validated.defaultTimePresetId || !presetIds.has(validated.defaultTimePresetId)) {
    console.warn(
      `Invalid defaultTimePresetId: ${validated.defaultTimePresetId}, resetting to default`
    );
    validated.defaultTimePresetId = DEFAULT_SETTINGS.defaultTimePresetId;
  }

  if (!validated.defaultDateTimePresetId || !presetIds.has(validated.defaultDateTimePresetId)) {
    console.warn(
      `Invalid defaultDateTimePresetId: ${validated.defaultDateTimePresetId}, resetting to default`
    );
    validated.defaultDateTimePresetId = DEFAULT_SETTINGS.defaultDateTimePresetId;
  }

  // Special case: migrate from old 'datetime-iso' default to new 'datetime-standard' default
  // This ensures existing users get the better default after plugin update
  if (
    validated.defaultDateTimePresetId === 'datetime-iso' &&
    presetIds.has('datetime-standard') &&
    DEFAULT_SETTINGS.defaultDateTimePresetId === 'datetime-standard'
  ) {
    validated.defaultDateTimePresetId = 'datetime-standard';
  }

  // Phase 4: Validate optional nlpDefaultDateTimePresetId
  if (
    validated.nlpDefaultDateTimePresetId !== undefined &&
    !presetIds.has(validated.nlpDefaultDateTimePresetId)
  ) {
    console.warn(
      `Invalid nlpDefaultDateTimePresetId: ${validated.nlpDefaultDateTimePresetId}, clearing`
    );
    validated.nlpDefaultDateTimePresetId = undefined;
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

  // Validate dailyNotesAliasPresetId (can be 'original-text' or a valid preset ID)
  if (validated.dailyNotesAliasPresetId) {
    const isOriginalText = validated.dailyNotesAliasPresetId === 'original-text';
    const isValidPreset = presetIds.has(validated.dailyNotesAliasPresetId);
    if (!isOriginalText && !isValidPreset) {
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

  // Validate dailyNotesAliasFallbackPresetId (cannot be 'original-text', must be a valid preset)
  if (validated.dailyNotesAliasFallbackPresetId === 'original-text') {
    console.warn('dailyNotesAliasFallbackPresetId cannot be "original-text", resetting to default');
    validated.dailyNotesAliasFallbackPresetId = DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId;
  } else if (!presetIds.has(validated.dailyNotesAliasFallbackPresetId)) {
    console.warn(
      `Invalid dailyNotesAliasFallbackPresetId: ${validated.dailyNotesAliasFallbackPresetId}, resetting to default`
    );
    validated.dailyNotesAliasFallbackPresetId = DEFAULT_SETTINGS.dailyNotesAliasFallbackPresetId;
  }

  return validated;
}
