import { Editor, EditorPosition, Notice, Plugin } from 'obsidian';
import { DateTime } from 'luxon';
import { DateHelpersSettings } from '@/types/settings';
import { DateHelpersSettingTab } from '@/ui/settings-tab';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DatePickerSuggest } from '@/ui/date-picker-suggest';
import { I18nService } from '@/services/i18n-service';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { validateSettings } from '@/utils/settings-validator';
import { migrateSettings } from '@/utils/settings-migration';
import { detectObsidianLocale } from '@/utils/locale';

export default class DateHelpersPlugin extends Plugin {
  settings!: DateHelpersSettings;
  i18n!: I18nService;
  dateService!: DateService;
  formatterService!: FormatterService;
  nlpService!: NLPService;
  dailyNotesService!: DailyNotesService;
  private commandsRegistered = false;


  async onload() {
    try {
      // Load settings
      await this.loadSettings();

      // Initialize services
      this.initializeServices();

      // Register settings tab
      this.addSettingTab(new DateHelpersSettingTab(this.app, this));

      // Register Phase 1 commands
      this.registerCommands();

      // Register Phase 2 trigger characters
      this.registerTriggerCharacters();
    } catch (error) {
      console.error('Failed to load Date Helpers plugin:', error);
      // Plugin will be disabled, but won't crash Obsidian
    }
  }

  private initializeServices() {
    // Determine locale (auto = inherit from Obsidian)
    const locale =
      this.settings.locale === 'auto' ? detectObsidianLocale() : this.settings.locale;

    this.i18n = new I18nService(locale);
    this.dateService = new DateService(locale);
    this.formatterService = new FormatterService(locale);
    this.nlpService = new NLPService(this.dateService, this.i18n, this.settings);
    // Phase 5: Daily Notes Service
    this.dailyNotesService = new DailyNotesService(this.app, this.formatterService, this.settings);
  }

  private registerCommands() {
    // Only register commands once during plugin load
    // Obsidian doesn't provide removeCommand(), so we can't dynamically update
    if (this.commandsRegistered) {
      return;
    }

    // Phase 7.2: Action-based commands (all use UnifiedDatePickerModal)
    this.registerActionCommands();

    // Dynamic preset commands (registered at plugin load time)
    // Note: Changes to format presets require plugin reload to update commands
    this.settings.formatPresets.forEach((preset) => {
      // Use appropriate prefix based on preset type
      let commandPrefix = 'Insert date';
      if (preset.type === 'time') {
        commandPrefix = 'Insert time';
      } else if (preset.type === 'datetime') {
        commandPrefix = 'Insert datetime';
      }

      this.addCommand({
        id: `insert-date-${preset.id}`,
        name: `${commandPrefix}: ${preset.name}`,
        editorCallback: (editor: Editor) => {
          this.insertFormattedDate(editor, preset.id);
        },
      });
    });

    this.commandsRegistered = true;
  }

  /**
   * Register action-based commands (Phase 7.2)
   * Three separate commands, each using UnifiedDatePickerModal with a specific action
   */
  private registerActionCommands() {
    // Command 1: Insert text (formatted date)
    this.addCommand({
      id: 'insert-date-text',
      name: 'Insert date as text',
      editorCallback: (editor: Editor) => {
        this.showUnifiedPicker(editor, 'insert-text');
      },
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 't' }],
    });

    // Command 2: Insert Daily Note wikilink
    this.addCommand({
      id: 'insert-date-daily-note',
      name: 'Insert Daily Note link',
      editorCallback: (editor: Editor) => {
        this.showUnifiedPicker(editor, 'insert-daily-note');
      },
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'd' }],
    });

    // Command 3: Open Daily Note (no text insertion)
    this.addCommand({
      id: 'open-daily-note',
      name: 'Open Daily Note',
      editorCallback: (editor: Editor) => {
        this.showUnifiedPicker(editor, 'open-daily-note');
      },
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
    });

    // Command 4: Convert selection (Phase 7.2)
    // Parse selected text with NLP and open picker with parsed date
    this.addCommand({
      id: 'convert-selection',
      name: 'Convert selection to date',
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const selection = editor.getSelection();
        if (!selection) return false;

        if (!checking) {
          this.convertSelection(editor, selection);
        }
        return true;
      },
    });
  }

  private registerTriggerCharacters() {
    // Only register if date picker is enabled and trigger characters are configured
    if (
      !this.settings.enableDatePicker ||
      !this.settings.triggerCharacters ||
      this.settings.triggerCharacters.length === 0
    ) {
      return;
    }

    // Register EditorSuggest for trigger character detection
    this.registerEditorSuggest(
      new DatePickerSuggest(this.app, this, this.settings.triggerCharacters)
    );
  }

  /**
   * Show unified date picker with specified action
   * Phase 7.2: Replaces old mode-based pickers
   */
  private showUnifiedPicker(
    editor: Editor,
    initialAction: 'insert-text' | 'insert-daily-note' | 'open-daily-note',
    initialDate?: DateTime,
    initialNLPText?: string
  ) {
    const datePresets = this.settings.formatPresets.filter((p) => p.type === 'date');

    if (datePresets.length === 0) {
      console.error('No date presets available for date picker');
      return;
    }

    const modal = new UnifiedDatePickerModal(
      this.app,
      this.dateService,
      this.formatterService,
      this.nlpService,
      this.dailyNotesService,
      datePresets,
      this.settings,
      (result: string | null, action: string) => {
        // Only insert text for insert-text and insert-daily-note actions
        if (result !== null && (action === 'insert-text' || action === 'insert-daily-note')) {
          const selection = editor.getSelection();
          if (selection) {
            editor.replaceSelection(result);
          } else {
            const cursor = editor.getCursor();
            editor.replaceRange(result, cursor);
            // Move cursor to end of inserted text
            editor.setCursor({
              line: cursor.line,
              ch: cursor.ch + result.length,
            });
          }
        }
        // open-daily-note action: no text insertion, just navigation
      },
      () => this.saveSettings(),
      initialAction,
      initialNLPText
    );

    // If an initial date is provided, pre-select it in the calendar
    if (initialDate) {
      modal.setFocusedDay(initialDate);
      modal.setViewMonth(initialDate);
    }

    modal.open();
  }

  /**
   * Convert selected text to date (Phase 7.2)
   * Parse selection with NLP and open unified picker with parsed date
   */
  private convertSelection(editor: Editor, selection: string) {
    // Try parsing the selection
    const parseResult = this.nlpService.parse(selection.trim());

    if (!parseResult) {
      new Notice(`Could not parse date from: ${selection}`);
      return;
    }

    // Show notice of what was parsed
    const formattedPreview = this.formatterService.format(parseResult.date, 'yyyy-MM-dd HH:mm');
    new Notice(`Parsed: ${selection} → ${formattedPreview}`);

    // Open unified picker with parsed date pre-selected
    // Use lastUsedAction or default to insert-text
    const initialAction = this.settings.lastUsedAction || 'insert-text';
    this.showUnifiedPicker(editor, initialAction, parseResult.date, selection.trim());
  }

  /**
   * Insert formatted date (for preset commands)
   * Uses lastUsedAction to determine insertion behavior
   */
  private insertFormattedDate(editor: Editor, presetId: string) {
    const preset = this.settings.formatPresets.find((p) => p.id === presetId);
    if (!preset) {
      console.error(`Format preset not found: ${presetId}`);
      return;
    }

    const now = this.dateService.now();

    // Use lastUsedAction to determine behavior (default to text)
    const lastAction = this.settings.lastUsedAction || 'insert-text';

    if (lastAction === 'insert-daily-note' || lastAction === 'open-daily-note') {
      // Insert wikilink to today's daily note
      const wikilink = this.dailyNotesService.generateWikilink(now, { presetId });
      editor.replaceSelection(wikilink);
    } else {
      // Insert plain text
      const formatted = this.formatterService.formatWithPreset(now, preset);
      editor.replaceSelection(formatted);
    }
  }


  /**
   * Show unified date picker from trigger character detection
   * Phase 7.2: Replaces trigger characters with selected date, cleans up on cancel
   * @param initialDate - Optional date to pre-select in calendar (from NLP parsing)
   */
  showDatePickerFromTrigger(
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    initialDate?: DateTime | null
  ) {
    const datePresets = this.settings.formatPresets.filter((p) => p.type === 'date');

    if (datePresets.length === 0) {
      console.error('No date presets available for date picker');
      return;
    }

    // Use lastUsedAction or default to insert-text
    const initialAction = this.settings.lastUsedAction || 'insert-text';

    // Track whether user made a selection (to cleanup trigger on cancel)
    let selectionMade = false;

    const modal = new UnifiedDatePickerModal(
      this.app,
      this.dateService,
      this.formatterService,
      this.nlpService,
      this.dailyNotesService,
      datePresets,
      this.settings,
      (result: string | null, action: string) => {
        selectionMade = true;

        // Only insert text for insert-text and insert-daily-note actions
        if (result !== null && (action === 'insert-text' || action === 'insert-daily-note')) {
          // Replace trigger characters with result
          editor.replaceRange(result, start, end);
          // Move cursor to end of inserted text
          editor.setCursor({
            line: start.line,
            ch: start.ch + result.length,
          });
        } else if (action === 'open-daily-note') {
          // open-daily-note: Remove trigger characters BEFORE opening note
          // This ensures the cleanup happens before navigation
          editor.replaceRange('', start, end);
        }
      },
      () => this.saveSettings(),
      initialAction
    );

    // If NLP provided a date, pre-select it in the calendar
    if (initialDate) {
      modal.setFocusedDay(initialDate);
      modal.setViewMonth(initialDate);
    }

    // Phase 7.2: Cleanup trigger characters on cancel
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      // If user cancelled without making a selection, remove trigger characters
      if (!selectionMade) {
        const currentText = editor.getRange(start, end);
        if (this.settings.triggerCharacters.some(t => currentText.startsWith(t))) {
          editor.replaceRange('', start, end);
        }
      }
      // Preserve original cleanup (nullifies DOM refs)
      originalOnClose();
    };

    modal.open();
  }


  onunload() {
  }

  async loadSettings() {
    const loadedData = await this.loadData();

    // Phase 6: Migrate settings from Phase 5 to Phase 6 if needed
    const migratedData = migrateSettings(loadedData || {});

    // Check if migration occurred
    if (loadedData && 'enableDailyNotesIntegration' in loadedData) {
      new Notice(
        'Date Helpers: Settings updated to Phase 6. Please reload the plugin (Cmd/Ctrl+R) to see updated commands.'
      );
    }

    // Validate settings
    this.settings = validateSettings(migratedData);

    // Always save after validation to persist any changes made by validator or migration
    // (e.g., added/updated builtin presets, migrated defaults, fixed invalid values)
    await this.saveData(this.settings);
  }

  async saveSettings() {
    if (!this.settings) {
      console.error('Settings not initialized');
      return;
    }

    await this.saveData(this.settings);

    // Update services with new locale if initialized
    const locale =
      this.settings.locale === 'auto' ? detectObsidianLocale() : this.settings.locale;

    if (this.i18n) {
      this.i18n.setLocale(locale);
    }
    if (this.dateService) {
      this.dateService.setLocale(locale);
    }
    if (this.formatterService) {
      this.formatterService.setLocale(locale);
    }
    if (this.nlpService) {
      this.nlpService.updateSettings(this.settings);
    }
    // Phase 5: Update DailyNotesService
    if (this.dailyNotesService) {
      this.dailyNotesService.updateSettings(this.settings);
    }
  }
}
