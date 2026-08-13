import { DateTime } from 'luxon';
import { DatePickerState } from '@/ui/date-picker/date-picker-state';
import { DateService } from '@/services/date-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

describe('DatePickerState', () => {
  let dateService: DateService;
  let settings: DateHelpersSettings;
  let presets: FormatPreset[];
  let saveSettings: jest.Mock;

  beforeEach(() => {
    dateService = new DateService('en-US');
    settings = { ...DEFAULT_SETTINGS };
    presets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');
    saveSettings = jest.fn().mockResolvedValue(undefined);
  });

  function createState(opts?: { initialAction?: never; initialNLPText?: string } | object) {
    return new DatePickerState(presets, settings, dateService, saveSettings, opts);
  }

  describe('construction', () => {
    it('throws when no presets are provided', () => {
      expect(() => new DatePickerState([], settings, dateService, saveSettings)).toThrow(
        'UnifiedDatePickerModal requires at least one format preset'
      );
    });

    it('defaults to insert-text, then lastUsedAction, then initialAction', () => {
      expect(createState().selectedAction).toBe('insert-text');

      settings.lastUsedAction = 'open-daily-note';
      expect(createState().selectedAction).toBe('open-daily-note');

      const state = new DatePickerState(presets, settings, dateService, saveSettings, {
        initialAction: 'insert-daily-note',
      });
      expect(state.selectedAction).toBe('insert-daily-note');
    });

    it('persists initialAction immediately', () => {
      new DatePickerState(presets, settings, dateService, saveSettings, {
        initialAction: 'insert-daily-note',
      });
      expect(settings.lastUsedAction).toBe('insert-daily-note');
      expect(saveSettings).toHaveBeenCalled();
    });

    it('resolves the original-text pseudo-preset to the fallback preset', () => {
      settings.lastUsedAction = 'insert-daily-note';
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';
      const state = new DatePickerState(presets, settings, dateService, saveSettings, {
        initialNLPText: 'tomorrow',
      });
      expect(state.selectedPreset.id).toBe('locale-long');
    });

    it('initializes calendar to current month and day', () => {
      const state = createState();
      const now = dateService.now();
      expect(state.viewMonth.toISODate()).toBe(now.startOf('month').toISODate());
      expect(state.focusedDay.toISODate()).toBe(now.startOf('day').toISODate());
    });
  });

  describe('setSelectedAction', () => {
    it('returns the resolved preset id and persists the action', () => {
      const state = createState();
      saveSettings.mockClear();

      const presetId = state.setSelectedAction('insert-daily-note');

      expect(presetId).toBe(settings.dailyNotesAliasFallbackPresetId);
      expect(settings.lastUsedAction).toBe('insert-daily-note');
      expect(saveSettings).toHaveBeenCalled();
    });

    it('keeps the previous preset when the configured preset id is unknown', () => {
      settings.defaultDatePresetId = 'does-not-exist';
      const state = createState();
      state.setSelectedAction('insert-daily-note');
      const before = state.selectedPreset;

      settings.dailyNotesAliasPresetId = 'also-missing';
      state.setSelectedAction('insert-daily-note');
      expect(state.selectedPreset).toBe(before);
    });
  });

  describe('setSelectedPreset', () => {
    it('persists per action (insert-text vs daily-note)', () => {
      const state = createState();
      state.setSelectedPreset('locale-long');
      expect(settings.defaultDatePresetId).toBe('locale-long');

      state.setSelectedAction('insert-daily-note');
      state.setSelectedPreset('iso8601');
      expect(settings.dailyNotesAliasPresetId).toBe('iso8601');
    });

    it('accepts original-text only for daily-note actions', () => {
      const state = createState();
      const before = settings.dailyNotesAliasPresetId;

      state.setSelectedPreset('original-text'); // insert-text: ignored
      expect(settings.dailyNotesAliasPresetId).toBe(before);

      state.setSelectedAction('insert-daily-note');
      state.setSelectedPreset('original-text');
      expect(settings.dailyNotesAliasPresetId).toBe('original-text');
    });

    it('ignores unknown preset ids', () => {
      const state = createState();
      const before = state.selectedPreset;
      state.setSelectedPreset('nope');
      expect(state.selectedPreset).toBe(before);
    });
  });

  describe('calendar navigation', () => {
    it('navigateMonth/navigateYear move the view month and clear NLP state', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      const month = state.viewMonth;

      state.navigateMonth('next');
      expect(state.viewMonth.toISODate()).toBe(month.plus({ months: 1 }).toISODate());
      expect(state.currentNLPText).toBeNull();
      expect(state.initialNLPText).toBeNull();

      state.navigateYear('prev');
      expect(state.viewMonth.toISODate()).toBe(
        month.plus({ months: 1 }).minus({ years: 1 }).toISODate()
      );
    });

    it('navigateDay returns the moved day without mutating focusedDay', () => {
      const state = createState();
      const focused = state.focusedDay;
      const next = state.navigateDay('next');
      expect(next.toISODate()).toBe(focused.plus({ days: 1 }).toISODate());
      expect(state.focusedDay.toISODate()).toBe(focused.toISODate());
    });

    it('setFocusedDay syncs the view month across month boundaries', () => {
      const state = createState();
      const other = state.focusedDay.plus({ months: 2 });
      state.setFocusedDay(other);
      expect(state.viewMonth.toISODate()).toBe(other.startOf('month').toISODate());
    });

    it('today() returns the current day and clears NLP state', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      const today = state.today();
      expect(today.toISODate()).toBe(dateService.now().startOf('day').toISODate());
      expect(state.currentNLPText).toBeNull();
    });
  });

  describe('NLP text tracking', () => {
    it('flags availability changes', () => {
      const state = createState();
      expect(state.updateNLPText('tomorrow').availabilityChanged).toBe(true);
      expect(state.updateNLPText('next friday').availabilityChanged).toBe(false);
      expect(state.updateNLPText('').availabilityChanged).toBe(true);
    });

    it('never restores initial text after an explicit clear', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      expect(state.getRestorableNLPText()).toBe('tomorrow');

      state.updateNLPText(''); // explicit clear
      expect(state.nlpTextWasCleared).toBe(true);
      expect(state.getRestorableNLPText()).toBeNull();

      state.updateNLPText('next monday'); // typing resets the flag
      expect(state.nlpTextWasCleared).toBe(false);
      expect(state.getRestorableNLPText()).toBe('next monday');
    });
  });

  describe('Original Text rules', () => {
    it('is available only for daily-note actions with text', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      expect(state.isOriginalTextAvailable()).toBe(false); // insert-text

      state.setSelectedAction('insert-daily-note');
      expect(state.isOriginalTextAvailable()).toBe(true);

      state.updateNLPText('');
      expect(state.isOriginalTextAvailable()).toBe(false);
    });

    it('canUseOriginalTextForDate requires a matching parsed date', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');

      expect(state.canUseOriginalTextForDate(tomorrow)).toBe(false); // not parsed yet

      state.nlpParsedDate = tomorrow;
      expect(state.canUseOriginalTextForDate(tomorrow)).toBe(true);
      expect(state.canUseOriginalTextForDate(tomorrow.plus({ days: 1 }))).toBe(false);
    });

    it('tolerates parsed dates carrying a different locale (field comparison)', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
      state.nlpParsedDate = tomorrow.setLocale('fr-FR');
      expect(state.canUseOriginalTextForDate(DateTime.fromISO(tomorrow.toISODate() ?? ''))).toBe(
        true
      );
    });
  });
});
