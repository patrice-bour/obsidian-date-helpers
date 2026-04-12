import { FormatPreset } from './format-preset';

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
   * Default date format for insertions (Phase 0 - kept for backward compatibility)
   * @default 'yyyy-MM-dd'
   * @deprecated Use defaultDatePresetId instead
   */
  defaultFormat: string;

  /**
   * First day of week (0 = Sunday, 1 = Monday, 6 = Saturday)
   * @default 1 (Monday)
   */
  weekStart: 0 | 1 | 6;

  /**
   * Trigger characters for date picker
   * @default ['@@']
   */
  triggerCharacters: string[];

  /**
   * Enable natural language parsing
   * @default true
   */
  enableNLP: boolean;

  /**
   * Supported languages for NLP parsing
   * @default ['en'] (auto-detected from locale)
   */
  nlpLanguages: string[];

  /**
   * NLP parsing mode (strict = fewer false positives, casual = more permissive)
   * @default false (casual mode)
   */
  nlpStrictMode: boolean;

  /**
   * Default format preset for NLP-parsed dates
   * @default 'iso8601'
   */
  nlpDefaultPresetId: string;

  /**
   * Show warning notification when NLP parsing fails
   * (original text is always preserved)
   * @default false
   */
  showParsingWarning: boolean;

  /**
   * Integrate NLP with date picker trigger characters
   * @default true
   */
  nlpWithDatePicker: boolean;

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
   * ID of the default time preset
   * @default 'time-24h'
   */
  defaultTimePresetId: string;

  /**
   * ID of the default datetime preset
   * @default 'datetime-standard'
   */
  defaultDateTimePresetId: string;

  // Phase 2: Date picker configuration
  /**
   * Default preset to use in date picker modal
   * @default 'iso8601'
   */
  pickerDefaultPresetId: string;

  /**
   * Show format selector in date picker modal
   * @default true
   */
  pickerShowFormatSelector: boolean;

  // Phase 4: Advanced NLP settings

  /**
   * Auto-detect language per expression (allows mixing languages)
   * @default true
   */
  nlpAutoDetectLanguage: boolean;

  /**
   * Use datetime preset when time is present in expression
   * @default true
   */
  nlpUseDateTimePreset: boolean;

  /**
   * Default preset ID for datetime expressions (with time)
   * Falls back to defaultDateTimePresetId if not set
   */
  nlpDefaultDateTimePresetId?: string;

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
   * Preset ID used for wikilink aliases when text is selected (Daily Notes actions)
   * Can be 'original-text' to preserve the selected text as alias
   * @default 'original-text'
   */
  dailyNotesAliasPresetId: string;

  /**
   * Preset ID used for wikilink aliases when no text is selected (fallback)
   * Cannot be 'original-text' - only format presets are valid
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
  defaultFormat: 'yyyy-MM-dd',
  weekStart: 1 as 0 | 1 | 6,
  triggerCharacters: ['@@'],
  enableNLP: true,
  nlpLanguages: ['en'],
  nlpStrictMode: false,
  nlpDefaultPresetId: 'iso8601',
  showParsingWarning: false,
  nlpWithDatePicker: false, // Disabled by default - workflow issue (see Phase 3 notes)
  enableDatePicker: true,
  defaultDatePresetId: 'iso8601',
  defaultTimePresetId: 'time-24h',
  defaultDateTimePresetId: 'datetime-standard',
  pickerDefaultPresetId: 'iso8601',
  pickerShowFormatSelector: true,

  // Phase 4: Advanced NLP
  nlpAutoDetectLanguage: true,
  nlpUseDateTimePreset: true,

  // Phase 7.2: Contextual action selection
  // lastUsedAction is optional - no default needed
  // Format presets loaded from defaultDatePresetId (text) and dailyNotesAliasPresetId (DN)
  dailyNotesAliasPresetId: 'original-text', // Preserve selected text as alias
  dailyNotesAliasFallbackPresetId: 'locale-long', // "12 novembre 2025" when no text selected
  dailyNotesCreateIfMissing: false, // User decides (ask first time)
};
