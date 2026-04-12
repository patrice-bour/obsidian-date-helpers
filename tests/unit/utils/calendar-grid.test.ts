import { DateTime } from 'luxon';
import {
  calculateCalendarGrid,
  getLocalizedDayLabels,
  isToday,
  isSameDay,
  isInMonth,
} from '@/utils/calendar-grid';

describe('calculateCalendarGrid', () => {
  describe('Grid structure', () => {
    it('should return 6 weeks (42 days)', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1); // Monday start

      expect(grid).toHaveLength(6);
      grid.forEach(week => {
        expect(week).toHaveLength(7);
      });
    });

    it('should return DateTime objects for all days', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      grid.forEach(week => {
        week.forEach(day => {
          expect(day).toBeInstanceOf(DateTime);
          expect(day.isValid).toBe(true);
        });
      });
    });
  });

  describe('Week start: Monday (1)', () => {
    it('should start grid on Monday for November 2025', () => {
      // November 2025 starts on Saturday
      // Grid with Monday start should begin on Oct 27 (Monday)
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const firstDay = grid[0][0];
      expect(firstDay.year).toBe(2025);
      expect(firstDay.month).toBe(10); // October
      expect(firstDay.day).toBe(27);
      expect(firstDay.weekday).toBe(1); // Monday
    });

    it('should end grid on Sunday', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const lastDay = grid[5][6];
      expect(lastDay.weekday).toBe(7); // Sunday (Luxon uses 1-7)
    });

    it('should include first day of month in grid', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const nov1 = allDays.find(d => d.month === 11 && d.day === 1);

      expect(nov1).toBeDefined();
      expect(nov1?.year).toBe(2025);
    });

    it('should include last day of month in grid', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const nov30 = allDays.find(d => d.month === 11 && d.day === 30);

      expect(nov30).toBeDefined();
      expect(nov30?.year).toBe(2025);
    });
  });

  describe('Week start: Sunday (0)', () => {
    it('should start grid on Sunday for November 2025', () => {
      // November 2025 starts on Saturday
      // Grid with Sunday start should begin on Oct 26 (Sunday)
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 0);

      const firstDay = grid[0][0];
      expect(firstDay.year).toBe(2025);
      expect(firstDay.month).toBe(10); // October
      expect(firstDay.day).toBe(26);
      expect(firstDay.weekday).toBe(7); // Sunday in Luxon is 7
    });

    it('should end grid on Saturday', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 0);

      const lastDay = grid[5][6];
      expect(lastDay.weekday).toBe(6); // Saturday
    });
  });

  describe('Week start: Saturday (6)', () => {
    it('should start grid on Saturday for November 2025', () => {
      // November 2025 starts on Saturday (Nov 1 is Saturday)
      // Grid should begin on Nov 1 itself
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 6);

      const firstDay = grid[0][0];
      expect(firstDay.year).toBe(2025);
      expect(firstDay.month).toBe(11); // November
      expect(firstDay.day).toBe(1);
      expect(firstDay.weekday).toBe(6); // Saturday
    });

    it('should end grid on Friday', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 6);

      const lastDay = grid[5][6];
      expect(lastDay.weekday).toBe(5); // Friday
    });
  });

  describe('Month boundaries', () => {
    it('should handle January (month with 31 days)', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 1, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const jan31 = allDays.find(d => d.month === 1 && d.day === 31);

      expect(jan31).toBeDefined();
    });

    it('should handle February in non-leap year (28 days)', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 2, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const feb28 = allDays.find(d => d.month === 2 && d.day === 28);
      const feb29 = allDays.find(d => d.month === 2 && d.day === 29);

      expect(feb28).toBeDefined();
      expect(feb29).toBeUndefined();
    });

    it('should handle February in leap year (29 days)', () => {
      const monthStart = DateTime.fromObject({ year: 2024, month: 2, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const feb29 = allDays.find(d => d.month === 2 && d.day === 29);

      expect(feb29).toBeDefined();
      expect(feb29?.year).toBe(2024);
    });

    it('should handle April (month with 30 days)', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 4, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const apr30 = allDays.find(d => d.month === 4 && d.day === 30);
      const apr31 = allDays.find(d => d.month === 4 && d.day === 31);

      expect(apr30).toBeDefined();
      expect(apr31).toBeUndefined();
    });
  });

  describe('Overflow days', () => {
    it('should include days from previous month when needed', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      // First row should have some October days
      const firstWeek = grid[0];
      const octoberDays = firstWeek.filter(d => d.month === 10);

      expect(octoberDays.length).toBeGreaterThan(0);
    });

    it('should include days from next month when needed', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      // Last row should have some December days
      const lastWeek = grid[5];
      const decemberDays = lastWeek.filter(d => d.month === 12);

      expect(decemberDays.length).toBeGreaterThan(0);
    });

    it('should have consecutive dates with no gaps', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();

      for (let i = 0; i < allDays.length - 1; i++) {
        const currentDay = allDays[i];
        const nextDay = allDays[i + 1];

        const diff = nextDay.diff(currentDay, 'days').days;
        expect(diff).toBe(1);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle month that starts on Monday with Monday start', () => {
      // March 2027 starts on Monday
      const monthStart = DateTime.fromObject({ year: 2027, month: 3, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const firstDay = grid[0][0];
      expect(firstDay.month).toBe(3);
      expect(firstDay.day).toBe(1);
    });

    it('should handle month that starts on Sunday with Sunday start', () => {
      // August 2027 starts on Sunday
      const monthStart = DateTime.fromObject({ year: 2027, month: 8, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 0);

      const firstDay = grid[0][0];
      expect(firstDay.month).toBe(8);
      expect(firstDay.day).toBe(1);
    });

    it('should handle year transitions (December to January)', () => {
      const monthStart = DateTime.fromObject({ year: 2025, month: 12, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const januaryDays = allDays.filter(d => d.year === 2026 && d.month === 1);

      expect(januaryDays.length).toBeGreaterThan(0);
    });

    it('should handle year transitions (January to previous December)', () => {
      const monthStart = DateTime.fromObject({ year: 2026, month: 1, day: 1 });
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      const decemberDays = allDays.filter(d => d.year === 2025 && d.month === 12);

      expect(decemberDays.length).toBeGreaterThan(0);
    });
  });

  describe('Locale consistency', () => {
    it('should preserve locale from input DateTime', () => {
      const monthStart = DateTime.fromObject(
        { year: 2025, month: 11, day: 1 },
        { locale: 'fr-FR' }
      );
      const grid = calculateCalendarGrid(monthStart, 1);

      const allDays = grid.flat();
      allDays.forEach(day => {
        expect(day.locale).toBe('fr-FR');
      });
    });

    it('should work with different locales', () => {
      const monthStartUS = DateTime.fromObject(
        { year: 2025, month: 11, day: 1 },
        { locale: 'en-US' }
      );
      const monthStartFR = DateTime.fromObject(
        { year: 2025, month: 11, day: 1 },
        { locale: 'fr-FR' }
      );

      const gridUS = calculateCalendarGrid(monthStartUS, 0); // Sunday start (US)
      const gridFR = calculateCalendarGrid(monthStartFR, 1); // Monday start (FR)

      expect(gridUS[0][0].locale).toBe('en-US');
      expect(gridFR[0][0].locale).toBe('fr-FR');
    });
  });

  describe('getLocalizedDayLabels', () => {
    it('should return 7 day labels', () => {
      const labels = getLocalizedDayLabels('en-US', 1);
      expect(labels).toHaveLength(7);
    });

    it('should start with Monday when weekStart is 1', () => {
      const labels = getLocalizedDayLabels('en-US', 1);
      expect(labels[0]).toMatch(/^M/i); // Monday
      expect(labels[6]).toMatch(/^S/i); // Sunday
    });

    it('should start with Sunday when weekStart is 0', () => {
      const labels = getLocalizedDayLabels('en-US', 0);
      expect(labels[0]).toMatch(/^S/i); // Sunday
      expect(labels[6]).toMatch(/^S/i); // Saturday
    });

    it('should start with Saturday when weekStart is 6', () => {
      const labels = getLocalizedDayLabels('en-US', 6);
      expect(labels[0]).toMatch(/^S/i); // Saturday
      expect(labels[6]).toMatch(/^F/i); // Friday
    });

    it('should respect locale for day names', () => {
      const labelsEN = getLocalizedDayLabels('en-US', 1);
      const labelsFR = getLocalizedDayLabels('fr-FR', 1);

      // Monday should be different in English vs French
      expect(labelsEN[0]).not.toBe(labelsFR[0]);
      // French Monday starts with L (Lundi)
      expect(labelsFR[0]).toMatch(/^L/i);
    });

    it('should return short day labels (2-3 characters)', () => {
      const labels = getLocalizedDayLabels('en-US', 1);
      labels.forEach(label => {
        expect(label.length).toBeGreaterThanOrEqual(1);
        expect(label.length).toBeLessThanOrEqual(3);
      });
    });

    it('should handle German locale', () => {
      const labels = getLocalizedDayLabels('de-DE', 1);
      expect(labels).toHaveLength(7);
      // German Monday starts with M (Montag)
      expect(labels[0]).toMatch(/^M/i);
    });

    it('should handle Japanese locale', () => {
      const labels = getLocalizedDayLabels('ja-JP', 1);
      expect(labels).toHaveLength(7);
      // Japanese uses different characters
      expect(labels[0]).toBeTruthy();
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = DateTime.now().startOf('day');
      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = DateTime.now().minus({ days: 1 }).startOf('day');
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = DateTime.now().plus({ days: 1 }).startOf('day');
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should return true for today at different times', () => {
      const todayMorning = DateTime.now().set({ hour: 9, minute: 0 });
      const todayEvening = DateTime.now().set({ hour: 20, minute: 30 });
      expect(isToday(todayMorning)).toBe(true);
      expect(isToday(todayEvening)).toBe(true);
    });

    it('should handle dates without time component', () => {
      const todayNoTime = DateTime.now().startOf('day');
      expect(isToday(todayNoTime)).toBe(true);
    });

    it('should return false for dates in different months', () => {
      const lastMonth = DateTime.now().minus({ months: 1 });
      const nextMonth = DateTime.now().plus({ months: 1 });
      expect(isToday(lastMonth)).toBe(false);
      expect(isToday(nextMonth)).toBe(false);
    });

    it('should return false for dates in different years', () => {
      const lastYear = DateTime.now().minus({ years: 1 });
      const nextYear = DateTime.now().plus({ years: 1 });
      expect(isToday(lastYear)).toBe(false);
      expect(isToday(nextYear)).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day at different times', () => {
      const morning = DateTime.fromObject({ year: 2025, month: 11, day: 4, hour: 9 });
      const evening = DateTime.fromObject({ year: 2025, month: 11, day: 4, hour: 20 });
      expect(isSameDay(morning, evening)).toBe(true);
    });

    it('should return false for different days', () => {
      const day1 = DateTime.fromObject({ year: 2025, month: 11, day: 4 });
      const day2 = DateTime.fromObject({ year: 2025, month: 11, day: 5 });
      expect(isSameDay(day1, day2)).toBe(false);
    });

    it('should return false for same day number in different months', () => {
      const nov4 = DateTime.fromObject({ year: 2025, month: 11, day: 4 });
      const dec4 = DateTime.fromObject({ year: 2025, month: 12, day: 4 });
      expect(isSameDay(nov4, dec4)).toBe(false);
    });

    it('should return false for same day and month in different years', () => {
      const nov4_2025 = DateTime.fromObject({ year: 2025, month: 11, day: 4 });
      const nov4_2026 = DateTime.fromObject({ year: 2026, month: 11, day: 4 });
      expect(isSameDay(nov4_2025, nov4_2026)).toBe(false);
    });

    it('should return true for identical DateTime objects', () => {
      const date1 = DateTime.fromObject({ year: 2025, month: 11, day: 4, hour: 15, minute: 30 });
      const date2 = DateTime.fromObject({ year: 2025, month: 11, day: 4, hour: 15, minute: 30 });
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should handle dates at midnight', () => {
      const date1 = DateTime.fromObject({ year: 2025, month: 11, day: 4, hour: 0, minute: 0 });
      const date2 = DateTime.fromObject({ year: 2025, month: 11, day: 4, hour: 23, minute: 59 });
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return true when comparing date with itself', () => {
      const date = DateTime.fromObject({ year: 2025, month: 11, day: 4 });
      expect(isSameDay(date, date)).toBe(true);
    });
  });

  describe('isInMonth', () => {
    it('should return true for date in specified month', () => {
      const date = DateTime.fromObject({ year: 2025, month: 11, day: 15 });
      expect(isInMonth(date, 11, 2025)).toBe(true);
    });

    it('should return false for date in different month', () => {
      const date = DateTime.fromObject({ year: 2025, month: 10, day: 31 });
      expect(isInMonth(date, 11, 2025)).toBe(false);
    });

    it('should return false for date in same month but different year', () => {
      const date = DateTime.fromObject({ year: 2024, month: 11, day: 15 });
      expect(isInMonth(date, 11, 2025)).toBe(false);
    });

    it('should handle first day of month', () => {
      const date = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
      expect(isInMonth(date, 11, 2025)).toBe(true);
    });

    it('should handle last day of month', () => {
      const date = DateTime.fromObject({ year: 2025, month: 11, day: 30 });
      expect(isInMonth(date, 11, 2025)).toBe(true);
    });

    it('should handle February in leap year', () => {
      const date = DateTime.fromObject({ year: 2024, month: 2, day: 29 });
      expect(isInMonth(date, 2, 2024)).toBe(true);
    });

    it('should return false for invalid date combinations', () => {
      const date = DateTime.fromObject({ year: 2025, month: 12, day: 25 });
      expect(isInMonth(date, 1, 2025)).toBe(false);
    });

    it('should handle dates with time components', () => {
      const date = DateTime.fromObject({ year: 2025, month: 11, day: 15, hour: 14, minute: 30 });
      expect(isInMonth(date, 11, 2025)).toBe(true);
    });
  });
});
