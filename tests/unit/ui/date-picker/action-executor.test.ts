import { executeDateAction } from '@/ui/date-picker/action-executor';
import { DatePickerState } from '@/ui/date-picker/date-picker-state';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

describe('executeDateAction', () => {
  let dateService: DateService;
  let formatterService: FormatterService;
  let dailyNotesService: jest.Mocked<
    Pick<DailyNotesService, 'generateWikilink' | 'createDailyNote' | 'openDailyNote'>
  >;
  let settings: DateHelpersSettings;
  let state: DatePickerState;
  let onSelect: jest.Mock;

  beforeEach(() => {
    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    settings = { ...DEFAULT_SETTINGS, defaultDatePresetId: 'iso8601' };
    dailyNotesService = {
      generateWikilink: jest.fn().mockReturnValue('[[2026-06-11|link]]'),
      createDailyNote: jest.fn().mockResolvedValue(undefined),
      openDailyNote: jest.fn().mockResolvedValue(undefined),
    };
    onSelect = jest.fn();
    state = new DatePickerState(
      DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date'),
      settings,
      dateService,
      jest.fn().mockResolvedValue(undefined)
    );
  });

  function ctx() {
    return {
      state,
      formatterService,
      dailyNotesService: dailyNotesService as unknown as DailyNotesService,
      settings,
      onSelect,
    };
  }

  it('insert-text formats with the selected preset and persists the action', async () => {
    const date = dateService.now().startOf('day');
    await executeDateAction(date, ctx());

    expect(onSelect).toHaveBeenCalledWith(date.toFormat('yyyy-MM-dd'), 'insert-text');
    expect(settings.lastUsedAction).toBe('insert-text');
  });

  it('insert-daily-note emits a wikilink with the selected preset', async () => {
    state.setSelectedAction('insert-daily-note');
    const date = dateService.now().startOf('day');
    await executeDateAction(date, ctx());

    expect(dailyNotesService.generateWikilink).toHaveBeenCalledWith(date, {
      customAlias: undefined,
      presetId: state.selectedPreset.id,
    });
    expect(onSelect).toHaveBeenCalledWith('[[2026-06-11|link]]', 'insert-daily-note');
    expect(dailyNotesService.createDailyNote).not.toHaveBeenCalled();
  });

  it('insert-daily-note uses the original text as alias when selected and date matches', async () => {
    settings.dailyNotesAliasPresetId = 'original-text';
    state = new DatePickerState(
      DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date'),
      settings,
      dateService,
      jest.fn().mockResolvedValue(undefined),
      { initialAction: 'insert-daily-note', initialNLPText: 'tomorrow' }
    );
    const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
    state.nlpParsedDate = tomorrow;

    await executeDateAction(tomorrow, ctx());

    expect(dailyNotesService.generateWikilink).toHaveBeenCalledWith(tomorrow, {
      customAlias: 'tomorrow',
      presetId: undefined,
    });
  });

  it('insert-daily-note creates the note when dailyNotesCreateIfMissing is on, and survives failures', async () => {
    settings.dailyNotesCreateIfMissing = true;
    state.setSelectedAction('insert-daily-note');
    dailyNotesService.createDailyNote.mockRejectedValue(new Error('boom'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const date = dateService.now().startOf('day');
    await expect(executeDateAction(date, ctx())).resolves.toBeUndefined();

    expect(dailyNotesService.createDailyNote).toHaveBeenCalledWith(date);
    expect(onSelect).toHaveBeenCalled(); // wikilink still emitted
    consoleError.mockRestore();
  });

  it('open-daily-note calls onSelect(null) BEFORE opening, exactly once', async () => {
    state.setSelectedAction('open-daily-note');
    const callOrder: string[] = [];
    onSelect.mockImplementation(() => callOrder.push('onSelect'));
    dailyNotesService.openDailyNote.mockImplementation(async () => {
      callOrder.push('open');
    });

    const date = dateService.now().startOf('day');
    await executeDateAction(date, ctx());

    expect(callOrder).toEqual(['onSelect', 'open']);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null, 'open-daily-note');
  });

  it('open-daily-note swallows open failures (Notice instead of throw)', async () => {
    state.setSelectedAction('open-daily-note');
    dailyNotesService.openDailyNote.mockRejectedValue(new Error('not found'));

    const date = dateService.now().startOf('day');
    await expect(executeDateAction(date, ctx())).resolves.toBeUndefined();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
