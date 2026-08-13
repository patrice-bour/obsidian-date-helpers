import { Notice } from 'obsidian';
import { DateTime } from 'luxon';
import { FormatterService } from '@/services/formatter-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { DateAction } from './types';
import { DatePickerState } from './date-picker-state';

export interface ActionExecutorContext {
  state: DatePickerState;
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
  const { state, formatterService, dailyNotesService, settings, onSelect } = ctx;

  // Persist action to settings (saved on next saveSettings call)
  settings.lastUsedAction = state.selectedAction;

  let result: string | null = null;

  switch (state.selectedAction) {
    case 'insert-text':
      // Format date as text with selected preset
      result = formatterService.formatWithPreset(date, state.selectedPreset);
      break;

    case 'insert-daily-note': {
      // Generate wikilink to daily note
      // Use original text as alias ONLY if:
      // 1. "original-text" is selected
      // 2. The selected date matches the NLP-parsed date
      const useOriginalText =
        state.isOriginalTextSelected() && state.canUseOriginalTextForDate(date);
      result = dailyNotesService.generateWikilink(date, {
        customAlias: useOriginalText ? (state.getOriginalText() ?? undefined) : undefined,
        presetId: useOriginalText ? undefined : state.selectedPreset.id,
      });
      // Optionally create note if setting enabled
      if (settings.dailyNotesCreateIfMissing) {
        await dailyNotesService.createDailyNote(date).catch(error => {
          console.error('Failed to create daily note:', error);
          new Notice('Failed to create daily note');
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
        const message = error instanceof Error ? error.message : 'Failed to open daily note';
        new Notice(message);
      }
      return; // Early return to avoid calling onSelect again
  }

  onSelect(result, state.selectedAction);
}
