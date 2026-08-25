/**
 * @jest-environment jsdom
 *
 * What confirming would write — the one answer the result field, the format
 * selector labels and the executor all read.
 */

import { DateTime } from 'luxon';
import { createMockApp } from '../../../helpers/mock-app';
import { outputForOption, activeOutput } from '@/ui/date-picker/output';
import { DatePickerState } from '@/ui/date-picker/date-picker-state';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { I18nService } from '@/services/i18n-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';
import { SELECTED_TEXT_SOURCE } from '@/types/alias-source';
import { DateAction } from '@/ui/date-picker/types';
import { translateWith } from '../../../helpers/translate';

describe('the picker output', () => {
  let settings: DateHelpersSettings;
  let presets: FormatPreset[];
  let dateService: DateService;
  let formatterService: FormatterService;
  let dailyNotesService: DailyNotesService;
  let i18n: I18nService;
  const day = DateTime.fromISO('2026-08-24');

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    presets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');
    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    i18n = new I18nService('en');
    dailyNotesService = new DailyNotesService(createMockApp(), formatterService, i18n, settings);
  });

  function build(opts: { action?: DateAction; selectionText?: string } = {}) {
    const state = new DatePickerState(
      presets,
      settings,
      dateService,
      jest.fn().mockResolvedValue(undefined),
      {
        initialAction: opts.action ?? 'insert-daily-note',
        selectionText: opts.selectionText,
      }
    );
    return {
      state,
      deps: {
        state,
        presets,
        formatterService,
        dailyNotesService,
        t: translateWith(i18n),
      },
    };
  }

  it('says what a format option would insert on the text action', () => {
    const { deps } = build({ action: 'insert-text' });
    expect(outputForOption('iso8601', day, deps)).toBe('2026-08-24');
    expect(outputForOption('locale-long', day, deps)).not.toBe('2026-08-24');
  });

  it('says what a format option would link to on the daily note action', () => {
    const { deps } = build();
    expect(outputForOption('iso8601', day, deps)).toBe('[[2026-08-24|2026-08-24]]');
  });

  it('says what an alias source would link to', () => {
    const { state, deps } = build({ selectionText: 'réunion de cadrage' });
    state.setSelectionParseResult(null);
    expect(outputForOption(SELECTED_TEXT_SOURCE, day, deps)).toBe(
      '[[2026-08-24|réunion de cadrage]]'
    );
  });

  it('carries an edited alias into the option that owns it', () => {
    const { state, deps } = build({ selectionText: 'réunion de cadrage' });
    state.setSelectionParseResult(null);
    state.setEditedAlias('réunion de lancement');
    expect(outputForOption(SELECTED_TEXT_SOURCE, day, deps)).toBe(
      '[[2026-08-24|réunion de lancement]]'
    );
  });

  it('says the open action navigates, and no option changes that', () => {
    const { deps } = build({ action: 'open-daily-note' });
    const navigation = activeOutput(day, deps);
    expect(navigation).toContain('August 24, 2026');
    expect(outputForOption('iso8601', day, deps)).toBe(navigation);
  });

  it('reads the active option when none is named', () => {
    const { state, deps } = build({ selectionText: 'réunion de cadrage' });
    state.setSelectionParseResult(null);
    expect(activeOutput(day, deps)).toBe('[[2026-08-24|réunion de cadrage]]');

    state.setSelectedPreset('iso8601');
    expect(activeOutput(day, deps)).toBe('[[2026-08-24|2026-08-24]]');
  });

  it('falls back to the active preset when the option is not a preset it knows', () => {
    const { state, deps } = build({ action: 'insert-text' });
    // The active preset must not be presets[0], or the word "active" proves
    // nothing: the shipped default IS the first of the list.
    state.setSelectedPreset('locale-long');
    expect(state.selectedPreset.id).not.toBe(presets[0].id);

    expect(outputForOption('no-such-preset', day, deps)).toBe(
      formatterService.formatWithPreset(day, state.selectedPreset)
    );
    expect(outputForOption('no-such-preset', day, deps)).not.toBe(
      formatterService.formatWithPreset(day, presets[0])
    );
  });
});
