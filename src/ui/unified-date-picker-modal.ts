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
import { renderActionSelector, ACTION_LABEL_KEYS } from './date-picker/action-selector';
import { CalendarRenderer } from './date-picker/calendar-renderer';
import { NLPInputController } from './date-picker/nlp-input';
import { FormatSelector } from './date-picker/format-selector';
import { activeOutput, OutputDeps } from './date-picker/output';

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
  /** The row under the expression: a failure on the left, the action on the right */
  private statusEl: HTMLElement | null = null;
  /**
   * The field holding the alias. It is where the result line used to be: the
   * selector labels now carry the preview, which is what frees this row to
   * become something the user can write in.
   */
  private aliasEl: HTMLInputElement | null = null;
  /**
   * What confirming would navigate to, on the one action that offers no
   * choice. The other two put their preview in the selector labels; this one
   * hides the selector, so without this line the footer would say nothing at
   * all about the day being confirmed.
   */
  private resultEl: HTMLElement | null = null;
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
    // two things: which day the calendar opens on, and what the expression
    // field shows.
    //
    // The field carries it because otherwise the move is unexplained — the
    // picker sat on tomorrow with an empty field and nothing saying why. A
    // selection that parses to nothing stays out of the field: it is not an
    // expression, and putting it there would state a failure the user did not
    // cause. An expression handed over from the popup wins: the user typed it
    // after making the selection, so it is the later word.
    if (this.state.selectionText) {
      const parsed = this.nlpService.parse(this.state.selectionText);
      this.state.setSelectionParseResult(parsed?.date ?? null);
      if (parsed) {
        this.state.setFocusedDay(parsed.date);
        if (!initialNLPText) this.state.updateNLPText(this.state.selectionText);
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
      dailyNotesService,
      onChange: presetId => {
        this.setSelectedPreset(presetId);
        // Which output is active decides whether the alias plays a part, so
        // the field follows every pick — greyed or back, never overwritten.
        this.syncAliasField();
        this.formatSelector.updateExamples();
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
    // The day is half of what the alias field's state depends on: a calendar
    // move can drop the expression, and with it the text the field held.
    this.syncAliasField();
    this.updateResultLine();
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
    this.focusOnOpen();
  }

  /**
   * Put the DOM focus where the picker expects to be used from.
   *
   * The expression is the fastest path in, so the field takes the focus and an
   * expression carried in from the popup can be corrected without a click. With
   * NLP off there is no field, and the day cell keeps the focus it had.
   *
   * The caret goes after the carried text rather than selecting it: the user
   * came here to amend that expression, not to overwrite it with the next
   * keystroke.
   */
  private focusOnOpen(): void {
    const input = this.nlpInput.inputEl;
    if (!this.settings.enableNLP || !input) {
      this.focusSelectedDay();
      return;
    }
    this.focusTimer = window.setTimeout(() => {
      this.focusTimer = null;
      input.focus();
      const fin = input.value.length;
      input.setSelectionRange(fin, fin);
    }, 0);
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
    // Every DOM reference, not only the ones held by a controller: the three
    // below were left pointing at a detached tree, which is what "cleanup"
    // claimed not to do.
    this.calendar.reset();
    this.nlpInput.reset();
    this.formatSelector.reset();
    this.footerEl = null;
    this.statusEl = null;
    this.aliasEl = null;
    this.resultEl = null;
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

    // The expression first, the tabs beside it: typing is the fast path, and
    // the tabs only say what to do with what was typed.
    const topRow = contentEl.createDiv({ cls: 'date-picker-top' });

    if (this.settings.enableNLP) {
      this.nlpInput.render(topRow);
    }

    renderActionSelector(
      topRow,
      this.state.selectedAction,
      action => {
        this.setSelectedAction(action);
        // Re-render modal to show/hide format selector
        this.renderModal();
      },
      this.translate
    );

    this.renderStatusRow(contentEl);

    // Month/year navigation header
    this.calendar.renderHeader(contentEl);

    // Day labels (Mo Tu We...)
    this.calendar.renderDayLabels(contentEl);

    // Day grid
    this.calendar.renderDayGrid(contentEl, this.footerEl);

    // Footer with format selector and "Today" button
    this.renderFooter(contentEl);

    // Last, once the status row and the result line exist: they are what the
    // field drives, and reading it any earlier wrote into elements that were
    // not built yet.
    const porte = this.nlpInput.inputEl?.value;
    if (porte) this.updateNLPPreview(porte);
  }

  /**
   * The row under the expression: what failed, and what is armed.
   *
   * The resolved date is deliberately absent. The calendar shows the month and
   * marks the day, so naming it here would say it twice. A parse failure is the
   * one thing the calendar cannot show, so it is the one thing said in words —
   * and only then.
   */
  private renderStatusRow(container: HTMLElement): void {
    this.statusEl = container.createDiv({ cls: 'date-picker-status' });
    this.statusEl.createSpan({
      cls: 'date-picker-status-action',
      text: this.translate(ACTION_LABEL_KEYS[this.state.selectedAction]),
    });
  }

  /** Say, or stop saying, that the expression resolves to nothing */
  private showParseFailure(failed: boolean): void {
    // The field carries the failure too. A line under a field of the ordinary
    // colour reads as a remark about the calendar; the border is what ties the
    // words to the control that caused them.
    this.nlpInput.inputEl?.classList.toggle('is-error', failed);

    const status = this.statusEl;
    if (!status) return;
    status.querySelector('.date-picker-status-error')?.remove();
    if (!failed) return;
    // Built on the row, then moved to its head: `createSpan` is a global
    // Obsidian adds to the document, and the row is the only handle we hold.
    const error = status.createSpan({
      cls: 'date-picker-status-error',
      text: this.translate('picker.nlp.previewError'),
    });
    status.prepend(error);
  }

  private renderFooter(container: HTMLElement): void {
    this.footerEl = container.createDiv({ cls: 'date-picker-footer' });
    const footer = this.footerEl;

    // The alias, pinned above the actions and open to the keyboard. Built
    // first so it stays above the action row; removed and rebuilt from there
    // as the text and the active output come and go.
    this.renderAliasField();

    // Rebuilt or dropped with the footer: keeping a reference to the detached
    // one would leave `updateResultLine` writing into a tree nobody sees.
    this.resultEl = null;
    if (this.state.selectedAction === 'open-daily-note') {
      this.resultEl = footer.createDiv({ cls: 'date-picker-result' });
      this.updateResultLine();
    }

    const actions = footer.createDiv({ cls: 'date-picker-actions' });

    // Format selector visible for "Insert as Text" and "Link to Daily Note"
    // Hidden only for "Open Daily Note" (no text insertion)
    if (this.state.selectedAction !== 'open-daily-note') {
      this.formatSelector.render(actions);
    } else {
      this.formatSelector.reset();
    }

    // Today button
    const todayButton = actions.createEl('button', {
      cls: 'date-picker-today-button',
      text: this.translate('picker.today'),
    });

    todayButton.addEventListener('click', () => {
      this.jumpToToday();
      this.renderModalAndFocusDay();
    });

    // The pointer's way to confirm. ENTER stays the primary path and needs no
    // focus on this button.
    const insertButton = actions.createEl('button', {
      cls: 'date-picker-insert-button mod-cta',
      text: this.translate('picker.insert'),
    });
    insertButton.addEventListener('click', () => this.confirmSelection());
  }

  /** What the output builders need: one description, two callers */
  private outputDeps(): OutputDeps {
    return {
      state: this.state,
      formatterService: this.formatterService,
      dailyNotesService: this.dailyNotesService,
      t: this.translate,
    };
  }

  /** Say what confirming would navigate to, for the day currently focused */
  private updateResultLine(): void {
    if (!this.resultEl) return;
    this.resultEl.setText(activeOutput(this.state.focusedDay, this.outputDeps()));
  }

  /**
   * Build the alias field, when there is an alias to show.
   *
   * The text comes from the state, never from the element being replaced: a
   * redraw rebuilds this row, and reading the old input would lose the edit
   * exactly once — on the keystroke that caused the redraw.
   */
  private renderAliasField(): void {
    const footer = this.footerEl;
    if (!footer || !this.state.hasAliasField()) return;

    const field = footer.createEl('input', { cls: 'date-picker-alias' });
    field.type = 'text';
    field.value = this.state.heldAliasText() ?? '';
    field.disabled = !this.state.aliasFieldEnabled();
    field.setAttribute('aria-label', this.translate('picker.alias.label'));
    field.placeholder = this.translate('picker.alias.placeholder');
    this.aliasEl = field;

    field.addEventListener('input', () => {
      this.state.setEditedAlias(field.value);
      // The labels are the preview, and the alias is inside every one of them
      // on this action.
      this.formatSelector.updateExamples();
    });

    // Enter belongs to the modal scope, which confirms; the field must not
    // swallow it on its way there.
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmSelection();
      }
    });

    // The row belongs above the actions, and the actions may already be there
    // when this runs from `syncAliasField`.
    const actions = footer.querySelector('.date-picker-actions');
    if (actions) footer.insertBefore(field, actions);
  }

  /**
   * Bring the field in, take it away, or update what it shows.
   *
   * Called wherever the alias, the active output or the focused day changes.
   * The DOM focus is left alone: this runs on every keystroke in the field
   * itself, and rebuilding it there would move the caret to the end of the
   * text on every letter.
   */
  private syncAliasField(): void {
    if (!this.footerEl) return;

    if (!this.state.hasAliasField()) {
      this.aliasEl?.remove();
      this.aliasEl = null;
      return;
    }

    if (!this.aliasEl) {
      this.renderAliasField();
      return;
    }

    this.aliasEl.disabled = !this.state.aliasFieldEnabled();
    const held = this.state.heldAliasText() ?? '';
    // Only when it differs: an identical write still sends the caret to the end
    // in a real browser (jsdom does not, so no unit test can witness this).
    //
    // No path reaches here while the field holds the focus today — every caller
    // is a keystroke in the expression, a pick in the selector, or a calendar
    // move, and the arrows belong to this field once it has the focus. The
    // guard is a defence against the next caller, not a live mechanism.
    if (this.aliasEl.value !== held) this.aliasEl.value = held;
  }

  private updateNLPPreview(text: string): void {
    // No field on screen, nothing to read from it.
    if (!this.nlpInput.inputEl) return;

    // Track NLP text for the "Original Text" feature (explicit-clear semantics)
    this.state.updateNLPText(text);

    // Every keystroke, not only the one that made the text appear. The gate on
    // `availabilityChanged` left the option labelled with the first character
    // ever typed — `Typed text (n)` for `next frday`. `syncOptions` relabels
    // and only re-picks a value when the list itself changed.
    this.formatSelector.syncOptions();

    const trimmedText = text?.trim() || '';
    if (!trimmedText) {
      this.showParseFailure(false);
      this.syncAliasField();
      return;
    }

    const parseResult = this.parseNLPExpression(text);

    if (!parseResult) {
      this.showParseFailure(true);
      // Confirming here still inserts the focused day, aliased with the text
      // that failed to parse — so the field must hold it, and the labels must
      // say it. `syncOptions` ran BEFORE the parser, when nothing was known
      // about this text yet, so its labels showed the fallback; only now can
      // they be right.
      this.formatSelector.updateExamples();
      this.syncAliasField();
      return;
    }

    this.showParseFailure(false);
    // `parseNLPExpression` went through `setFocusedDay`, which has already
    // relabelled the selector and synced the field against the new day.

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

  /**
   * The picker's text field holding the DOM focus, if any.
   *
   * Two of them now: the expression and the alias. Every guard in the keymap
   * asks the same question of both — an arrow, a `Home`, a `t` typed into
   * either one belongs to that field, not to the calendar.
   */
  private focusedTextField(): HTMLInputElement | null {
    const focused = activeDocument.activeElement;
    if (this.nlpInput.inputEl && focused === this.nlpInput.inputEl) return this.nlpInput.inputEl;
    if (this.aliasEl && focused === this.aliasEl) return this.aliasEl;
    return null;
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
      isTypingInField: () => !!this.focusedTextField(),
      isEditingFieldText: () => {
        const champ = this.focusedTextField();
        if (!champ) return false;
        // The alias field claims the keys as soon as it holds the focus, empty
        // or not. The empty-field rule exists because the picker OPENS on the
        // expression field, and yielding there would leave the calendar
        // unreachable; nothing ever opens on this one. Emptying it is what a
        // user does to rewrite the alias — and an arrow there used to clear the
        // expression, drop the field and move the focus, all in one keystroke.
        if (champ === this.aliasEl) return true;
        return champ.value.length > 0;
      },
    });
  }
}
