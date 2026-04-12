import { Modal, App, Notice, Setting } from 'obsidian';
import { DateTime } from 'luxon';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { DailyNotesService } from '@/services/daily-notes-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { calculateCalendarGrid, getLocalizedDayLabels, isToday, isSameDay } from '@/utils/calendar-grid';

type DateAction = 'insert-text' | 'insert-daily-note' | 'open-daily-note';

/**
 * Unified Date Picker Modal (Phase 7.2)
 *
 * Combines date picker, NLP input, and action selection into a single interface.
 * Replaces DatePickerModal and NLPInputModal from previous phases.
 *
 * Features:
 * - Action selector (insert text / insert daily note / open daily note)
 * - Inline NLP input field
 * - Calendar with keyboard navigation
 * - Format selector (always visible)
 * - Remembers last used action and format
 */
export class UnifiedDatePickerModal extends Modal {
  private dateService: DateService;
  private formatterService: FormatterService;
  private nlpService: NLPService;
  private dailyNotesService: DailyNotesService;
  private presets: FormatPreset[];
  private settings: DateHelpersSettings;
  private selectedPreset: FormatPreset;
  private selectedAction: DateAction;
  private weekStart: 0 | 1 | 6;
  private onSelect: (result: string | null, action: DateAction) => void;
  private saveSettings: () => Promise<void>;

  // Calendar state
  private viewMonth: DateTime;
  private focusedDay: DateTime;

  // UI elements
  private calendarGrid: HTMLElement | null = null;
  private monthYearEl: HTMLElement | null = null;
  private nlpInputEl: HTMLInputElement | null = null;
  private nlpPreviewEl: HTMLElement | null = null;
  private formatSelectorEl: HTMLSelectElement | null = null;
  private footerEl: HTMLElement | null = null;

  // Initial state (for "Convert selection to date")
  private initialNLPText: string | null = null;

  // Current NLP text (from input field or initial selection)
  private currentNLPText: string | null = null;

  // Date parsed from NLP expression (to validate "Original Text" usage)
  private nlpParsedDate: DateTime | null = null;

  // Track whether the user explicitly cleared the NLP field
  private nlpTextWasCleared = false;

  constructor(
    app: App,
    dateService: DateService,
    formatterService: FormatterService,
    nlpService: NLPService,
    dailyNotesService: DailyNotesService,
    presets: FormatPreset[],
    settings: DateHelpersSettings,
    onSelect: (result: string | null, action: DateAction) => void,
    saveSettings: () => Promise<void>,
    initialAction?: DateAction,
    initialNLPText?: string
  ) {
    super(app);

    // Validate presets
    if (!presets || presets.length === 0) {
      throw new Error('UnifiedDatePickerModal requires at least one format preset');
    }

    this.dateService = dateService;
    this.formatterService = formatterService;
    this.nlpService = nlpService;
    this.dailyNotesService = dailyNotesService;
    this.presets = presets;
    this.settings = settings;
    this.weekStart = settings.weekStart;
    this.onSelect = onSelect;
    this.saveSettings = saveSettings;

    // Determine initial action
    this.selectedAction = initialAction || settings.lastUsedAction || 'insert-text';

    // If initialAction was provided (direct command), persist it immediately
    if (initialAction) {
      this.settings.lastUsedAction = initialAction;
      this.saveSettings().catch(e => console.error('Failed to save settings:', e));
    }

    // Store initial NLP text BEFORE preset resolution (getPresetIdForAction reads currentNLPText)
    this.initialNLPText = initialNLPText || null;
    this.currentNLPText = this.initialNLPText;

    // Determine initial preset based on selected action
    const defaultPresetId = this.getPresetIdForAction(this.selectedAction);
    if (defaultPresetId === 'original-text') {
      // "original-text" is a pseudo-preset with no matching FormatPreset — use fallback as backing preset
      const fallbackId = this.settings.dailyNotesAliasFallbackPresetId;
      this.selectedPreset = presets.find(p => p.id === fallbackId) || presets[0];
    } else {
      this.selectedPreset = presets.find(p => p.id === defaultPresetId) || presets[0];
    }

    // Initialize calendar to current month/day
    const now = this.dateService.now();
    this.viewMonth = now.startOf('month');
    this.focusedDay = now.startOf('day');
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Get currently selected action
   */
  getSelectedAction(): DateAction {
    return this.selectedAction;
  }

  /**
   * Set selected action
   */
  setSelectedAction(action: DateAction): void {
    this.selectedAction = action;
    // Persist to settings
    this.settings.lastUsedAction = action;

    // Update selected preset to match new action
    const presetId = this.getPresetIdForAction(action);
    if (presetId === 'original-text') {
      // "original-text" is a pseudo-preset — use fallback as backing preset
      const fallbackId = this.settings.dailyNotesAliasFallbackPresetId;
      this.selectedPreset = this.presets.find(p => p.id === fallbackId) || this.presets[0];
    } else {
      const preset = this.presets.find(p => p.id === presetId);
      if (preset) {
        this.selectedPreset = preset;
      }
    }

    // Update format selector dropdown if it exists
    if (this.formatSelectorEl) {
      this.formatSelectorEl.value = presetId === 'original-text' ? 'original-text' : this.selectedPreset.id;
    }

    // Update NLP preview if active
    if (this.nlpInputEl?.value) {
      this.updateNLPPreview(this.nlpInputEl.value);
    }

    this.saveSettings().catch(e => console.error('Failed to save settings:', e));
  }

  /**
   * Get currently selected format preset
   */
  getSelectedPreset(): FormatPreset {
    return this.selectedPreset;
  }

  /**
   * Set selected preset by ID
   * Handles special "original-text" pseudo-preset for Daily Notes actions
   */
  setSelectedPreset(presetId: string): void {
    // Handle "original-text" pseudo-preset
    if (presetId === 'original-text') {
      if (this.selectedAction === 'insert-daily-note' || this.selectedAction === 'open-daily-note') {
        this.settings.dailyNotesAliasPresetId = 'original-text';
        this.saveSettings().catch(e => console.error('Failed to save settings:', e));
      }
      return;
    }

    const preset = this.presets.find(p => p.id === presetId);
    if (preset) {
      this.selectedPreset = preset;

      // Persist to correct setting based on current action
      if (this.selectedAction === 'insert-text') {
        this.settings.defaultDatePresetId = presetId;
      } else if (this.selectedAction === 'insert-daily-note' || this.selectedAction === 'open-daily-note') {
        this.settings.dailyNotesAliasPresetId = presetId;
      }

      this.saveSettings().catch(e => console.error('Failed to save settings:', e));
    }
  }

  /**
   * Get current view month
   */
  getViewMonth(): DateTime {
    return this.viewMonth;
  }

  /**
   * Set current view month
   */
  setViewMonth(month: DateTime): void {
    this.viewMonth = month.startOf('month');
  }

  /**
   * Get currently focused day
   */
  getFocusedDay(): DateTime {
    return this.focusedDay;
  }

  /**
   * Set currently focused day
   */
  setFocusedDay(day: DateTime): void {
    this.focusedDay = day.startOf('day');
    // Update view month if day is in different month
    if (!this.viewMonth.hasSame(day, 'month')) {
      this.viewMonth = day.startOf('month');
    }
    // Update format selector examples to show focused date
    this.updateFormatSelectorExamples();
  }

  /**
   * Set NLP input text (for "Convert selection to date" command)
   */
  setNLPText(text: string): void {
    if (this.nlpInputEl) {
      this.nlpInputEl.value = text;
      this.updateNLPPreview(text);
    }
  }

  /**
   * Navigate to next or previous month
   */
  navigateMonth(direction: 'next' | 'prev'): void {
    this.clearNLPInput();
    if (direction === 'next') {
      this.viewMonth = this.viewMonth.plus({ months: 1 });
    } else {
      this.viewMonth = this.viewMonth.minus({ months: 1 });
    }
  }

  /**
   * Navigate to next or previous year
   */
  navigateYear(direction: 'next' | 'prev'): void {
    this.clearNLPInput();
    if (direction === 'next') {
      this.viewMonth = this.viewMonth.plus({ years: 1 });
    } else {
      this.viewMonth = this.viewMonth.minus({ years: 1 });
    }
  }

  /**
   * Navigate focused day
   */
  navigateDay(direction: 'next' | 'prev' | 'up' | 'down'): void {
    let newDay: DateTime;

    switch (direction) {
      case 'next':
        newDay = this.focusedDay.plus({ days: 1 });
        break;
      case 'prev':
        newDay = this.focusedDay.minus({ days: 1 });
        break;
      case 'down':
        newDay = this.focusedDay.plus({ weeks: 1 });
        break;
      case 'up':
        newDay = this.focusedDay.minus({ weeks: 1 });
        break;
    }

    this.clearNLPInput();
    // Use setFocusedDay to trigger format selector update
    this.setFocusedDay(newDay);
  }

  /**
   * Jump to today's date
   */
  jumpToToday(): void {
    this.clearNLPInput();
    const today = this.dateService.now().startOf('day');
    // Use setFocusedDay to trigger format selector update
    this.setFocusedDay(today);
  }

  /**
   * Clear NLP input state when the user interacts with calendar controls.
   * Prevents NLP from overriding calendar-driven state on re-render.
   */
  private clearNLPInput(): void {
    this.currentNLPText = null;
    this.initialNLPText = null;
    this.nlpParsedDate = null;
  }

  /**
   * Get the appropriate preset ID for the given action
   * Handles "original-text" fallback when no text is available
   * @private
   */
  private getPresetIdForAction(action: DateAction): string {
    switch (action) {
      case 'insert-text':
        if (this.currentNLPText && this.settings.nlpDefaultPresetId) {
          return this.settings.nlpDefaultPresetId;
        }
        return this.settings.defaultDatePresetId;
      case 'insert-daily-note':
      case 'open-daily-note': {
        const presetId = this.settings.dailyNotesAliasPresetId;
        // If "original-text" is configured but no text is available, use fallback
        if (presetId === 'original-text' && !this.currentNLPText) {
          return this.settings.dailyNotesAliasFallbackPresetId;
        }
        return presetId;
      }
      default:
        return this.settings.defaultDatePresetId;
    }
  }

  /**
   * Check if "Original Text" option should be available
   * Available for Daily Notes actions when text is available (initial selection OR NLP input)
   */
  private isOriginalTextAvailable(): boolean {
    return (
      (this.selectedAction === 'insert-daily-note' || this.selectedAction === 'open-daily-note') &&
      !!this.currentNLPText
    );
  }

  /**
   * Get the current text to use as alias (either initial selection or NLP input)
   */
  private getOriginalText(): string | null {
    return this.currentNLPText;
  }

  /**
   * Check if "Original Text" can be used for a specific date
   * Only valid if the date matches the NLP-parsed date
   */
  private canUseOriginalTextForDate(date: DateTime): boolean {
    if (!this.nlpParsedDate || !this.currentNLPText) {
      return false;
    }
    // Compare dates using field-based comparison (robust against timezone edge cases)
    return isSameDay(date, this.nlpParsedDate);
  }

  /**
   * Check if "Original Text" is currently selected
   */
  private isOriginalTextSelected(): boolean {
    return this.settings.dailyNotesAliasPresetId === 'original-text' && this.isOriginalTextAvailable();
  }

  /**
   * Parse NLP expression and update focused day
   * Returns parse result or null if parsing fails
   */
  parseNLPExpression(text: string): { date: DateTime; hasTime: boolean } | null {
    if (!text || !text.trim()) {
      this.nlpParsedDate = null;
      return null;
    }

    const parseResult = this.nlpService.parse(text.trim());
    if (!parseResult) {
      this.nlpParsedDate = null;
      return null;
    }

    // Store the NLP-parsed date for "Original Text" validation
    this.nlpParsedDate = parseResult.date.startOf('day');

    // Update focused day to parsed date
    this.setFocusedDay(parseResult.date);

    return parseResult;
  }

  /**
   * Select a specific date and execute action
   */
  async selectDate(date: DateTime): Promise<void> {
    // Persist action to settings
    this.settings.lastUsedAction = this.selectedAction;

    let result: string | null = null;

    switch (this.selectedAction) {
      case 'insert-text':
        // Format date as text with selected preset
        result = this.formatterService.formatWithPreset(date, this.selectedPreset);
        break;

      case 'insert-daily-note': {
        // Generate wikilink to daily note
        // Use original text as alias ONLY if:
        // 1. "original-text" is selected
        // 2. The selected date matches the NLP-parsed date
        const useOriginalText = this.isOriginalTextSelected() && this.canUseOriginalTextForDate(date);
        result = this.dailyNotesService.generateWikilink(date, {
          customAlias: useOriginalText ? this.getOriginalText() ?? undefined : undefined,
          presetId: useOriginalText ? undefined : this.selectedPreset.id,
        });
        // Optionally create note if setting enabled
        if (this.settings.dailyNotesCreateIfMissing) {
          await this.dailyNotesService.createDailyNote(date).catch(error => {
            console.error('Failed to create daily note:', error);
            new Notice('Failed to create daily note');
          });
        }
        break;
      }

      case 'open-daily-note':
        // Navigate to daily note (no text insertion)
        // Call onSelect BEFORE opening to allow cleanup of trigger characters
        this.onSelect(null, this.selectedAction);
        try {
          await this.dailyNotesService.openDailyNote(date);
        } catch (error) {
          // Show user-friendly error notice
          const message = error instanceof Error ? error.message : 'Failed to open daily note';
          new Notice(message);
        }
        return; // Early return to avoid calling onSelect again
    }

    this.onSelect(result, this.selectedAction);
  }

  /**
   * Select the currently focused day
   */
  async selectFocusedDay(): Promise<void> {
    await this.selectDate(this.focusedDay);
  }

  // ========================================
  // Modal lifecycle
  // ========================================

  onOpen(): void {
    this.renderModal();
    this.setupKeyboardNavigation();
  }

  onClose(): void {
    // Cleanup
    this.calendarGrid = null;
    this.monthYearEl = null;
    this.nlpInputEl = null;
    this.nlpPreviewEl = null;
    this.formatSelectorEl = null;
  }

  // ========================================
  // Rendering
  // ========================================

  private renderModal(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('unified-date-picker-modal');

    // Action selector
    this.renderActionSelector(contentEl);

    // NLP input (optional, inline)
    if (this.settings.enableNLP) {
      this.renderNLPInput(contentEl);
    }

    // Month/year navigation header
    this.renderHeader(contentEl);

    // Day labels (Mo Tu We...)
    this.renderDayLabels(contentEl);

    // Day grid
    this.renderDayGrid(contentEl);

    // Footer with format selector and "Today" button
    this.renderFooter(contentEl);
  }

  private renderActionSelector(container: HTMLElement): void {
    const actionBar = container.createDiv({ cls: 'action-selector' });

    const actions: Array<{ value: DateAction; label: string; icon: string }> = [
      { value: 'insert-text', label: 'Insert as Text', icon: '📝' },
      { value: 'insert-daily-note', label: 'Link to Daily Note', icon: '📅' },
      { value: 'open-daily-note', label: 'Open Daily Note', icon: '🔗' },
    ];

    actions.forEach(action => {
      const button = actionBar.createEl('button', {
        cls: 'action-button',
        text: `${action.icon} ${action.label}`,
      });

      if (action.value === this.selectedAction) {
        button.addClass('is-active');
      }

      button.addEventListener('click', () => {
        // Remove active class from all buttons
        actionBar.querySelectorAll('.action-button').forEach(btn => {
          btn.removeClass('is-active');
        });
        // Add active class to clicked button
        button.addClass('is-active');

        // Update selected action
        this.setSelectedAction(action.value);

        // Re-render modal to show/hide format selector
        this.renderModal();
      });
    });
  }

  private renderNLPInput(container: HTMLElement): void {
    const nlpContainer = container.createDiv({ cls: 'nlp-input-container' });

    new Setting(nlpContainer)
      .setName('Natural language')
      .setDesc('e.g., "tomorrow", "next Monday", "3 days ago"')
      .addText(text => {
        this.nlpInputEl = text.inputEl;
        text
          .setPlaceholder('tomorrow')
          .onChange(value => this.updateNLPPreview(value));

        // Restore NLP text (currentNLPText preserves user edits across re-renders)
        // Don't fall back to initialNLPText if user explicitly cleared the field
        const textToRestore = this.nlpTextWasCleared ? null : (this.currentNLPText || this.initialNLPText);
        if (textToRestore) {
          text.setValue(textToRestore);
          this.updateNLPPreview(textToRestore);
        }

        // Submit on Enter key
        this.nlpInputEl?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.selectFocusedDay().then(() => this.close()).catch(e => {
              console.error('Failed to select date:', e);
              new Notice('Failed to select date');
            });
          }
        });
      });

    // Preview
    this.nlpPreviewEl = nlpContainer.createDiv({ cls: 'nlp-preview' });
    this.nlpPreviewEl.setText('Enter a date expression to see preview');
    this.nlpPreviewEl.addClass('nlp-preview-empty');

    // Re-trigger NLP preview now that nlpPreviewEl exists
    // (the addText callback above runs before nlpPreviewEl is created)
    const textForPreview = this.nlpTextWasCleared ? null : (this.currentNLPText || this.initialNLPText);
    if (textForPreview) {
      this.updateNLPPreview(textForPreview);
    }
  }

  private updateNLPPreview(text: string): void {
    if (!this.nlpPreviewEl) return;

    // Update current NLP text for "Original Text" feature
    const trimmedText = text?.trim() || '';
    const previousHadText = !!this.currentNLPText;
    this.currentNLPText = trimmedText || null;
    const nowHasText = !!this.currentNLPText;

    // Track whether the user explicitly cleared the NLP field
    if (!nowHasText && previousHadText) {
      this.nlpTextWasCleared = true;
    } else if (nowHasText) {
      this.nlpTextWasCleared = false;
    }

    // If text availability changed, update the format selector
    if (previousHadText !== nowHasText) {
      this.updateFormatSelectorOptions();
    }

    if (!trimmedText) {
      this.nlpPreviewEl.setText('Enter a date expression to see preview');
      this.nlpPreviewEl.removeClass('nlp-preview-success', 'nlp-preview-error');
      this.nlpPreviewEl.addClass('nlp-preview-empty');
      return;
    }

    const parseResult = this.parseNLPExpression(text);

    if (!parseResult) {
      this.nlpPreviewEl.setText('⚠️  Could not parse date');
      this.nlpPreviewEl.removeClass('nlp-preview-success', 'nlp-preview-empty');
      this.nlpPreviewEl.addClass('nlp-preview-error');
      return;
    }

    // Show preview based on selected action
    let preview: string;
    if (this.selectedAction === 'insert-text') {
      preview = this.formatterService.formatWithPreset(parseResult.date, this.selectedPreset);
    } else if (this.selectedAction === 'insert-daily-note') {
      // Use original text as alias if "original-text" is selected
      const useOriginalText = this.isOriginalTextSelected();
      preview = this.dailyNotesService.generateWikilink(parseResult.date, {
        customAlias: useOriginalText ? this.getOriginalText() ?? undefined : undefined,
        presetId: useOriginalText ? undefined : this.selectedPreset.id,
      });
    } else {
      preview = `Open: ${this.formatterService.formatWithPreset(parseResult.date, this.selectedPreset)}`;
    }

    this.nlpPreviewEl.setText(`✓  ${preview}`);
    this.nlpPreviewEl.removeClass('nlp-preview-error', 'nlp-preview-empty');
    this.nlpPreviewEl.addClass('nlp-preview-success');

    // Re-render calendar to show updated focused day
    this.renderDayGrid(this.calendarGrid?.parentElement || this.contentEl);
    // Update month/year header in case viewMonth changed
    if (this.monthYearEl) {
      this.monthYearEl.setText(this.viewMonth.toLocaleString({ month: 'long', year: 'numeric' }));
    }
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'date-picker-header' });

    // Previous month button
    const prevButton = header.createEl('button', {
      cls: 'date-picker-nav-button',
      text: '‹',
    });
    prevButton.addEventListener('click', () => {
      this.navigateMonth('prev');
      this.renderModal();
    });

    // Month/year display
    this.monthYearEl = header.createDiv({ cls: 'date-picker-month-year' });
    const monthName = this.viewMonth.toLocaleString({ month: 'long', year: 'numeric' });
    this.monthYearEl.setText(monthName);

    // Next month button
    const nextButton = header.createEl('button', {
      cls: 'date-picker-nav-button',
      text: '›',
    });
    nextButton.addEventListener('click', () => {
      this.navigateMonth('next');
      this.renderModal();
    });
  }

  private renderDayLabels(container: HTMLElement): void {
    const dayLabels = container.createDiv({ cls: 'date-picker-day-labels' });

    const labels = getLocalizedDayLabels(this.formatterService.getLocale(), this.weekStart);
    labels.forEach(label => {
      dayLabels.createDiv({
        cls: 'date-picker-day-label',
        text: label,
      });
    });
  }

  private renderDayGrid(container: HTMLElement): void {
    // Remove existing grid if present
    if (this.calendarGrid) {
      this.calendarGrid.remove();
    }

    // Create new grid - insert BEFORE footer if it exists to maintain layout
    this.calendarGrid = createDiv({ cls: 'date-picker-day-grid' });
    if (this.footerEl && this.footerEl.parentElement === container) {
      container.insertBefore(this.calendarGrid, this.footerEl);
    } else {
      container.appendChild(this.calendarGrid);
    }
    const gridContainer = this.calendarGrid;

    const grid = calculateCalendarGrid(this.viewMonth, this.weekStart);

    grid.forEach(week => {
      week.forEach(day => {
        const dayEl = gridContainer.createDiv({ cls: 'date-picker-day' });
        dayEl.setText(String(day.day));

        // Apply classes for styling
        if (!this.isInViewMonth(day)) {
          dayEl.addClass('is-other-month');
        }
        if (isToday(day)) {
          dayEl.addClass('is-today');
        }
        if (isSameDay(day, this.focusedDay)) {
          dayEl.addClass('is-focused');
          dayEl.setAttribute('tabindex', '0');
        }

        // Click handler
        dayEl.addEventListener('click', () => {
          this.selectDate(day).then(() => this.close()).catch(e => {
            console.error('Failed to select date:', e);
            new Notice('Failed to select date');
          });
        });
      });
    });
  }

  private renderFooter(container: HTMLElement): void {
    this.footerEl = container.createDiv({ cls: 'date-picker-footer' });
    const footer = this.footerEl;

    // Format selector visible for "Insert as Text" and "Link to Daily Note"
    // Hidden only for "Open Daily Note" (no text insertion)
    if (this.selectedAction !== 'open-daily-note') {
      this.formatSelectorEl = footer.createEl('select', {
        cls: 'date-picker-format-selector',
      });

      const showOriginalTextOption = this.isOriginalTextAvailable();
      const isOriginalTextCurrentlySelected = this.isOriginalTextSelected();

      // Add "Original Text" option first if available (Daily Notes action with text)
      if (showOriginalTextOption && this.formatSelectorEl) {
        const text = this.getOriginalText();
        const originalTextLabel = text
          ? `Original Text (${text})`
          : 'Original Text';
        const option = this.formatSelectorEl.createEl('option', {
          value: 'original-text',
          text: originalTextLabel,
        });
        if (isOriginalTextCurrentlySelected) {
          option.selected = true;
        }
      }

      // Add format presets
      this.presets.forEach(preset => {
        const example = this.formatterService.getFormatExample(preset.format, this.focusedDay);
        if (!this.formatSelectorEl) return;

        const option = this.formatSelectorEl.createEl('option', {
          value: preset.id,
          text: `${preset.name} (${example})`,
        });

        // Select this preset if it matches and "original-text" is not selected
        if (preset.id === this.selectedPreset.id && !isOriginalTextCurrentlySelected) {
          option.selected = true;
        }
      });

      this.formatSelectorEl.addEventListener('change', () => {
        if (!this.formatSelectorEl) return;
        this.setSelectedPreset(this.formatSelectorEl.value);
        // Update NLP preview if active
        if (this.nlpInputEl?.value) {
          this.updateNLPPreview(this.nlpInputEl.value);
        }
      });
    } else {
      // For "Open Daily Note" action, hide format selector
      this.formatSelectorEl = null;
    }

    // Today button
    const todayButton = footer.createEl('button', {
      cls: 'date-picker-today-button',
      text: 'Today',
    });

    todayButton.addEventListener('click', () => {
      this.jumpToToday();
      this.renderModal();
    });
  }

  // ========================================
  // Keyboard navigation
  // ========================================

  private setupKeyboardNavigation(): void {
    this.scope.register([], 'ArrowRight', () => {
      this.navigateDay('next');
      this.renderModal();
      return false;
    });

    this.scope.register([], 'ArrowLeft', () => {
      this.navigateDay('prev');
      this.renderModal();
      return false;
    });

    this.scope.register([], 'ArrowDown', () => {
      this.navigateDay('down');
      this.renderModal();
      return false;
    });

    this.scope.register([], 'ArrowUp', () => {
      this.navigateDay('up');
      this.renderModal();
      return false;
    });

    this.scope.register([], 'Enter', () => {
      this.selectFocusedDay().then(() => this.close()).catch(e => {
        console.error('Failed to select date:', e);
        new Notice('Failed to select date');
      });
      return false;
    });

    this.scope.register([], 'PageDown', () => {
      this.navigateMonth('next');
      this.renderModal();
      return false;
    });

    this.scope.register([], 'PageUp', () => {
      this.navigateMonth('prev');
      this.renderModal();
      return false;
    });

    this.scope.register([], 'Home', () => {
      this.jumpToToday();
      this.renderModal();
      return false;
    });

    // macOS-friendly alternatives
    this.scope.register(['Mod'], 'ArrowDown', () => {
      this.navigateMonth('next');
      this.renderModal();
      return false;
    });

    this.scope.register(['Mod'], 'ArrowUp', () => {
      this.navigateMonth('prev');
      this.renderModal();
      return false;
    });

    // Year navigation
    this.scope.register(['Mod'], 'ArrowLeft', () => {
      this.navigateYear('prev');
      this.renderModal();
      return false;
    });

    this.scope.register(['Mod'], 'ArrowRight', () => {
      this.navigateYear('next');
      this.renderModal();
      return false;
    });

    // 'T' for Today (only if not typing in NLP field)
    this.scope.register([], 't', () => {
      // Don't trigger if NLP input has focus
      if (this.nlpInputEl && document.activeElement === this.nlpInputEl) {
        return true; // Let the keystroke pass through
      }
      this.jumpToToday();
      this.renderModal();
      return false;
    });
  }

  // ========================================
  // Utilities
  // ========================================

  /**
   * Update format selector dropdown to show examples with focused date
   */
  private updateFormatSelectorExamples(): void {
    if (!this.formatSelectorEl) return;

    // Update each option's text with new example based on focused date
    const options = this.formatSelectorEl.options;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const presetId = option.value;

      // Handle "Original Text" pseudo-preset
      if (presetId === 'original-text') {
        const text = this.getOriginalText();
        option.text = text ? `Original Text (${text})` : 'Original Text';
        continue;
      }

      const preset = this.presets.find(p => p.id === presetId);
      if (preset) {
        const example = this.formatterService.getFormatExample(preset.format, this.focusedDay);
        option.text = `${preset.name} (${example})`;
      }
    }
  }

  /**
   * Update format selector options when NLP text availability changes
   * Adds or removes "Original Text" option based on whether text is available
   * Also switches to the "with text" preset when text becomes available
   */
  private updateFormatSelectorOptions(): void {
    if (!this.formatSelectorEl) return;
    if (this.selectedAction === 'open-daily-note') return; // No format selector for this action

    const hasOriginalTextOption = this.formatSelectorEl.options[0]?.value === 'original-text';
    const shouldHaveOriginalTextOption = this.isOriginalTextAvailable();

    if (shouldHaveOriginalTextOption && !hasOriginalTextOption) {
      // Text just became available - add "Original Text" option at the beginning
      const text = this.getOriginalText();
      const originalTextLabel = text ? `Original Text (${text})` : 'Original Text';
      const option = document.createElement('option');
      option.value = 'original-text';
      option.text = originalTextLabel;

      this.formatSelectorEl.insertBefore(option, this.formatSelectorEl.options[0]);

      // Switch to the "with text" preset (dailyNotesAliasPresetId)
      // This could be "original-text" or any other preset configured by user
      const withTextPresetId = this.settings.dailyNotesAliasPresetId;
      if (withTextPresetId === 'original-text') {
        // Select the "Original Text" option we just added
        option.selected = true;
      } else {
        // Select the configured preset
        for (let i = 0; i < this.formatSelectorEl.options.length; i++) {
          if (this.formatSelectorEl.options[i].value === withTextPresetId) {
            this.formatSelectorEl.options[i].selected = true;
            break;
          }
        }
      }
    } else if (!shouldHaveOriginalTextOption && hasOriginalTextOption) {
      // Text no longer available - remove "Original Text" option
      this.formatSelectorEl.remove(0);

      // Switch to the fallback preset
      const fallbackPresetId = this.settings.dailyNotesAliasFallbackPresetId;
      for (let i = 0; i < this.formatSelectorEl.options.length; i++) {
        if (this.formatSelectorEl.options[i].value === fallbackPresetId) {
          this.formatSelectorEl.options[i].selected = true;
          break;
        }
      }
    } else if (shouldHaveOriginalTextOption && hasOriginalTextOption) {
      // Update the label with current text
      const text = this.getOriginalText();
      this.formatSelectorEl.options[0].text = text ? `Original Text (${text})` : 'Original Text';
    }
  }

  private isInViewMonth(date: DateTime): boolean {
    return date.month === this.viewMonth.month && date.year === this.viewMonth.year;
  }
}
