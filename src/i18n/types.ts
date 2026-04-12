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
  // Settings - General
  | 'settings.title'
  | 'settings.description'
  | 'settings.sections.general'
  | 'settings.sections.features'
  | 'settings.sections.dailyNotes'
  | 'settings.sections.text'
  | 'settings.sections.triggers'
  | 'settings.sections.presets'
  | 'settings.locale.name'
  | 'settings.locale.desc'
  | 'settings.locale.placeholder'
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
  | 'settings.dailyNotes.aliasFormat.name'
  | 'settings.dailyNotes.aliasFormat.desc'
  | 'settings.dailyNotes.aliasFormat.withText'
  | 'settings.dailyNotes.aliasFormat.withoutText'
  | 'settings.dailyNotes.aliasFormat.originalText'
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
  | 'settings.triggers.add'
  | 'settings.triggers.remove'
  | 'settings.triggers.validation.empty'
  | 'settings.triggers.validation.tooLong'
  | 'settings.triggers.validation.duplicate'
  | 'settings.triggers.validation.minRequired'
  // Settings - Presets
  | 'settings.presets.description'
  | 'settings.presets.dateFormats'
  | 'settings.presets.timeFormats'
  | 'settings.presets.dateTimeFormats'
  | 'settings.presets.example'
  // Settings - Presets - Formats (for internationalized preset names)
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
  // Errors
  | 'errors.invalidDate'
  // Picker
  | 'picker.tabs.insertText'
  | 'picker.tabs.insertDailyNote'
  | 'picker.tabs.openDailyNote'
  | 'picker.nlpPlaceholder'
  | 'picker.format'
  | 'picker.preview'
  | 'picker.confirm'
  | 'picker.cancel';

/**
 * Translation parameter types (for type-safe interpolation)
 */
export interface TranslationParams {
  'errors.invalidDate': { date: string };
}
