import { DateTime } from 'luxon';
import { FormatterService } from '@/services/formatter-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { Translate } from '@/i18n/types';
import { DatePickerState } from './date-picker-state';

export interface OutputDeps {
  state: DatePickerState;
  formatterService: FormatterService;
  dailyNotesService: DailyNotesService;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
}

/**
 * What confirming would write if `optionId` were the active option.
 *
 * One answer, asked by three callers: the format selector labels every option
 * with it, the modal reads it for the open action, and the executor writes it
 * — through `activeOutput` for the last two. When only one of them computed it,
 * the preview promised an alias the insertion then refused.
 */
export function outputForOption(optionId: string, date: DateTime, deps: OutputDeps): string {
  const { state, formatterService, dailyNotesService, t } = deps;

  if (state.selectedAction === 'insert-daily-note') {
    return dailyNotesService.generateWikilink(date, state.aliasOptionsForOption(optionId, date));
  }

  // The open action navigates: no option changes what it writes, because it
  // writes nothing. It still names the day, which is what the user confirms.
  if (state.selectedAction === 'open-daily-note') {
    return t('picker.openPreview', {
      date: formatterService.formatWithPreset(date, state.selectedPreset),
    });
  }

  // An id the preset list does not carry — a stale setting, an alias source on
  // the text path — falls back to the active preset rather than to nothing.
  return formatterService.formatWithPreset(date, state.presetById(optionId));
}

/** The same, for whichever option is active */
export function activeOutput(date: DateTime, deps: OutputDeps): string {
  const state = deps.state;
  return outputForOption(state.selectedAliasSource() ?? state.selectedPreset.id, date, deps);
}
