import en from '@/i18n/locales/en.json';
import { lookupKey } from '../../helpers/translation-keys';

/**
 * Every English literal moved into i18n must stay byte-identical to the text it
 * replaced. The published screenshots show an already-English picker and the
 * user guide quotes several of these strings verbatim, so an English user must
 * see no difference at all.
 *
 * The right-hand side is the literal as it stood in the source before the move
 * (v0.1.4). It is a record, not a preference: changing one of these values is a
 * decision to retake the screenshots and update the guide.
 */
const LITERALS_BEFORE_THE_MOVE: Record<string, string> = {
  // src/main.ts — fixed command names
  'commands.insertText.name': 'Insert date as text',
  'commands.insertDailyNote.name': 'Insert daily note link',
  'commands.openDailyNote.name': 'Open daily note',
  'commands.convertSelection.name': 'Convert selection to date',

  // src/main.ts — preset-derived command names, prefix and separator
  'commands.presetCommand': '{{prefix}}: {{name}}',
  'commands.prefix.date': 'Insert date',
  'commands.prefix.time': 'Insert time',
  'commands.prefix.datetime': 'Insert datetime',

  // src/ui/date-picker/action-selector.ts — tab labels (icons stay in the code)
  'picker.tabs.insertText': 'Insert as Text',
  'picker.tabs.insertDailyNote': 'Link to Daily Note',
  'picker.tabs.openDailyNote': 'Open Daily Note',

  // src/ui/date-picker/nlp-input.ts
  'picker.nlp.name': 'Natural language',
  'picker.nlp.desc': 'For example: tomorrow, next monday, 3 days ago',
  'picker.nlp.placeholder': 'Tomorrow',
  'picker.nlp.previewEmpty': 'Enter a date expression to see preview',
  'picker.nlp.previewError': 'Could not parse date',

  // src/ui/unified-date-picker-modal.ts
  'picker.today': 'Today',
  'picker.openPreview': 'Open: {{date}}',

  // src/ui/date-picker/format-selector.ts
  'picker.originalText': 'Original Text',
  'picker.originalTextWith': 'Original Text ({{text}})',

  // Notices
  'errors.selectFailed': 'Failed to select date',
  'errors.createDailyNoteFailed': 'Failed to create daily note',
  'errors.openDailyNoteFailed': 'Failed to open daily note',
  'errors.dailyNoteMissing':
    'Daily note does not exist: {{date}}. Enable "Auto-create" in settings to create automatically.',
  'errors.parseFailed': 'Could not parse date from: {{text}}',
  'errors.invalidFormat': '[Invalid format: {{format}}]',
  'notices.parsed': 'Parsed: {{text}} → {{date}}',
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

describe('English values are byte-identical to the literals they replaced', () => {
  it.each(Object.entries(LITERALS_BEFORE_THE_MOVE))('%s', (key, literal) => {
    expect(lookupKey(en, key)).toBe(literal);
  });
});
