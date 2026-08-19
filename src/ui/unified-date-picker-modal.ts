import { Modal, App, Notice } from 'obsidian';
import { DateTime } from 'luxon';
import { DateService } from '@/services/date-service';
import { FormatterService } from '@/services/formatter-service';
import { NLPService } from '@/services/nlp-service';
import { I18nService } from '@/services/i18n-service';
import { Translate } from '@/i18n/types';
import { DailyNotesService } from '@/services/daily-notes-service';
import { FormatPreset } from '@/types/format-preset';
import { DateHelpersSettings } from '@/types/settings';
import { isAliasSourceId } from '@/types/alias-source';
import { DateAction } from './date-picker/types';
import { DatePickerState } from './date-picker/date-picker-state';
import { registerDatePickerKeys } from './date-picker/keyboard-navigation';
import { executeDateAction } from './date-picker/action-executor';
import { renderActionSelector } from './date-picker/action-selector';
import { CalendarRenderer } from './date-picker/calendar-renderer';
import { NLPInputController } from './date-picker/nlp-input';
import { FormatSelector } from './date-picker/format-selector';

/**
 * Unified Date Picker Modal (Phase 7.2)
 *
 * Combines date picker, NLP input, and action selection into a single
 * interface. Pure orchestrator: all non-DOM state lives in
 * DatePickerState; rendering is delegated to the date-picker modules
 * (action selector, calendar, NLP input, format selector); date actions
 * run through the action executor. Modules never talk to each other —
 * this class mediates.
 *
 * Features:
 * - Action selector (insert text / insert daily note / open daily note)
 * - Inline NLP input field
 * - Calendar with keyboard navigation
 * - Format selector (always visible)
 * - Remembers last used action and format
 */
export class UnifiedDatePickerModal extends Modal {
  private formatterService: FormatterService;
  private nlpService: NLPService;
  private i18n: I18nService;
  private dailyNotesService: DailyNotesService;

  /**
   * The modal's only channel to i18n, handed to the renderers as well: each
   * resolves its labels on every render, so a locale change reaches the picker
   * without a plugin reload. Spreading the tuple is what keeps this a
   * `Translate`: a forwarder that drops the params no longer typechecks.
   */
  private translate: Translate = (key, ...params) => this.i18n.t(key, ...params);
  private settings: DateHelpersSettings;
  private onSelect: (result: string | null, action: DateAction) => void;

  // All non-DOM state (action, preset, calendar, NLP text tracking)
  private state: DatePickerState;

  // Renderers (each owns its DOM elements)
  private calendar: CalendarRenderer;
  private nlpInput: NLPInputController;
  private formatSelector: FormatSelector;
  private footerEl: HTMLElement | null = null;
  /** Pending initial focus. Cancelled on close so it cannot fire into a torn-down modal. */
  private focusTimer: number | null = null;

  constructor(
    app: App,
    dateService: DateService,
    formatterService: FormatterService,
    nlpService: NLPService,
    i18n: I18nService,
    dailyNotesService: DailyNotesService,
    presets: FormatPreset[],
    settings: DateHelpersSettings,
    onSelect: (result: string | null, action: DateAction) => void,
    saveSettings: () => Promise<void>,
    initialAction?: DateAction,
    initialNLPText?: string,
    selectionText?: string,
    openOnAction?: DateAction
  ) {
    super(app);

    this.formatterService = formatterService;
    this.nlpService = nlpService;
    this.i18n = i18n;
    this.dailyNotesService = dailyNotesService;
    this.settings = settings;
    this.onSelect = onSelect;

    this.state = new DatePickerState(presets, settings, dateService, saveSettings, {
      initialAction,
      initialNLPText,
      selectionText,
      openOnAction,
    });

    // The selection is an alias whether or not it parses. Parsing it decides
    // one thing only: which day the calendar opens on.
    if (this.state.selectionText) {
      const parsed = this.nlpService.parse(this.state.selectionText);
      this.state.setSelectionParseResult(parsed?.date ?? null);
      if (parsed) {
        this.state.setFocusedDay(parsed.date);
      }
    }

    this.calendar = new CalendarRenderer({
      state: this.state,
      formatterService,
      weekStart: settings.weekStart,
      onMonthNav: direction => {
        this.navigateMonth(direction);
        // Same as the keyboard path: a redraw rebuilds the scrolling grid with
        // scrollTop 0, so without this the target day can sit below the fold.
        this.renderModalAndFocusDay();
      },
      onDayPick: day => this.confirmSelection(day),
    });

    this.nlpInput = new NLPInputController({
      state: this.state,
      t: this.translate,
      onInput: value => this.updateNLPPreview(value),
      onSubmit: () => this.confirmSelection(),
    });

    this.formatSelector = new FormatSelector({
      state: this.state,
      t: this.translate,
      presets,
      settings,
      formatterService,
      onChange: presetId => {
        this.setSelectedPreset(presetId);
        // Update NLP preview if active
        if (this.nlpInput.inputEl?.value) {
          this.updateNLPPreview(this.nlpInput.inputEl.value);
        }
      },
    });
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Get currently selected action
   */
  getSelectedAction(): DateAction {
    return this.state.selectedAction;
  }

  /**
   * Set selected action
   */
  setSelectedAction(action: DateAction): void {
    const presetId = this.state.setSelectedAction(action);

    // Update format selector dropdown if it exists
    this.formatSelector.setValue(
      isAliasSourceId(presetId) ? presetId : this.state.selectedPreset.id
    );

    // Update NLP preview if active
    if (this.nlpInput.inputEl?.value) {
      this.updateNLPPreview(this.nlpInput.inputEl.value);
    }
  }

  /**
   * Get currently selected format preset
   */
  getSelectedPreset(): FormatPreset {
    return this.state.selectedPreset;
  }

  /**
   * Set selected preset by ID
   * Handles the text alias source pseudo-presets for Daily Notes actions
   */
  setSelectedPreset(presetId: string): void {
    this.state.setSelectedPreset(presetId);
  }

  /**
   * Get current view month
   */
  getViewMonth(): DateTime {
    return this.state.viewMonth;
  }

  /**
   * Set current view month
   */
  setViewMonth(month: DateTime): void {
    this.state.setViewMonth(month);
  }

  /**
   * Get currently focused day
   */
  getFocusedDay(): DateTime {
    return this.state.focusedDay;
  }

  /**
   * Set currently focused day
   */
  setFocusedDay(day: DateTime): void {
    this.state.setFocusedDay(day);
    // Update format selector examples to show focused date
    this.formatSelector.updateExamples();
  }

  /**
   * Navigate to next or previous month
   */
  navigateMonth(direction: 'next' | 'prev'): void {
    this.state.navigateMonth(direction);
  }

  /**
   * Navigate to next or previous year
   */
  navigateYear(direction: 'next' | 'prev'): void {
    this.state.navigateYear(direction);
  }

  /**
   * Navigate focused day
   */
  navigateDay(direction: 'next' | 'prev' | 'up' | 'down'): void {
    // Use setFocusedDay to trigger format selector update
    this.setFocusedDay(this.state.navigateDay(direction));
  }

  /**
   * Jump to today's date
   */
  jumpToToday(): void {
    // Use setFocusedDay to trigger format selector update
    this.setFocusedDay(this.state.today());
  }

  /**
   * Parse NLP expression and update focused day
   * Returns parse result or null if parsing fails
   */
  parseNLPExpression(text: string): { date: DateTime; hasTime: boolean } | null {
    if (!text || !text.trim()) {
      // An empty field has not been parsed — it has nothing to parse
      this.state.clearNLPParseResult();
      return null;
    }

    const parseResult = this.nlpService.parse(text.trim());
    if (!parseResult) {
      // Parsed, to no date: the text may still alias whatever day is confirmed
      this.state.setNLPParseResult(null);
      return null;
    }

    this.state.setNLPParseResult(parseResult.date);

    // Update focused day to parsed date
    this.setFocusedDay(parseResult.date);

    return parseResult;
  }

  /**
   * Select a specific date and execute action
   */
  async selectDate(date: DateTime): Promise<void> {
    await executeDateAction(date, {
      state: this.state,
      t: this.translate,
      formatterService: this.formatterService,
      dailyNotesService: this.dailyNotesService,
      settings: this.settings,
      onSelect: this.onSelect,
    });
  }

  /**
   * Select the currently focused day
   */
  async selectFocusedDay(): Promise<void> {
    await this.selectDate(this.state.focusedDay);
  }

  /**
   * Execute the action for a date (focused day by default), then close;
   * failures surface as a Notice
   */
  private confirmSelection(date: DateTime = this.state.focusedDay): void {
    this.selectDate(date)
      .then(() => this.close())
      .catch(e => {
        console.error('Failed to select date:', e);
        new Notice(this.translate('errors.selectFailed'));
      });
  }

  // ========================================
  // Modal lifecycle
  // ========================================

  onOpen(): void {
    this.renderModal();
    this.setupKeyboardNavigation();
    this.focusSelectedDay();
  }

  /**
   * Put the DOM focus on the selected day.
   *
   * The cell already carries `is-focused` and `tabindex="0"`, but nothing ever
   * focused it, so the browser left focus on the first focusable element of the
   * modal — an action-tab button. Enter there reaches a button whose click
   * handler re-renders the modal, and typing reaches nothing at all.
   *
   * Deferred by a turn: Obsidian focuses the modal itself after `onOpen()`
   * returns, and a synchronous call here is overwritten a moment later. Only on
   * open, too — the day grid is rebuilt on every keystroke in the NLP field
   * (`updateNLPPreview`), so focusing from the renderer would take focus away
   * from the field being typed into.
   */
  private focusSelectedDay(): void {
    this.focusTimer = window.setTimeout(() => {
      this.focusTimer = null;
      this.contentEl.querySelector<HTMLElement>('.date-picker-day.is-focused')?.focus();
    }, 0);
  }

  onClose(): void {
    if (this.focusTimer !== null) {
      window.clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    // Cleanup DOM references
    this.calendar.reset();
    this.nlpInput.reset();
    this.formatSelector.reset();
  }

  // ========================================
  // Rendering (orchestration)
  // ========================================

  private renderModal(): void {
    const { contentEl } = this;
    contentEl.empty();
    // On modalEl, not contentEl: contentEl *is* the `.modal-content`, so a
    // class placed there leaves `.unified-date-picker-modal .modal-content`
    // without a descendant to match.
    this.modalEl.addClass('unified-date-picker-modal');

    // Action selector
    renderActionSelector(
      contentEl,
      this.state.selectedAction,
      action => {
        this.setSelectedAction(action);
        // Re-render modal to show/hide format selector
        this.renderModal();
      },
      this.translate
    );

    // NLP input (optional, inline)
    if (this.settings.enableNLP) {
      this.nlpInput.render(contentEl);
    }

    // Month/year navigation header
    this.calendar.renderHeader(contentEl);

    // Day labels (Mo Tu We...)
    this.calendar.renderDayLabels(contentEl);

    // Day grid
    this.calendar.renderDayGrid(contentEl, this.footerEl);

    // Footer with format selector and "Today" button
    this.renderFooter(contentEl);
  }

  private renderFooter(container: HTMLElement): void {
    this.footerEl = container.createDiv({ cls: 'date-picker-footer' });
    const footer = this.footerEl;

    // Format selector visible for "Insert as Text" and "Link to Daily Note"
    // Hidden only for "Open Daily Note" (no text insertion)
    if (this.state.selectedAction !== 'open-daily-note') {
      this.formatSelector.render(footer);
    } else {
      this.formatSelector.reset();
    }

    // Today button
    const todayButton = footer.createEl('button', {
      cls: 'date-picker-today-button',
      text: this.translate('picker.today'),
    });

    todayButton.addEventListener('click', () => {
      this.jumpToToday();
      this.renderModalAndFocusDay();
    });
  }

  private updateNLPPreview(text: string): void {
    if (!this.nlpInput.hasPreview) return;

    // Track NLP text for the "Original Text" feature (explicit-clear semantics)
    const { trimmedText, availabilityChanged } = this.state.updateNLPText(text);

    // If text availability changed, update the format selector
    if (availabilityChanged) {
      this.formatSelector.syncOptions();
    }

    if (!trimmedText) {
      this.nlpInput.showEmpty();
      return;
    }

    const parseResult = this.parseNLPExpression(text);

    if (!parseResult) {
      this.nlpInput.showError();
      return;
    }

    // Show preview based on selected action
    let preview: string;
    if (this.state.selectedAction === 'insert-text') {
      preview = this.formatterService.formatWithPreset(parseResult.date, this.state.selectedPreset);
    } else if (this.state.selectedAction === 'insert-daily-note') {
      // The same resolution the executor will apply, so the preview cannot
      // promise an alias the insertion refuses.
      preview = this.dailyNotesService.generateWikilink(
        parseResult.date,
        this.state.aliasOptionsForDate(parseResult.date)
      );
    } else {
      preview = this.translate('picker.openPreview', {
        date: this.formatterService.formatWithPreset(parseResult.date, this.state.selectedPreset),
      });
    }

    this.nlpInput.showSuccess(preview);

    // Re-render calendar to show updated focused day
    this.calendar.renderDayGrid(this.calendar.grid?.parentElement || this.contentEl, this.footerEl);
    // Update month/year header in case viewMonth changed
    this.calendar.updateMonthYear();
  }

  // ========================================
  // Keyboard navigation
  // ========================================

  /**
   * Redraw, then put the DOM focus back on the day that now carries it.
   *
   * `renderModal()` rebuilds the grid, so the element holding the focus is
   * destroyed and the focus falls back to the modal. That was invisible while
   * the grid could not scroll; now that it can, a day moved out of view stays
   * out of view — `focus()` scrolls it back. Synchronous, unlike the deferred
   * focus on open: nothing competes for the focus here.
   *
   * A month or year move usually leaves no focused cell, since the focused day
   * does not follow the view — though one within six days of the boundary stays
   * rendered as an adjacent-month cell. The optional call absorbs both.
   */
  private renderModalAndFocusDay(): void {
    this.renderModal();
    this.contentEl.querySelector<HTMLElement>('.date-picker-day.is-focused')?.focus();
  }

  private setupKeyboardNavigation(): void {
    registerDatePickerKeys(this.scope, {
      onDayMove: direction => {
        this.navigateDay(direction);
        this.renderModalAndFocusDay();
      },
      onMonthMove: direction => {
        this.navigateMonth(direction);
        this.renderModalAndFocusDay();
      },
      onYearMove: direction => {
        this.navigateYear(direction);
        this.renderModalAndFocusDay();
      },
      onToday: () => {
        this.jumpToToday();
        this.renderModalAndFocusDay();
      },
      onConfirm: () => this.confirmSelection(),
      isTypingInNLP: () =>
        !!this.nlpInput.inputEl && activeDocument.activeElement === this.nlpInput.inputEl,
    });
  }
}
