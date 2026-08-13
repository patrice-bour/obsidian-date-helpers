/**
 * @jest-environment jsdom
 *
 * Smoke tests for the decomposed settings tab: sections render in order,
 * controls persist to settings, re-display is safe.
 */

import { App } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettingTab } from '@/ui/settings-tab';

describe('DateHelpersSettingTab', () => {
  let app: App;
  let plugin: DateHelpersPlugin & { saveData: jest.Mock; loadData: jest.Mock };
  let tab: DateHelpersSettingTab;

  beforeEach(async () => {
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

    tab = new DateHelpersSettingTab(app, plugin);
  });

  it('renders the title and all six sections in order', () => {
    tab.display();
    const container = tab.containerEl as HTMLElement;

    const headings = Array.from(
      container.querySelectorAll('.setting-item-heading .setting-item-name')
    ).map(el => el.textContent);

    expect(headings[0]).toBe(plugin.i18n.t('settings.title'));
    const sectionOrder = [
      plugin.i18n.t('settings.sections.dailyNotes'),
      plugin.i18n.t('settings.sections.text'),
      plugin.i18n.t('settings.sections.general'),
      plugin.i18n.t('settings.sections.features'),
      plugin.i18n.t('settings.sections.triggers'),
      plugin.i18n.t('settings.sections.presets'),
    ];
    // Every section heading appears, in this relative order
    const indices = sectionOrder.map(name => headings.indexOf(name));
    expect(indices.every(i => i > 0)).toBe(true);
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it('preset dropdowns list presets as "Name (example)" with original-text first for the alias', () => {
    tab.display();
    const container = tab.containerEl as HTMLElement;

    const selects = container.querySelectorAll<HTMLSelectElement>('select');
    // First select = Daily Notes alias (with text): original-text first
    expect(selects[0].options[0].value).toBe('original-text');
    // Second select = fallback: presets only
    expect(selects[1].options[0].value).not.toBe('original-text');
    expect(selects[1].options[0].text).toMatch(/\(.+\)$/);
  });

  it('persists a toggle change through saveSettings', async () => {
    tab.display();
    const container = tab.containerEl as HTMLElement;
    plugin.saveData.mockClear();

    const firstToggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!firstToggle) throw new Error('no toggle rendered');

    // First checkbox is Daily Notes "create if missing"
    expect(plugin.settings.dailyNotesCreateIfMissing).toBe(false);
    firstToggle.checked = true;
    firstToggle.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(plugin.settings.dailyNotesCreateIfMissing).toBe(true);
    expect(plugin.saveData).toHaveBeenCalled();
  });

  it('persists a preset dropdown change to the matching setting', async () => {
    tab.display();
    const container = tab.containerEl as HTMLElement;

    const selects = container.querySelectorAll<HTMLSelectElement>('select');
    const fallbackSelect = selects[1];
    const newValue = fallbackSelect.options[0].value;

    fallbackSelect.value = newValue;
    fallbackSelect.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(plugin.settings.dailyNotesAliasFallbackPresetId).toBe(newValue);
  });

  it('hides NLP sub-settings when NLP is disabled and re-display is safe', () => {
    tab.display();
    const countWithNLP = (tab.containerEl as HTMLElement).querySelectorAll('.setting-item').length;

    plugin.settings.enableNLP = false;
    tab.display();
    const countWithoutNLP = (tab.containerEl as HTMLElement).querySelectorAll(
      '.setting-item'
    ).length;

    expect(countWithoutNLP).toBe(countWithNLP - 3); // auto-detect, strict mode, warning
  });

  it('flushes a pending locale when the tab is hidden, and leaves no timer behind', async () => {
    jest.useFakeTimers();
    try {
      tab.display();
      const container = tab.containerEl as HTMLElement;
      plugin.saveData.mockClear();

      const localeInput = container.querySelector<HTMLInputElement>('input[type="text"]');
      if (!localeInput) throw new Error('no locale input rendered');

      localeInput.value = 'de';
      localeInput.dispatchEvent(new Event('input'));

      // Obsidian calls hide() when the user switches to another settings tab —
      // an ordinary thing to do while typing. The entry must survive it.
      tab.hide();
      await Promise.resolve();

      expect(plugin.settings.locale).toBe('de');
      expect(plugin.saveData).toHaveBeenCalledTimes(1);

      // And nothing is left armed: the timer must not fire a second save
      // against a container that is being torn down.
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(plugin.saveData).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('discards a pending locale on re-render, without saving it twice', async () => {
    jest.useFakeTimers();
    try {
      tab.display();
      const container = tab.containerEl as HTMLElement;
      plugin.saveData.mockClear();

      const localeInput = container.querySelector<HTMLInputElement>('input[type="text"]');
      if (!localeInput) throw new Error('no locale input rendered');

      localeInput.value = 'de';
      localeInput.dispatchEvent(new Event('input'));

      // A re-render follows a save that already happened, so the in-flight
      // value is stale and must be dropped rather than flushed.
      tab.display();
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(plugin.saveData).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
