import { Notice } from 'obsidian';
import { DateTime } from 'luxon';
import { FormatterService } from '@/services/formatter-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { isTranslatedError } from '@/services/translated-error';
import { DateHelpersSettings } from '@/types/settings';
import { Translate } from '@/i18n/types';
import { DateAction } from './types';
import { DatePickerState } from './date-picker-state';

export interface ActionExecutorContext {
  state: DatePickerState;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
  formatterService: FormatterService;
  dailyNotesService: DailyNotesService;
  settings: DateHelpersSettings;
  onSelect: (result: string | null, action: DateAction) => void;
}

/**
 * Execute the currently selected action for a date: format as text,
 * generate a daily-note wikilink (optionally creating the note), or
 * open the daily note. Mirrors the original modal selectDate body.
 */
export async function executeDateAction(date: DateTime, ctx: ActionExecutorContext): Promise<void> {
  const { state, formatterService, dailyNotesService, settings, onSelect, t } = ctx;

  // Persist action to settings (saved on next saveSettings call)
  settings.lastUsedAction = state.selectedAction;

  let result: string | null = null;

  switch (state.selectedAction) {
    case 'insert-text':
      // Format date as text with selected preset
      result = formatterService.formatWithPreset(date, state.selectedPreset);
      break;

    case 'insert-daily-note': {
      // Text alias or format preset — the state decides, and the NLP preview
      // asks it the same question, so the two cannot disagree.
      result = dailyNotesService.generateWikilink(date, state.aliasOptionsForDate(date));
      // Optionally create note if setting enabled
      if (settings.dailyNotesCreateIfMissing) {
        await dailyNotesService.createDailyNote(date).catch(error => {
          console.error('Failed to create daily note:', error);
          new Notice(t('errors.createDailyNoteFailed'));
        });
      }
      break;
    }

    case 'open-daily-note':
      // Navigate to daily note (no text insertion)
      // Call onSelect BEFORE opening to allow cleanup of trigger characters
      onSelect(null, state.selectedAction);
      try {
        await dailyNotesService.openDailyNote(date);
      } catch (error) {
        // Show user-friendly error notice
        // Only the plugin's own failures are phrased for the user. Anything
        // else — a vault error, an Obsidian internal — carries English text,
        // which a French user must not be shown; it goes to the console.
        if (!isTranslatedError(error)) console.error('Failed to open daily note:', error);
        new Notice(isTranslatedError(error) ? error.message : t('errors.openDailyNoteFailed'));
      }
      return; // Early return to avoid calling onSelect again
  }

  onSelect(result, state.selectedAction);
}
