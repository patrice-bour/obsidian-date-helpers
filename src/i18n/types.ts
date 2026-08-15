/**
 * Translation key type - all available translation keys
 * Keep in sync with en.json structure
 */
export type TranslationKey =
  // Commands
  | 'commands.insertText.name'
  | 'commands.insertDailyNote.name'
  | 'commands.openDailyNote.name'
  | 'commands.convertSelection.name'
  | 'commands.presetCommand'
  | 'commands.prefix.date'
  | 'commands.prefix.time'
  | 'commands.prefix.datetime'
  // Settings - General
  | 'settings.sections.general'
  | 'settings.sections.features'
  | 'settings.sections.dailyNotes'
  | 'settings.sections.text'
  | 'settings.sections.triggers'
  | 'settings.sections.presets'
  | 'settings.locale.name'
  | 'settings.locale.desc'
  | 'settings.locale.placeholder'
  | 'settings.locale.invalid'
  | 'settings.saveFailed'
  | 'settings.weekStart.name'
  | 'settings.weekStart.desc'
  | 'settings.weekStart.sunday'
  | 'settings.weekStart.monday'
  | 'settings.weekStart.saturday'
  // Settings - Features
  | 'settings.features.enableDatePicker.name'
  | 'settings.features.enableDatePicker.desc'
  | 'settings.features.enableNLP.name'
  | 'settings.features.enableNLP.desc'
  | 'settings.features.nlpAutoDetect.name'
  | 'settings.features.nlpAutoDetect.desc'
  | 'settings.features.nlpStrictMode.name'
  | 'settings.features.nlpStrictMode.desc'
  | 'settings.features.nlpStrictMode.casual'
  | 'settings.features.nlpStrictMode.strict'
  | 'settings.features.nlpShowWarning.name'
  | 'settings.features.nlpShowWarning.desc'
  // Settings - Daily Notes
  | 'settings.dailyNotes.description'
  | 'settings.dailyNotes.aliasFormat.desc'
  | 'settings.dailyNotes.aliasFormat.withText'
  | 'settings.dailyNotes.aliasFormat.withoutText'
  | 'settings.dailyNotes.createIfMissing.name'
  | 'settings.dailyNotes.createIfMissing.desc'
  // Settings - Text
  | 'settings.text.description'
  | 'settings.text.defaultDateFormat.name'
  | 'settings.text.defaultDateFormat.desc'
  | 'settings.text.defaultTimeFormat.name'
  | 'settings.text.defaultTimeFormat.desc'
  | 'settings.text.defaultDateTimeFormat.name'
  | 'settings.text.defaultDateTimeFormat.desc'
  | 'settings.text.noPresetsAvailable'
  // Settings - Triggers
  | 'settings.triggers.description'
  | 'settings.triggers.characters.name'
  | 'settings.triggers.characters.desc'
  | 'settings.triggers.characters.placeholder'
  | 'settings.triggers.addTitle'
  | 'settings.triggers.add'
  | 'settings.triggers.validation.empty'
  | 'settings.triggers.validation.tooLong'
  | 'settings.triggers.validation.duplicate'
  | 'settings.triggers.validation.minRequired'
  // Settings - Presets
  | 'settings.presets.description'
  | 'settings.presets.dateFormats'
  | 'settings.presets.timeFormats'
  | 'settings.presets.dateTimeFormats'
  | 'settings.presets.exampleRow'
  // Settings - Presets - Formats (built-in presets are labelled by id, never by
  // a stored name, so they follow the locale wherever they are displayed)
  | 'settings.presets.formats.iso8601.name'
  | 'settings.presets.formats.iso8601.desc'
  | 'settings.presets.formats.locale-short.name'
  | 'settings.presets.formats.locale-short.desc'
  | 'settings.presets.formats.locale-long.name'
  | 'settings.presets.formats.locale-long.desc'
  | 'settings.presets.formats.date-verbose.name'
  | 'settings.presets.formats.date-verbose.desc'
  | 'settings.presets.formats.date-short-month.name'
  | 'settings.presets.formats.date-short-month.desc'
  | 'settings.presets.formats.time-24h.name'
  | 'settings.presets.formats.time-24h.desc'
  | 'settings.presets.formats.time-12h.name'
  | 'settings.presets.formats.time-12h.desc'
  | 'settings.presets.formats.time-24h-seconds.name'
  | 'settings.presets.formats.time-24h-seconds.desc'
  | 'settings.presets.formats.datetime-iso.name'
  | 'settings.presets.formats.datetime-iso.desc'
  | 'settings.presets.formats.datetime-readable.name'
  | 'settings.presets.formats.datetime-readable.desc'
  | 'settings.presets.formats.datetime-standard.name'
  | 'settings.presets.formats.datetime-standard.desc'
  // Errors (all surfaced to the user as a Notice or as displayed text)
  | 'errors.parseFailed'
  | 'errors.selectFailed'
  | 'errors.createDailyNoteFailed'
  | 'errors.openDailyNoteFailed'
  | 'errors.dailyNoteMissing'
  | 'errors.invalidFormat'
  // Notices
  | 'notices.parsed'
  | 'notices.settingsMigrated'
  // Picker
  | 'picker.tabs.insertText'
  | 'picker.tabs.insertDailyNote'
  | 'picker.tabs.openDailyNote'
  | 'picker.nlp.name'
  | 'picker.nlp.desc'
  | 'picker.nlp.placeholder'
  | 'picker.nlp.previewEmpty'
  | 'picker.nlp.previewError'
  | 'picker.today'
  | 'picker.openPreview'
  | 'picker.originalText'
  | 'picker.originalTextWith'
  | 'picker.cancel';

/**
 * The plugin's translate function, as sections, pickers and label helpers
 * receive it. Mirrors `I18nService.t`, so a component can be handed the lookup
 * without the service — and a test can hand it a stub.
 */
export type Translate = <K extends TranslationKey>(
  key: K,
  params?: K extends keyof TranslationParams ? TranslationParams[K] : never
) => string;

/**
 * Translation parameter types (for type-safe interpolation)
 */
export interface TranslationParams {
  'settings.presets.exampleRow': { desc: string; example: string };
  'commands.presetCommand': { prefix: string; name: string };
  'errors.parseFailed': { text: string };
  'errors.dailyNoteMissing': { date: string };
  'errors.invalidFormat': { format: string };
  'notices.parsed': { text: string; date: string };
  'picker.openPreview': { date: string };
  'picker.originalTextWith': { text: string };
}
