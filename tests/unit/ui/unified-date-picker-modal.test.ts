import { App } from 'obsidian';
import { DateTime } from 'luxon';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { DateHelpersSettings } from '@/types/settings';
import { FormatPreset } from '@/types/format-preset';
import { DEFAULT_SETTINGS, DEFAULT_FORMAT_PRESETS } from '@/settings/defaults';

describe('UnifiedDatePickerModal', () => {
  let app: App;
  let dateService: DateService;
  let formatterService: FormatterService;
  let nlpService: NLPService;
  let dailyNotesService: DailyNotesService;
  let settings: DateHelpersSettings;
  let datePresets: FormatPreset[];
  let onSelect: jest.Mock;
  let saveSettings: jest.Mock;

  beforeEach(() => {
    // Mock Obsidian App
    app = {
      workspace: {
        openLinkText: jest.fn(),
      },
      vault: {
        getAbstractFileByPath: jest.fn(),
        create: jest.fn(),
        createFolder: jest.fn(),
      },
      internalPlugins: {
        getPluginById: jest.fn(() => null), // Daily Notes plugin not enabled in tests
      },
    } as unknown as App;

    // Create services
    dateService = new DateService('en-US');
    formatterService = new FormatterService('en-US');
    settings = { ...DEFAULT_SETTINGS };

    // Mock I18nService for NLP
    const mockI18nService = {
      getCurrentLocale: jest.fn().mockReturnValue('en-US'),
      t: jest.fn((key: string) => key),
      setLocale: jest.fn(),
    };

    nlpService = new NLPService(dateService, mockI18nService as any, settings);
    dailyNotesService = new DailyNotesService(app, formatterService, settings);

    // Get date presets
    datePresets = DEFAULT_FORMAT_PRESETS.filter(p => p.type === 'date');

    // Mock callbacks
    onSelect = jest.fn();
    saveSettings = jest.fn().mockResolvedValue(undefined);
  });

  describe('Constructor and Initialization', () => {
    it('should create modal with default action (insert-text)', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      expect(modal.getSelectedAction()).toBe('insert-text');
    });

    it('should create modal with specified initial action', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note'
      );

      expect(modal.getSelectedAction()).toBe('insert-daily-note');
    });

    it('should use lastUsedAction from settings if available', () => {
      settings.lastUsedAction = 'open-daily-note';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      expect(modal.getSelectedAction()).toBe('open-daily-note');
    });

    it('should load format based on initial action (insert-text)', () => {
      settings.defaultDatePresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text'
      );

      expect(modal.getSelectedPreset().id).toBe('locale-long');
    });

    it('should load DN alias format when action is insert-daily-note', () => {
      settings.dailyNotesAliasPresetId = 'date-verbose';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note'
      );

      expect(modal.getSelectedPreset().id).toBe('date-verbose');
    });
  });

  describe('Action Selection', () => {
    it('should allow changing selected action', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-daily-note');
      expect(modal.getSelectedAction()).toBe('insert-daily-note');

      modal.setSelectedAction('open-daily-note');
      expect(modal.getSelectedAction()).toBe('open-daily-note');
    });

    it('should persist action selection to settings when changed', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-daily-note');

      // Action should be persisted
      expect(settings.lastUsedAction).toBe('insert-daily-note');
    });
  });

  describe('Format Selection', () => {
    it('should allow changing selected format preset', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedPreset('locale-long');
      expect(modal.getSelectedPreset().id).toBe('locale-long');
    });

    it('should persist format to defaultDatePresetId when action is insert-text', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text'
      );

      modal.setSelectedPreset('locale-short');

      // Format should be persisted to text preset
      expect(settings.defaultDatePresetId).toBe('locale-short');
    });

    it('should persist format to dailyNotesAliasPresetId when action is insert-daily-note', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note'
      );

      modal.setSelectedPreset('date-verbose');

      // Format should be persisted to DN alias preset
      expect(settings.dailyNotesAliasPresetId).toBe('date-verbose');
    });

    it('should ignore invalid preset IDs', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const initialPreset = modal.getSelectedPreset().id;
      modal.setSelectedPreset('invalid-preset-id');

      // Should keep previous preset
      expect(modal.getSelectedPreset().id).toBe(initialPreset);
    });
  });

  describe('Calendar Navigation', () => {
    it('should initialize to current month and today', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const now = dateService.now();
      expect(modal.getViewMonth().hasSame(now, 'month')).toBe(true);
      expect(modal.getFocusedDay().hasSame(now, 'day')).toBe(true);
    });

    it('should allow navigation between months', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const initialMonth = modal.getViewMonth();

      modal.navigateMonth('next');
      expect(modal.getViewMonth().month).toBe(initialMonth.plus({ months: 1 }).month);

      modal.navigateMonth('prev');
      expect(modal.getViewMonth().month).toBe(initialMonth.month);
    });

    it('should allow setting focused day from NLP', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const futureDate = dateService.now().plus({ days: 10 });
      modal.setFocusedDay(futureDate);

      expect(modal.getFocusedDay().hasSame(futureDate, 'day')).toBe(true);
    });
  });

  describe('Date Selection - Insert Text Action', () => {
    it('should format date as text when action is insert-text', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-text');
      modal.setSelectedPreset('iso8601');

      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      modal.selectDate(testDate);

      expect(onSelect).toHaveBeenCalledWith('2025-11-23', 'insert-text');
    });

    it('should use selected format preset for text insertion', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-text');
      modal.setSelectedPreset('locale-long');

      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      modal.selectDate(testDate);

      // Should use locale-long format (DDD)
      expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('November'), 'insert-text');
    });
  });

  describe('Date Selection - Insert Daily Note Action', () => {
    it('should generate wikilink when action is insert-daily-note', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-daily-note');

      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      modal.selectDate(testDate);

      // Should generate wikilink
      expect(onSelect).toHaveBeenCalled();
      const [result, action] = onSelect.mock.calls[0];
      expect(result).toContain('[[');
      expect(result).toContain(']]');
      expect(action).toBe('insert-daily-note');
    });

    it('should use dailyNotesAliasPresetId for wikilink alias', () => {
      settings.dailyNotesAliasPresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-daily-note');

      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      modal.selectDate(testDate);

      const [result] = onSelect.mock.calls[0];
      expect(result).toContain('November');
    });
  });

  describe('Date Selection - Open Daily Note Action', () => {
    it('should call openDailyNote when action is open-daily-note', async () => {
      const openSpy = jest.spyOn(dailyNotesService, 'openDailyNote').mockResolvedValue();

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('open-daily-note');

      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      await modal.selectDate(testDate);

      expect(openSpy).toHaveBeenCalledWith(testDate);
      expect(onSelect).toHaveBeenCalledWith(null, 'open-daily-note');
    });

    it('should not call onSelect with text when opening daily note', async () => {
      jest.spyOn(dailyNotesService, 'openDailyNote').mockResolvedValue();

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('open-daily-note');

      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      await modal.selectDate(testDate);

      // Should pass null for text (no insertion)
      expect(onSelect).toHaveBeenCalledWith(null, 'open-daily-note');
    });
  });

  describe('NLP Integration', () => {
    it('should parse NLP expression and update focused day', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const result = modal.parseNLPExpression('tomorrow');

      expect(result).toBeTruthy();
      if (result) {
        const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
        expect(modal.getFocusedDay().hasSame(tomorrow, 'day')).toBe(true);
      }
    });

    it('should return null for invalid NLP expression', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const result = modal.parseNLPExpression('invalid expression xyz123');

      expect(result).toBeNull();
    });

    it('should handle NLP with time information', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      const result = modal.parseNLPExpression('tomorrow at 2pm');

      expect(result).toBeTruthy();
      if (result) {
        expect(result.hasTime).toBe(true);
        const tomorrow = dateService.now().plus({ days: 1 });
        expect(result.date.hasSame(tomorrow, 'day')).toBe(true);
      }
    });
  });

  describe('Settings Persistence', () => {
    it('should save lastUsedAction when selecting date', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings
      );

      modal.setSelectedAction('insert-daily-note');
      const testDate = DateTime.fromObject({ year: 2025, month: 11, day: 23 });
      modal.selectDate(testDate);

      expect(settings.lastUsedAction).toBe('insert-daily-note');
    });

    it('should update format when switching actions', () => {
      // Start with insert-text action
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text'
      );

      const initialPreset = modal.getSelectedPreset().id;
      expect(initialPreset).toBe(settings.defaultDatePresetId);

      // Switch to insert-daily-note action
      modal.setSelectedAction('insert-daily-note');

      // Format should update to DN alias format
      // When dailyNotesAliasPresetId is 'original-text' but no initialNLPText, use fallback
      const expectedPresetId = settings.dailyNotesAliasPresetId === 'original-text'
        ? settings.dailyNotesAliasFallbackPresetId
        : settings.dailyNotesAliasPresetId;
      expect(modal.getSelectedPreset().id).toBe(expectedPresetId);
    });
  });

  describe('NLP + Original Text + Daily Note (regression)', () => {
    it('should resolve original-text preset correctly when initialNLPText is provided', () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note',
        'tomorrow'
      );

      // selectedPreset should be the fallback (locale-long), not presets[0]
      expect(modal.getSelectedPreset().id).toBe('locale-long');
    });

    it('should fall back correctly when no initialNLPText and original-text configured', () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note'
        // no initialNLPText
      );

      // Without NLP text, getPresetIdForAction returns fallback, which resolves to locale-long
      expect(modal.getSelectedPreset().id).toBe('locale-long');
    });

    it('should use original text as wikilink alias when NLP date matches selected date', async () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note',
        'tomorrow'
      );

      // Parse the NLP expression to set nlpParsedDate
      const parseResult = modal.parseNLPExpression('tomorrow');
      expect(parseResult).toBeTruthy();

      // Select the NLP-parsed date — should produce alias with original text
      await modal.selectDate(parseResult!.date);

      expect(onSelect).toHaveBeenCalled();
      const [result] = onSelect.mock.calls[0];
      // Wikilink alias should be the original NLP text, not verbose format
      expect(result).toContain('|tomorrow]]');
    });

    it('should NOT use original text as alias when selected date differs from NLP-parsed date', async () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note',
        'tomorrow'
      );

      // Parse NLP to set nlpParsedDate
      modal.parseNLPExpression('tomorrow');

      // Select a DIFFERENT date (10 days from now)
      const differentDate = dateService.now().plus({ days: 10 });
      await modal.selectDate(differentDate);

      expect(onSelect).toHaveBeenCalled();
      const [result] = onSelect.mock.calls[0];
      // Should NOT contain "tomorrow" as alias — should use fallback preset format
      expect(result).not.toContain('|tomorrow]]');
    });

    it('should use nlpDefaultPresetId for insert-text when NLP text is present', () => {
      settings.nlpDefaultPresetId = 'locale-long';
      settings.defaultDatePresetId = 'iso8601';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text',
        'tomorrow'
      );

      // With NLP text present, should use nlpDefaultPresetId
      expect(modal.getSelectedPreset().id).toBe('locale-long');
    });

    it('should use defaultDatePresetId for insert-text when no NLP text', () => {
      settings.nlpDefaultPresetId = 'locale-long';
      settings.defaultDatePresetId = 'iso8601';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text'
        // no initialNLPText
      );

      // Without NLP text, should use defaultDatePresetId
      expect(modal.getSelectedPreset().id).toBe('iso8601');
    });

    it('should clear NLP text when jumpToToday is called', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text',
        'tomorrow'
      );

      // Parse NLP to set state
      modal.parseNLPExpression('tomorrow');
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
      expect(modal.getFocusedDay().hasSame(tomorrow, 'day')).toBe(true);

      // Jump to today — should clear NLP state
      modal.jumpToToday();
      const today = dateService.now().startOf('day');
      expect(modal.getFocusedDay().hasSame(today, 'day')).toBe(true);

      // Parsing again with empty text should return null (NLP state cleared)
      const result = modal.parseNLPExpression('');
      expect(result).toBeNull();
    });

    it('should clear NLP text when navigateMonth is called', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text',
        'tomorrow'
      );

      // Parse NLP to set state
      modal.parseNLPExpression('tomorrow');

      const monthBefore = modal.getViewMonth();

      // Navigate month — should clear NLP state and change month
      modal.navigateMonth('next');
      expect(modal.getViewMonth().month).toBe(monthBefore.plus({ months: 1 }).month);
    });

    it('should clear NLP text when navigateDay is called', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text',
        'tomorrow'
      );

      // Parse NLP to set state
      modal.parseNLPExpression('tomorrow');
      const tomorrow = dateService.now().plus({ days: 1 }).startOf('day');
      expect(modal.getFocusedDay().hasSame(tomorrow, 'day')).toBe(true);

      // Navigate day — should clear NLP state and move focus
      modal.navigateDay('next');
      const dayAfterTomorrow = tomorrow.plus({ days: 1 });
      expect(modal.getFocusedDay().hasSame(dayAfterTomorrow, 'day')).toBe(true);
    });

    it('should allow typing new NLP text after calendar interaction', () => {
      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-text',
        'tomorrow'
      );

      // Parse initial NLP text
      modal.parseNLPExpression('tomorrow');

      // Use calendar control (clears NLP state)
      modal.jumpToToday();

      // Type new NLP text — should work normally
      const result = modal.parseNLPExpression('next Monday');
      expect(result).toBeTruthy();
    });

    it('should handle canUseOriginalTextForDate with differently-constructed DateTimes', async () => {
      settings.dailyNotesAliasPresetId = 'original-text';
      settings.dailyNotesAliasFallbackPresetId = 'locale-long';

      const modal = new UnifiedDatePickerModal(
        app,
        dateService,
        formatterService,
        nlpService,
        dailyNotesService,
        datePresets,
        settings,
        onSelect,
        saveSettings,
        'insert-daily-note',
        'tomorrow'
      );

      // Parse NLP expression
      const parseResult = modal.parseNLPExpression('tomorrow');
      expect(parseResult).toBeTruthy();

      // Construct the same date differently (fromObject vs plus)
      const tomorrow = dateService.now().plus({ days: 1 });
      const tomorrowFromObject = DateTime.fromObject({
        year: tomorrow.year,
        month: tomorrow.month,
        day: tomorrow.day,
      });

      // Select with differently-constructed DateTime — should still match
      await modal.selectDate(tomorrowFromObject);

      expect(onSelect).toHaveBeenCalled();
      const [result] = onSelect.mock.calls[0];
      expect(result).toContain('|tomorrow]]');
    });
  });
});
