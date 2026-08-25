import en from '@/i18n/locales/en.json';
import { lookupKey } from '../../helpers/translation-keys';

/**
 * Every English string the user reads is pinned here, byte for byte. The
 * published screenshots show an English picker and the user guide quotes
 * several of these strings verbatim, so no value drifts by accident.
 *
 * The right-hand side was the literal as it stood before the i18n move
 * (v0.1.4). `add-alias-aware-date-entry` moves the record forward: the picker's
 * labels go to sentence case, the three action commands gain a dialog ellipsis,
 * and the split alias sources replace "Original Text". It is a record, not a
 * preference: changing one of these values is a decision to retake the
 * screenshots and update the guide — which that change does.
 */
const PINNED_ENGLISH_VALUES: Record<string, string> = {
  // src/main.ts — fixed command names. The ellipse marks a dialog: all three
  // open the picker rather than inserting anything.
  'commands.insertText.name': 'Insert date as text…',
  'commands.insertDailyNote.name': 'Insert daily note link…',
  'commands.openDailyNote.name': 'Open daily note…',

  // src/main.ts — preset-derived command names, prefix and separator
  'commands.presetCommand': '{{prefix}}: {{name}}',
  'commands.prefix.date': 'Insert date',
  'commands.prefix.time': 'Insert time',
  'commands.prefix.datetime': 'Insert datetime',

  // src/ui/date-picker/action-selector.ts — tab labels (icons stay in the code)
  'picker.tabs.insertText': 'Insert as text',
  'picker.tabs.insertDailyNote': 'Link to daily note',
  'picker.tabs.openDailyNote': 'Open daily note',

  // src/ui/date-picker/nlp-input.ts
  'picker.nlp.placeholder': 'tomorrow, next monday, 3 days ago',
  'picker.nlp.previewError': 'Could not parse date',

  // src/ui/unified-date-picker-modal.ts
  'picker.today': 'Today',
  'picker.openPreview': 'Open: {{date}}',

  // src/ui/date-picker/format-selector.ts — the single "Original Text" entry
  // split into two named sources in add-alias-aware-date-entry; the record
  // moves forward with it, in the sentence case the change settled on.
  'picker.selectedText': 'Selected text',
  'picker.typedText': 'Typed text',
  'picker.alias.label': 'Alias',
  'picker.alias.placeholder': 'Alias for the link',

  // src/ui/date-picker-suggest.ts — the inline popup's own entries
  'suggest.dailyNoteLink': 'Daily note link',
  'suggest.openPicker': 'Open the picker…',

  // src/ui/settings/sections/presets-list-section.ts — the per-preset toggle
  'settings.presets.showInSuggest': 'Show in the inline suggestion popup',

  // Notices
  'errors.selectFailed': 'Failed to select date',
  'errors.createDailyNoteFailed': 'Failed to create daily note',
  'errors.openDailyNoteFailed': 'Failed to open daily note',
  'errors.dailyNoteMissing':
    'Daily note does not exist: {{date}}. Enable "Auto-create" in settings to create automatically.',
  'errors.invalidFormat': '[Invalid format: {{format}}]',
  'notices.settingsMigrated':
    'Date Helpers: Settings updated to Phase 6. Please reload the plugin (Cmd/Ctrl+R) to see updated commands.',

  // src/ui/settings/sections/presets-list-section.ts — one row of the preset list
  'settings.presets.exampleRow': '{{desc}} → Example: {{example}}',

  // src/settings/defaults.ts — built-in preset names
  'settings.presets.formats.iso8601.name': 'ISO 8601',
  'settings.presets.formats.locale-short.name': 'Locale short',
  'settings.presets.formats.locale-long.name': 'Locale long',
  'settings.presets.formats.date-verbose.name': 'Verbose',
  'settings.presets.formats.date-short-month.name': 'Short month',
  'settings.presets.formats.time-24h.name': '24-hour',
  'settings.presets.formats.time-12h.name': '12-hour',
  'settings.presets.formats.time-24h-seconds.name': '24-hour with seconds',
  'settings.presets.formats.datetime-iso.name': 'ISO datetime',
  'settings.presets.formats.datetime-readable.name': 'Readable',
  'settings.presets.formats.datetime-standard.name': 'Standard',
};

describe('English values are pinned byte for byte', () => {
  it.each(Object.entries(PINNED_ENGLISH_VALUES))('%s', (key, literal) => {
    expect(lookupKey(en, key)).toBe(literal);
  });
});
