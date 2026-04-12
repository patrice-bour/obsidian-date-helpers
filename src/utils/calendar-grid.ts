import { DateTime } from 'luxon';

/**
 * Calculate the days to display in a month view calendar grid.
 * Returns 6 weeks (42 days) to ensure consistent grid size.
 * Includes overflow days from previous and next months to fill the grid.
 *
 * @param monthStart - DateTime representing the first day of the month to display
 * @param weekStart - First day of week (0 = Sunday, 1 = Monday, 6 = Saturday)
 * @returns 2D array of DateTimes representing 6 weeks × 7 days
 *
 * @example
 * ```typescript
 * const nov2025 = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
 * const grid = calculateCalendarGrid(nov2025, 1); // Monday start
 * // Returns grid starting Oct 27 (Monday) through Dec 7 (Sunday)
 * ```
 */
export function calculateCalendarGrid(
  monthStart: DateTime,
  weekStart: 0 | 1 | 6
): DateTime[][] {
  const grid: DateTime[][] = [];

  // Get first day of month (ensure it's at start of day)
  let currentDay = monthStart.startOf('day');

  // Calculate how many days to backfill from previous month
  // Luxon weekday: Monday=1, Tuesday=2, ..., Sunday=7
  // We need to convert to 0-6 range where our weekStart is the reference
  const firstDayWeekday = currentDay.weekday;

  // Convert Luxon weekday (1-7) to 0-6 (where Sunday=0, Monday=1, etc.)
  const firstDayOfWeek = firstDayWeekday === 7 ? 0 : firstDayWeekday;

  // Calculate days to backfill
  // If weekStart is 1 (Monday) and first day is 6 (Saturday), we need 5 days back
  // If weekStart is 0 (Sunday) and first day is 6 (Saturday), we need 6 days back
  const daysToBackfill = (firstDayOfWeek - weekStart + 7) % 7;

  // Move back to the start of the calendar grid
  currentDay = currentDay.minus({ days: daysToBackfill });

  // Generate 6 weeks (42 days)
  for (let week = 0; week < 6; week++) {
    const weekDays: DateTime[] = [];
    for (let day = 0; day < 7; day++) {
      weekDays.push(currentDay);
      currentDay = currentDay.plus({ days: 1 });
    }
    grid.push(weekDays);
  }

  return grid;
}

/**
 * Get localized day labels for calendar header.
 * Returns array of abbreviated day names starting with weekStart day.
 *
 * @param locale - Locale string (e.g., 'en-US', 'fr-FR')
 * @param weekStart - First day of week (0 = Sunday, 1 = Monday, 6 = Saturday)
 * @returns Array of 7 day labels (e.g., ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
 *
 * @example
 * ```typescript
 * getLocalizedDayLabels('en-US', 1); // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
 * getLocalizedDayLabels('fr-FR', 1); // ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
 * ```
 */
export function getLocalizedDayLabels(
  locale: string,
  weekStart: 0 | 1 | 6
): string[] {
  const labels: string[] = [];

  // Start from a known Monday (Jan 6, 2025 is a Monday)
  let day = DateTime.fromObject({ year: 2025, month: 1, day: 6 }, { locale });

  // Adjust to start from weekStart
  // If weekStart is 0 (Sunday), we need to go back 1 day
  // If weekStart is 1 (Monday), we're already there
  // If weekStart is 6 (Saturday), we need to go back 2 days
  const daysToGoBack = (1 - weekStart + 7) % 7;
  day = day.minus({ days: daysToGoBack });

  // Get 7 day labels
  for (let i = 0; i < 7; i++) {
    // Use short format (e.g., 'Mon', 'Tue', etc.)
    labels.push(day.toFormat('ccc'));
    day = day.plus({ days: 1 });
  }

  return labels;
}

/**
 * Check if a date is in the given month.
 *
 * @param date - DateTime to check
 * @param month - Month number (1-12)
 * @param year - Year number
 * @returns True if date is in the specified month
 */
export function isInMonth(date: DateTime, month: number, year: number): boolean {
  return date.month === month && date.year === year;
}

/**
 * Check if a date is today.
 *
 * @param date - DateTime to check
 * @returns True if date is today
 */
export function isToday(date: DateTime): boolean {
  const today = DateTime.now().startOf('day');
  const checkDate = date.startOf('day');
  return checkDate.equals(today);
}

/**
 * Check if two dates are the same day.
 *
 * @param date1 - First DateTime
 * @param date2 - Second DateTime
 * @returns True if both dates represent the same day
 */
export function isSameDay(date1: DateTime, date2: DateTime): boolean {
  return (
    date1.year === date2.year &&
    date1.month === date2.month &&
    date1.day === date2.day
  );
}
