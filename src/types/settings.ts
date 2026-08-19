import { FormatPreset } from './format-preset';
import { SELECTED_TEXT_SOURCE } from './alias-source';
import { VALID_TRIGGER_MODES, WeekStart } from '@/utils/constants';

/**
 * What a trigger opens.
 *
 * - `picker` — the modal date picker, on the keystroke that completes the
 *   sequence;
 * - `inline` — the suggestion popup, capturing what is typed after the
 *   sequence until the user validates or dismisses.
 */
export type TriggerMode = (typeof VALID_TRIGGER_MODES)[number];

/**
 * A trigger: the sequence to type, and what it opens.
 *
 * Length used to decide the mode on its own. It no longer does — the two are
 * independent, and stored settings are migrated by the old rule so that no
 * existing trigger changes behaviour.
 */
export interface TriggerConfig {
  sequence: string;
  mode: TriggerMode;
}

/**
 * Is this a mode the plugin knows how to open?
 *
 * Stored data, a dialog's `<select>` and a caller's argument all reach the same
 * two writers, so the check is worth naming rather than repeating its cast.
 */
export function isTriggerMode(value: unknown): value is TriggerMode {
  return (VALID_TRIGGER_MODES as readonly unknown[]).includes(value);
}

/**
 * Plugin settings interface
 */
export interface DateHelpersSettings {
  /**
   * Locale for date display and parsing
   * @default 'auto' (inherit from Obsidian)
   */
  locale: string;

  /**
   * First day of week (0 = Sunday, 1 = Monday, 6 = Saturday)
   * @default 1 (Monday)
   */
  weekStart: WeekStart;

  /**
   * Configured triggers: each a sequence to type and the surface it opens.
   * Length decides nothing — the mode is stored beside the sequence.
   * @default [{ sequence: '@@', mode: 'picker' }, { sequence: '@', mode: 'inline' }]
   */
  triggerCharacters: TriggerConfig[];

  /**
   * Enable natural language parsing
   * @default true
   */
  enableNLP: boolean;

  /**
   * NLP parsing mode (strict = fewer false positives, casual = more permissive)
   * @default false (casual mode)
   */
  nlpStrictMode: boolean;

  /**
   * Enable date picker UI
   * @default true
   */
  enableDatePicker: boolean;

  // Phase 1: Format presets
  /**
   * Available format presets for date/time insertion
   */
  formatPresets: FormatPreset[];

  /**
   * ID of the default date preset
   * @default 'iso8601'
   */
  defaultDatePresetId: string;

  /**
   * Auto-detect language per expression (allows mixing languages)
   * @default true
   */
  nlpAutoDetectLanguage: boolean;

  // Phase 5: Daily Notes Integration
  // Phase 6: Exclusive modes (simplified from Phase 5)
  // Phase 7.2: Contextual action selection (replaced mode with lastUsedAction)

  /**
   * Last used action in date picker (remembered for UX continuity)
   * - 'insert-text': Insert formatted plain text
   * - 'insert-daily-note': Insert wikilink to Daily Note
   * - 'open-daily-note': Navigate to Daily Note (no text insertion)
   * @default 'insert-text'
   */
  lastUsedAction?: 'insert-text' | 'insert-daily-note' | 'open-daily-note';

  /**
   * Preset ID used for wikilink aliases when text is available (Daily Notes actions)
   * Can be a text alias source ('selected-text' or 'typed-text') to use that
   * text as the alias; see `@/types/alias-source`
   * @default 'selected-text'
   */
  dailyNotesAliasPresetId: string;

  /**
   * Preset ID used for wikilink aliases when no text is available (fallback)
   * Cannot be a text alias source - only format presets are valid
   * @default 'locale-long'
   */
  dailyNotesAliasFallbackPresetId: string;

  /**
   * Auto-create daily note if it doesn't exist (Daily Notes actions)
   * Uses configured template if available
   * @default false
   */
  dailyNotesCreateIfMissing: boolean;
}

/**
 * Default settings (without format presets - those are imported separately)
 */
export const DEFAULT_SETTINGS_BASE = {
  locale: 'auto',
  weekStart: 1 as WeekStart,
  // `@@` opens the picker; the single `@` opens the inline suggestion popup.
  // Both are triggers like any other — a user can remove, rename or reassign
  // either, mode included.
  triggerCharacters: [
    { sequence: '@@', mode: 'picker' },
    { sequence: '@', mode: 'inline' },
  ] satisfies TriggerConfig[],
  enableNLP: true,
  nlpStrictMode: false,
  enableDatePicker: true,
  defaultDatePresetId: 'iso8601',
  nlpAutoDetectLanguage: true,

  // Phase 7.2: Contextual action selection
  // lastUsedAction is optional - no default needed
  // Format presets loaded from defaultDatePresetId (text) and dailyNotesAliasPresetId (DN)
  dailyNotesAliasPresetId: SELECTED_TEXT_SOURCE, // Use the editor selection as alias
  dailyNotesAliasFallbackPresetId: 'locale-long', // "12 novembre 2025" when no text selected
  dailyNotesCreateIfMissing: false, // User decides (ask first time)
};
