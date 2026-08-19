import { DateTime } from 'luxon';
import { DatePickerState } from '@/ui/date-picker/date-picker-state';
import { DateService } from '@/services/date-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE } from '@/types/alias-source';

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

    it('resolves a text alias source to the fallback preset', () => {
      settings.lastUsedAction = 'insert-daily-note';
      settings.dailyNotesAliasPresetId = TYPED_TEXT_SOURCE;
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';
      const state = new DatePickerState(presets, settings, dateService, saveSettings, {
        initialNLPText: 'tomorrow',
      });
      expect(state.selectedPreset.id).toBe('locale-long');
    });

    it('opens on the remembered format when an expression is carried in', () => {
      settings.defaultDatePresetId = 'locale-long';

      const state = createState({ initialNLPText: 'next monday' });

      expect(state.getPresetIdForAction('insert-text')).toBe('locale-long');
      expect(state.selectedPreset.id).toBe('locale-long');
    });

    it('ignores a stale nlpDefaultPresetId left in stored settings', () => {
      // The purge clears the key on load, so only a cast can reproduce it —
      // and it has to be reproduced, because the rule under test is "one
      // memory", not "the second key is absent". Both the resolved id and the
      // preset the selector opens on are asserted: the read path and the
      // construction site are two places a second memory can come back, and a
      // test of either one alone stays green while the other regresses.
      (settings as unknown as Record<string, string>).nlpDefaultPresetId = 'iso8601';
      settings.defaultDatePresetId = 'locale-long';

      const state = createState({ initialNLPText: 'tomorrow' });

      expect(state.getPresetIdForAction('insert-text')).toBe('locale-long');
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

    it('accepts a text alias source only for daily-note actions', () => {
      const state = createState();
      const before = settings.dailyNotesAliasPresetId;

      state.setSelectedPreset(TYPED_TEXT_SOURCE); // insert-text: ignored
      expect(settings.dailyNotesAliasPresetId).toBe(before);

      state.setSelectedAction('insert-daily-note');
      state.setSelectedPreset(TYPED_TEXT_SOURCE);
      expect(settings.dailyNotesAliasPresetId).toBe(TYPED_TEXT_SOURCE);
    });

    it('ignores unknown preset ids', () => {
      const state = createState();
      const before = state.selectedPreset;
      state.setSelectedPreset('nope');
      expect(state.selectedPreset).toBe(before);
    });

    it('remembers a format chosen while the NLP field holds text', () => {
      const state = createState({ initialNLPText: 'tomorrow' });

      state.setSelectedPreset('locale-long');

      expect(settings.defaultDatePresetId).toBe('locale-long');
      expect(state.getPresetIdForAction('insert-text')).toBe('locale-long');
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

  describe('text alias sources', () => {
    it('offers the typed source only for daily-note actions with text', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      expect(state.availableAliasSources()).toEqual([]); // insert-text

      state.setSelectedAction('insert-daily-note');
      expect(state.availableAliasSources()).toEqual([TYPED_TEXT_SOURCE]);

      state.updateNLPText('');
      expect(state.availableAliasSources()).toEqual([]);
    });

    it('offers the selected source while the selection exists, listed first', () => {
      const state = new DatePickerState(presets, settings, dateService, saveSettings, {
        initialAction: 'insert-daily-note',
        selectionText: 'réunion de cadrage',
      });
      expect(state.availableAliasSources()).toEqual([SELECTED_TEXT_SOURCE]);

      state.updateNLPText('tomorrow');
      expect(state.availableAliasSources()).toEqual([SELECTED_TEXT_SOURCE, TYPED_TEXT_SOURCE]);

      // Clearing the NLP field does not take the selection with it
      state.updateNLPText('');
      expect(state.availableAliasSources()).toEqual([SELECTED_TEXT_SOURCE]);
    });

    it('keeps each source pointing at its own text', () => {
      const state = new DatePickerState(presets, settings, dateService, saveSettings, {
        initialAction: 'insert-daily-note',
        selectionText: 'réunion de cadrage',
        initialNLPText: 'tomorrow',
      });

      expect(state.getAliasSourceText(SELECTED_TEXT_SOURCE)).toBe('réunion de cadrage');
      expect(state.getAliasSourceText(TYPED_TEXT_SOURCE)).toBe('tomorrow');
    });

    it('pre-selects the selection over the configured source', () => {
      settings.dailyNotesAliasPresetId = TYPED_TEXT_SOURCE;
      const state = new DatePickerState(presets, settings, dateService, saveSettings, {
        initialAction: 'insert-daily-note',
        selectionText: 'réunion de cadrage',
        initialNLPText: 'tomorrow',
      });

      expect(state.selectedAliasSource()).toBe(SELECTED_TEXT_SOURCE);
    });

    it('selects no source when the configured one has no text', () => {
      settings.dailyNotesAliasPresetId = SELECTED_TEXT_SOURCE;
      const state = createState({ initialAction: 'insert-daily-note' });

      expect(state.selectedAliasSource()).toBeNull();
    });

    it('exempts a typed text that parsed to no date, exactly like a selection', () => {
      // The spec exempts "text that parsed to no date", whatever source it came
      // from: it has no date to contradict. Only the selection used to be.
      const state = createState({ initialAction: 'insert-daily-note' });
      state.updateNLPText('réunion de cadrage');
      state.setNLPParseResult(null);

      expect(state.canUseAliasSourceForDate(TYPED_TEXT_SOURCE, dateService.now())).toBe(true);
    });

    it('still refuses a typed text before anything has been parsed', () => {
      const state = createState({ initialAction: 'insert-daily-note' });
      state.updateNLPText('tomorrow');

      // Nothing has been through the parser yet: nothing can be concluded
      expect(state.canUseAliasSourceForDate(TYPED_TEXT_SOURCE, dateService.now())).toBe(false);
    });

    it('canUseAliasSourceForDate requires a matching parsed date', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');

      expect(state.canUseAliasSourceForDate(TYPED_TEXT_SOURCE, tomorrow)).toBe(false); // not parsed yet

      state.setNLPParseResult(tomorrow);
      expect(state.canUseAliasSourceForDate(TYPED_TEXT_SOURCE, tomorrow)).toBe(true);
      expect(state.canUseAliasSourceForDate(TYPED_TEXT_SOURCE, tomorrow.plus({ days: 1 }))).toBe(
        false
      );
    });

    it('tolerates parsed dates carrying a different locale (field comparison)', () => {
      const state = createState({ initialNLPText: 'tomorrow' });
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
      state.setNLPParseResult(tomorrow.setLocale('fr-FR'));
      expect(
        state.canUseAliasSourceForDate(
          TYPED_TEXT_SOURCE,
          DateTime.fromISO(tomorrow.toISODate() ?? '')
        )
      ).toBe(true);
    });
  });
});
