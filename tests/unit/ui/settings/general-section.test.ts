/**
 * @jest-environment jsdom
 *
 * Pins the locale debounce timer contract of the general settings section.
 *
 * These exist because the section swapped `activeWindow.setTimeout/clearTimeout`
 * for `window.*`, and nothing covered that path. `activeWindow` resolves to
 * whichever window holds focus when it is read, so a timer armed against one
 * window and cleared against another is never cancelled — the failure only shows
 * up across a focus change, which is exactly what the last test reproduces.
 */

import { App } from 'obsidian';
import { createMockApp } from '../../../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { renderGeneralSection } from '@/ui/settings/sections/general-section';
import { SettingsSectionContext } from '@/ui/settings/section-context';
import { LOCALE_INPUT_DEBOUNCE_MS } from '@/utils/constants';

describe('renderGeneralSection — locale debounce', () => {
  let app: App;
  let plugin: DateHelpersPlugin & { saveData: jest.Mock; loadData: jest.Mock };
  let containerEl: HTMLElement;
  let ctx: SettingsSectionContext;
  let refresh: jest.Mock;

  /** Drive the locale text field the way a user typing into it would. */
  const typeLocale = (value: string): void => {
    const input = containerEl.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    app = createMockApp();

    plugin = new DateHelpersPlugin(app, {
      id: 'date-helpers',
      name: 'Date Helpers',
      author: 'test',
      version: '0.0.0',
      minAppVersion: '1.5.0',
      description: 'test',
    }) as typeof plugin;
    plugin.loadData.mockResolvedValue({});
    await plugin.onload();

    refresh = jest.fn();
    containerEl = document.createElement('div');
    ctx = {
      plugin,
      t: (key: string) => key,
      refresh,
    } as unknown as SettingsSectionContext;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not save before the debounce elapses', () => {
    renderGeneralSection(containerEl, ctx);
    plugin.saveData.mockClear();

    typeLocale('fr');
    jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS - 1);

    expect(plugin.saveData).not.toHaveBeenCalled();
  });

  it('saves the locale once the debounce elapses', async () => {
    renderGeneralSection(containerEl, ctx);
    plugin.saveData.mockClear();

    typeLocale('fr');
    jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS);
    await Promise.resolve();

    expect(plugin.settings.locale).toBe('fr');
    expect(plugin.saveData).toHaveBeenCalled();
  });

  it('collapses rapid keystrokes into a single save', async () => {
    renderGeneralSection(containerEl, ctx);
    plugin.saveData.mockClear();

    typeLocale('f');
    jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS - 10);
    typeLocale('fr');
    jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS);
    await Promise.resolve();

    expect(plugin.saveData).toHaveBeenCalledTimes(1);
    expect(plugin.settings.locale).toBe('fr');
  });

  it('cancels a pending save when the section is disposed', async () => {
    const dispose = renderGeneralSection(containerEl, ctx);
    plugin.saveData.mockClear();

    typeLocale('de');
    dispose();
    jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS * 2);
    await Promise.resolve();

    expect(plugin.saveData).not.toHaveBeenCalled();
  });

  it('still cancels a pending save when the focused window changes first', async () => {
    const dispose = renderGeneralSection(containerEl, ctx);
    plugin.saveData.mockClear();

    typeLocale('de');

    // Simulate the user moving focus to another Obsidian window between arming
    // and clearing. `activeWindow` follows focus, so a section that armed and
    // cleared through it would target two different windows and leak the timer.
    const otherWindow = {
      setTimeout: jest.fn(),
      clearTimeout: jest.fn(),
    };
    // Capture the descriptor, not the value: the mock installs `activeWindow` as
    // a getter, and restoring a plain value would quietly turn it into a data
    // property for every later test in the process.
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'activeWindow');
    Object.defineProperty(globalThis, 'activeWindow', {
      value: otherWindow,
      configurable: true,
      writable: true,
    });

    try {
      dispose();
      jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS * 2);
      await Promise.resolve();
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, 'activeWindow', previous);
      } else {
        delete (globalThis as unknown as { activeWindow?: unknown }).activeWindow;
      }
    }

    expect(otherWindow.clearTimeout).not.toHaveBeenCalled();
    expect(plugin.saveData).not.toHaveBeenCalled();
  });

  it('does not refresh after teardown when a save was already in flight', async () => {
    // clearTimeout is a no-op on a timer that already fired, so the callback can
    // sit suspended inside saveSettings() when the section is disposed. Without a
    // disposed guard it resumes afterwards and refreshes a container that is gone.
    let releaseSave: (() => void) | undefined;
    const saveInFlight = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    jest.spyOn(plugin, 'saveSettings').mockImplementation(() => saveInFlight);

    const dispose = renderGeneralSection(containerEl, ctx);
    refresh.mockClear();

    typeLocale('fr');
    jest.advanceTimersByTime(LOCALE_INPUT_DEBOUNCE_MS);
    await Promise.resolve(); // the callback is now parked on saveSettings()

    dispose();
    releaseSave?.();
    await saveInFlight;
    await Promise.resolve();

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('renderGeneralSection — rendering', () => {
  it('renders both controls', () => {
    const app = createMockApp();
    const containerEl = document.createElement('div');
    const ctx = {
      plugin: { settings: { locale: 'auto', weekStart: 1 }, app },
      t: (key: string) => key,
      refresh: jest.fn(),
    } as unknown as SettingsSectionContext;

    renderGeneralSection(containerEl, ctx);

    expect(containerEl.querySelectorAll('input[type="text"]')).toHaveLength(1);
    expect(containerEl.querySelectorAll('select')).toHaveLength(1);
  });
});
