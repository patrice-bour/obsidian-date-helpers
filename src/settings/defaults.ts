import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings, DEFAULT_SETTINGS_BASE } from '@/types/settings';

/**
 * Default format presets provided with the plugin.
 * These cover common date, time, and datetime formatting needs.
 */
export const DEFAULT_FORMAT_PRESETS: FormatPreset[] = [
  // Date formats
  {
    id: 'iso8601',
    name: 'ISO 8601',
    format: 'yyyy-MM-dd',
    type: 'date',
    builtin: true,
    description: 'Standard ISO format (2025-11-02)',
  },
  {
    id: 'locale-short',
    name: 'Locale Short',
    format: 'D',
    type: 'date',
    builtin: true,
    description: 'Short date in your locale (11/2/2025 or 2/11/2025)',
  },
  {
    id: 'locale-long',
    name: 'Locale Long',
    format: 'DDD',
    type: 'date',
    builtin: true,
    description: 'Long date in your locale (November 2, 2025)',
  },
  {
    id: 'date-verbose',
    name: 'Verbose',
    format: 'EEEE d MMMM yyyy',
    type: 'date',
    builtin: true,
    description: 'Full weekday and month (Monday 3 November 2025 / lundi 3 novembre 2025)',
  },
  {
    id: 'date-short-month',
    name: 'Short Month',
    format: 'LOCALE_MED',
    type: 'date',
    builtin: true,
    description: 'Locale-aware order (Nov 2, 2025 / 2 nov. 2025)',
  },

  // Time formats
  {
    id: 'time-24h',
    name: '24-hour',
    format: 'HH:mm',
    type: 'time',
    builtin: true,
    description: '24-hour time (14:30)',
  },
  {
    id: 'time-12h',
    name: '12-hour',
    format: 'h:mm a',
    type: 'time',
    builtin: true,
    description: '12-hour time with AM/PM (2:30 PM)',
  },
  {
    id: 'time-24h-seconds',
    name: '24-hour with seconds',
    format: 'HH:mm:ss',
    type: 'time',
    builtin: true,
    description: '24-hour time with seconds (14:30:45)',
  },

  // DateTime formats
  {
    id: 'datetime-iso',
    name: 'ISO DateTime',
    format: "yyyy-MM-dd'T'HH:mm:ss",
    type: 'datetime',
    builtin: true,
    description: 'ISO format with time (2025-11-02T14:30:45)',
  },
  {
    id: 'datetime-readable',
    name: 'Readable',
    format: 'LOCALE_MED_TIME',
    type: 'datetime',
    builtin: true,
    description: 'Locale-aware order (Nov 2, 2025 14:30 / 2 nov. 2025 14:30)',
  },
  {
    id: 'datetime-standard',
    name: 'Standard',
    format: 'yyyy-MM-dd HH:mm:ss',
    type: 'datetime',
    builtin: true,
    description: 'Standard datetime format (2025-11-02 14:30:45)',
  },
];

/**
 * Complete default settings with format presets
 */
export const DEFAULT_SETTINGS: DateHelpersSettings = {
  ...DEFAULT_SETTINGS_BASE,
  formatPresets: DEFAULT_FORMAT_PRESETS,
};
