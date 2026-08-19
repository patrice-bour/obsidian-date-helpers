import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings, DEFAULT_SETTINGS_BASE } from '@/types/settings';

/**
 * Default format presets provided with the plugin.
 * These cover common date, time, and datetime formatting needs.
 *
 * They carry no name and no description: both are resolved from the id through
 * `settings.presets.formats.<id>.*` at display time. Storing a label here would
 * persist it into `data.json` on first save, and no later translation would
 * reach an existing install.
 */
export const DEFAULT_FORMAT_PRESETS: FormatPreset[] = [
  // Date formats
  {
    id: 'iso8601',
    format: 'yyyy-MM-dd',
    type: 'date',
    builtin: true,
    // Two formats start pinned to the inline popup: a list that opens empty
    // teaches the user nothing about what the popup is for.
    showInSuggest: true,
  },
  {
    id: 'locale-short',
    format: 'D',
    type: 'date',
    builtin: true,
  },
  {
    id: 'locale-long',
    format: 'DDD',
    type: 'date',
    builtin: true,
    showInSuggest: true,
  },
  {
    id: 'date-verbose',
    format: 'EEEE d MMMM yyyy',
    type: 'date',
    builtin: true,
  },
  {
    id: 'date-short-month',
    format: 'LOCALE_MED',
    type: 'date',
    builtin: true,
  },

  // Time formats
  {
    id: 'time-24h',
    format: 'HH:mm',
    type: 'time',
    builtin: true,
  },
  {
    id: 'time-12h',
    format: 'h:mm a',
    type: 'time',
    builtin: true,
  },
  {
    id: 'time-24h-seconds',
    format: 'HH:mm:ss',
    type: 'time',
    builtin: true,
  },

  // DateTime formats
  {
    id: 'datetime-iso',
    format: "yyyy-MM-dd'T'HH:mm:ss",
    type: 'datetime',
    builtin: true,
  },
  {
    id: 'datetime-readable',
    format: 'LOCALE_MED_TIME',
    type: 'datetime',
    builtin: true,
  },
  {
    id: 'datetime-standard',
    format: 'yyyy-MM-dd HH:mm:ss',
    type: 'datetime',
    builtin: true,
  },
];

/**
 * Complete default settings with format presets
 */
export const DEFAULT_SETTINGS: DateHelpersSettings = {
  ...DEFAULT_SETTINGS_BASE,
  formatPresets: DEFAULT_FORMAT_PRESETS,
};
