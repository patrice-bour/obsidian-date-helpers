import { Editor, EditorPosition, Notice, Plugin } from 'obsidian';
import { DateHelpersSettings } from '@/types/settings';
import { DateHelpersSettingTab } from '@/ui/settings-tab';
import { UnifiedDatePickerModal } from '@/ui/unified-date-picker-modal';
import { DatePickerSuggest } from '@/ui/date-picker-suggest';
import { openEditorSuggest } from '@/ui/editor-suggest-opener';
import { isBareTrigger } from '@/utils/trigger-text';
import { I18nService } from '@/services/i18n-service';
import { presetName } from '@/i18n/preset-labels';
import { Translate } from '@/i18n/types';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { validateSettings } from '@/utils/settings-validator';
import { migrateSettings } from '@/utils/settings-migration';
import { resolveLocale } from '@/utils/locale';

/**
 * What a trigger typed over a selection hands the picker.
 *
 * The two parts always travel together — `SelectionCapture` yields both or
 * neither — so they are one argument rather than two that could disagree.
 */
interface KeptHandover {
  /** The text left in the note, offered to the picker as the alias source */
  text: string;
  /** Where the trigger stands; the separating space sits one character before */
  triggerStart: EditorPosition;
}

export default class DateHelpersPlugin extends Plugin {
  settings!: DateHelpersSettings;
  i18n!: I18nService;
  dateService!: DateService;
  formatterService!: FormatterService;
  nlpService!: NLPService;
  dailyNotesService!: DailyNotesService;
  private settingTab?: DateHelpersSettingTab;
  private commandsRegistered = false;

  /**
   * Bound lookup for the helpers that take one (preset labels). Spreading the
   * tuple is what keeps this a `Translate`: a forwarder that drops the params
   * no longer typechecks.
   */
  private translate: Translate = (key, ...params) => this.i18n.t(key, ...params);

  /** Set by loadSettings, reported once the i18n service exists */
  private migratedFromPhase5 = false;

  async onload() {
    try {
      // Load settings
      await this.loadSettings();

      // Initialize services
      this.initializeServices();

      // Settings are loaded before the services exist, so the migration notice
      // can only be translated — and shown — from here
      if (this.migratedFromPhase5) {
        new Notice(this.i18n.t('notices.settingsMigrated'));
      }

      // Register settings tab
      this.settingTab = new DateHelpersSettingTab(this.app, this);
      this.addSettingTab(this.settingTab);

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
    const locale = resolveLocale(this.settings.locale);

    this.i18n = new I18nService(locale);
    this.dateService = new DateService(locale);
    this.formatterService = new FormatterService(locale);
    this.nlpService = new NLPService(this.dateService, this.i18n, this.settings);
    // Phase 5: Daily Notes Service
    this.dailyNotesService = new DailyNotesService(
      this.app,
      this.formatterService,
      this.i18n,
      this.settings
    );
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
    this.settings.formatPresets.forEach(preset => {
      // Use appropriate prefix based on preset type
      // The separator lives in the translation: French wants a space before it
      const name = this.i18n.t('commands.presetCommand', {
        prefix: this.i18n.t(`commands.prefix.${preset.type}`),
        name: presetName(preset, this.translate),
      });

      this.addCommand({
        id: `insert-date-${preset.id}`,
        name,
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
   *
   * No default hotkeys are registered (Obsidian community plugin policy).
   * Users can invoke these commands via:
   *   - The command palette (Cmd/Ctrl+P)
   *   - A custom hotkey (Settings → Hotkeys)
   *   - The configurable trigger character in the editor (default "@@", see settings)
   *
   * Names are read from the active locale here, at registration. Obsidian
   * freezes a command's name when it is registered and offers no removal in its
   * public API, so a locale change reaches the palette on the next plugin load.
   */
  private registerActionCommands() {
    // Command 1: Insert text (formatted date)
    this.addCommand({
      id: 'insert-date-text',
      name: this.i18n.t('commands.insertText.name'),
      editorCallback: (editor: Editor) => {
        this.showUnifiedPicker(editor, 'insert-text');
      },
    });

    // Command 2: Insert Daily Note wikilink
    this.addCommand({
      id: 'insert-date-daily-note',
      name: this.i18n.t('commands.insertDailyNote.name'),
      editorCallback: (editor: Editor) => {
        this.showUnifiedPicker(editor, 'insert-daily-note');
      },
    });

    // Command 3: Open Daily Note (no text insertion)
    this.addCommand({
      id: 'open-daily-note',
      name: this.i18n.t('commands.openDailyNote.name'),
      editorCallback: (editor: Editor) => {
        this.showUnifiedPicker(editor, 'open-daily-note');
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
    const suggest = new DatePickerSuggest(this.app, this, this.settings.triggerCharacters);
    this.registerEditorSuggest(suggest);

    // The keystroke that opens a trigger replaces the selection, and CodeMirror
    // does that before the suggest is asked anything: by the time `onTrigger`
    // runs, the text is gone and the line carries the trigger in its place.
    // `keydown` is the last moment the selection still exists — and the last
    // moment the replacement can be called off, which is what happens here: the
    // text stays where the user put it, and the trigger goes after it.
    //
    // Capture phase, so nothing that stops the event first can cost the alias.
    const armCapture = (event: KeyboardEvent) => {
      // A held modifier makes a shortcut, not a character typed over the
      // selection — with one exception. On the AZERTY keyboards under Windows
      // and Linux, `@` is typed with AltGr, and the browser reports that
      // keystroke with ctrlKey and altKey both set. Reading ctrlKey alone
      // leaves the trigger inert on every one of those keyboards, so alt is
      // what tells the two apart here.
      //
      // Ctrl+Alt shortcuts do exist, and this is a trade-off, not a proof that
      // they do not: such a keystroke now reaches the capture. It arms one only
      // when the key also opens a configured trigger and a selection is live,
      // and Obsidian's own keymap runs first — a bound hotkey stops the event
      // before this listener sees it. Measured on 1.13.7.
      if (event.metaKey || (event.ctrlKey && !event.altKey)) return;

      // The keystroke must have landed in the editor's own content. The
      // picker's fields are ordinary inputs in the same document, and
      // `activeEditor` still points at the note behind them: typing `@` into
      // the natural-language field would otherwise arm a capture on a
      // selection that keystroke never touched.
      const target = event.target as { closest?: (selector: string) => unknown } | null;
      if (!target?.closest?.('.cm-content')) return;

      const editor = this.app.workspace.activeEditor?.editor;
      if (!editor) return;

      const file = this.app.workspace.activeEditor?.file ?? null;
      const separatorAt = suggest.selectionCapture.arm(editor, event.key, file?.path ?? null);
      if (!separatorAt) return;

      // Call the replacement off, and write the trigger after the text instead.
      // A separating space comes first because `startsAWord` makes a trigger
      // glued to a word inert; writing it before and never after keeps a
      // selection already followed by a space from ending up with two.
      event.preventDefault();
      editor.replaceRange(` ${event.key}`, separatorAt, separatorAt);
      editor.setCursor({ line: separatorAt.line, ch: separatorAt.ch + 2 });

      // Obsidian re-evaluates its suggests on what the user types, and this
      // write was not typed. Without this the trigger lands with no list under
      // it, and everything typed after it goes nowhere.
      //
      // If it cannot even be asked, the capture is dropped on the spot: no
      // popup means no `close()`, and a capture nobody will ever consume would
      // sit armed until a later trigger landed on the same position and
      // inherited a selection the user never made.
      if (!openEditorSuggest(this.app, editor, file)) {
        suggest.selectionCapture.clear();
      }
    };

    this.registerDomEvent(document, 'keydown', armCapture, true);

    // A note popped out into its own window has its own document, and the
    // listener above never sees its keystrokes. Without this the feature is
    // silently absent there: the selection goes, nothing holds it.
    this.registerEvent(
      this.app.workspace.on('window-open', (_leaf, win) => {
        this.registerDomEvent(win.document, 'keydown', armCapture, true);
      })
    );
  }

  /**
   * Show unified date picker with specified action
   *
   * On the link paths the editor selection is carried into the picker as an
   * alias candidate, parsable or not. The plain-text path ignores it: no
   * preset type produces a wikilink, so there is nothing an alias could ride in.
   */
  private showUnifiedPicker(
    editor: Editor,
    initialAction: 'insert-text' | 'insert-daily-note' | 'open-daily-note'
  ) {
    const datePresets = this.settings.formatPresets.filter(p => p.type === 'date');
    const selectionText =
      initialAction === 'insert-text' ? undefined : editor.getSelection()?.trim() || undefined;

    if (datePresets.length === 0) {
      console.error('No date presets available for date picker');
      return;
    }

    const modal = new UnifiedDatePickerModal(
      this.app,
      this.dateService,
      this.formatterService,
      this.nlpService,
      this.i18n,
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
      undefined,
      selectionText
    );

    modal.open();
  }

  /**
   * Insert formatted date (for preset commands)
   * Uses lastUsedAction to determine insertion behavior
   */
  private insertFormattedDate(editor: Editor, presetId: string) {
    const preset = this.settings.formatPresets.find(p => p.id === presetId);
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
   * Open the unified picker for a trigger, and clean up after it.
   *
   * @param start Left bound of what confirming replaces — the kept text's own
   *   start when a selection was kept, the trigger otherwise.
   * @param end Right bound: the caret when the trigger handed over.
   * @param initialNLPText What was typed after the trigger, carried into the
   *   picker's natural-language field rather than retyped.
   * @param kept What a trigger typed over a selection hands over. Its two parts
   *   always travel together: the capture yields both or neither.
   */
  showDatePickerFromTrigger(
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    initialNLPText?: string,
    kept?: KeptHandover
  ) {
    const selectionText = kept?.text;
    // Where the removals start. The separating space stands one character
    // before the trigger, and was written with it.
    const triggerSeparator = kept
      ? { line: kept.triggerStart.line, ch: kept.triggerStart.ch - 1 }
      : undefined;
    const datePresets = this.settings.formatPresets.filter(p => p.type === 'date');

    if (datePresets.length === 0) {
      console.error('No date presets available for date picker');
      return;
    }

    // No action is *requested* on this path — a trigger says nothing about which
    // tab the user wants — so the picker falls back to what they last did,
    // unless a selection came in: see `openOnAction` in `DatePickerStateOptions`.
    const openOnAction = selectionText ? 'insert-daily-note' : undefined;

    // Track whether user made a selection (to cleanup trigger on cancel)
    let selectionMade = false;

    const modal = new UnifiedDatePickerModal(
      this.app,
      this.dateService,
      this.formatterService,
      this.nlpService,
      this.i18n,
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
          // Nothing is inserted on this path, so nothing may be consumed
          // either: only what the plugin wrote comes out. `start` is the kept
          // text's own beginning whenever a selection was kept, and erasing
          // from there would wipe the user's words and navigate away from the
          // damage.
          //
          // Removed BEFORE opening the note, so the cleanup lands while the
          // editor is still the one the trigger was typed in.
          editor.replaceRange('', triggerSeparator ?? start, end);
        }
      },
      () => this.saveSettings(),
      undefined,
      initialNLPText,
      selectionText,
      openOnAction
    );

    // Phase 7.2: Cleanup trigger characters on cancel
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      // If the user cancelled without selecting, remove the trigger — but only
      // the trigger. The inline suggest hands over a range covering everything
      // typed after it, and cancelling must not eat the user's own words: an
      // equality test, not `startsWith`.
      if (!selectionMade) {
        if (triggerSeparator) {
          // The selected text was never taken away: it is still in the note,
          // with a separating space and the trigger written after it. There is
          // nothing to give back — only what the plugin wrote to take away.
          editor.replaceRange('', triggerSeparator, end);
        } else {
          const currentText = editor.getRange(start, end);
          if (isBareTrigger(currentText, this.settings.triggerCharacters)) {
            editor.replaceRange('', start, end);
          }
        }
      }
      // Preserve original cleanup (nullifies DOM refs)
      originalOnClose();
    };

    modal.open();
  }

  onunload() {
    // Obsidian calls hide() when the user leaves the settings tab, but not when
    // the plugin is unloaded with the tab still open — a BRAT update or a
    // "reload plugins" does exactly that, and would leave the tab's pending
    // rebuild timer to fire against services that no longer exist.
    this.settingTab?.dispose();
  }

  async loadSettings() {
    const raw: unknown = await this.loadData();
    const loadedData: Partial<DateHelpersSettings> =
      typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};

    // Phase 6: Migrate settings from Phase 5 to Phase 6 if needed
    const migratedData = migrateSettings(loadedData);

    // Check if migration occurred. The notice waits for onload: i18n is not
    // initialized yet at this point.
    this.migratedFromPhase5 = 'enableDailyNotesIntegration' in loadedData;

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
    const locale = resolveLocale(this.settings.locale);

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
