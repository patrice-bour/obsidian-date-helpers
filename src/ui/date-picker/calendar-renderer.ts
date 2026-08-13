import { DateTime } from 'luxon';
import { FormatterService } from '@/services/formatter-service';
import { WeekStart } from '@/utils/constants';
import {
  calculateCalendarGrid,
  getLocalizedDayLabels,
  isToday,
  isSameDay,
} from '@/utils/calendar-grid';
import { DatePickerState } from './date-picker-state';

export interface CalendarRendererDeps {
  state: DatePickerState;
  formatterService: FormatterService;
  weekStart: WeekStart;
  /** Header ‹/› buttons */
  onMonthNav(direction: 'next' | 'prev'): void;
  /** Click on a day cell */
  onDayPick(day: DateTime): void;
}

/**
 * Renders the calendar parts of the date picker: month/year header with
 * navigation buttons, localized day labels, and the 42-cell day grid
 * (with the footer-aware insertBefore re-render logic).
 */
export class CalendarRenderer {
  private monthYearEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;

  constructor(private deps: CalendarRendererDeps) {}

  renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'date-picker-header' });

    // Previous month button
    const prevButton = header.createEl('button', {
      cls: 'date-picker-nav-button',
      text: '‹',
    });
    prevButton.addEventListener('click', () => this.deps.onMonthNav('prev'));

    // Month/year display
    this.monthYearEl = header.createDiv({ cls: 'date-picker-month-year' });
    this.updateMonthYear();

    // Next month button
    const nextButton = header.createEl('button', {
      cls: 'date-picker-nav-button',
      text: '›',
    });
    nextButton.addEventListener('click', () => this.deps.onMonthNav('next'));
  }

  renderDayLabels(container: HTMLElement): void {
    const dayLabels = container.createDiv({ cls: 'date-picker-day-labels' });

    const labels = getLocalizedDayLabels(
      this.deps.formatterService.getLocale(),
      this.deps.weekStart
    );
    labels.forEach(label => {
      dayLabels.createDiv({
        cls: 'date-picker-day-label',
        text: label,
      });
    });
  }

  /**
   * (Re-)render the day grid. On re-render, the new grid is inserted
   * BEFORE the footer (when present in the same container) to keep the
   * layout stable.
   */
  renderDayGrid(container: HTMLElement, footerEl: HTMLElement | null): void {
    // Remove existing grid if present
    if (this.gridEl) {
      this.gridEl.remove();
    }

    // Create new grid - insert BEFORE footer if it exists to maintain layout
    this.gridEl = createDiv({ cls: 'date-picker-day-grid' });
    if (footerEl && footerEl.parentElement === container) {
      container.insertBefore(this.gridEl, footerEl);
    } else {
      container.appendChild(this.gridEl);
    }
    const gridContainer = this.gridEl;

    const grid = calculateCalendarGrid(this.deps.state.viewMonth, this.deps.weekStart);

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
        if (isSameDay(day, this.deps.state.focusedDay)) {
          dayEl.addClass('is-focused');
          dayEl.setAttribute('tabindex', '0');
        }

        // Click handler
        dayEl.addEventListener('click', () => this.deps.onDayPick(day));
      });
    });
  }

  /**
   * Refresh the month/year header text from state
   */
  updateMonthYear(): void {
    if (this.monthYearEl) {
      this.monthYearEl.setText(
        this.deps.state.viewMonth.toLocaleString({ month: 'long', year: 'numeric' })
      );
    }
  }

  get grid(): HTMLElement | null {
    return this.gridEl;
  }

  /**
   * Drop DOM references (modal close)
   */
  reset(): void {
    this.monthYearEl = null;
    this.gridEl = null;
  }

  private isInViewMonth(date: DateTime): boolean {
    return (
      date.month === this.deps.state.viewMonth.month && date.year === this.deps.state.viewMonth.year
    );
  }
}
