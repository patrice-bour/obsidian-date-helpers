/**
 * @jest-environment jsdom
 *
 * Creating, editing and deleting a format preset through the settings tab.
 *
 * The reading of a draft is pinned in `tests/unit/utils/preset-editing.test.ts`;
 * what is pinned here is what the tab does with the result — which presets it
 * will touch, and which it refuses.
 */

import { App } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettingTab } from '@/ui/settings-tab';
import { FormatPreset } from '@/types/format-preset';

describe('DateHelpersSettingTab — format presets', () => {
  let app: App;
  let plugin: DateHelpersPlugin;
  let tab: DateHelpersSettingTab;

  const presets = (): FormatPreset[] => plugin.settings.formatPresets;
  const byId = (id: string) => presets().find(preset => preset.id === id);

  beforeEach(async () => {
    app = createMockApp();
    plugin = new DateHelpersPlugin(app, {
      id: 'date-helpers',
      name: 'Date Helpers',
      author: 'test',
      version: '0.0.0',
      minAppVersion: '1.13.0',
      description: 'test',
    }) as typeof plugin;
    (plugin.loadData as jest.Mock).mockResolvedValue({});
    await plugin.onload();
    tab = new DateHelpersSettingTab(app, plugin);
  });

  describe('creating', () => {
    it('stores the format translated, whichever syntax was typed', async () => {
      await tab.savePreset({ name: 'Compact', format: 'YYYY-MM-DD', type: 'date' });

      const cree = presets().find(preset => preset.name === 'Compact');
      expect(cree?.format).toBe('yyyy-MM-dd');
      expect(cree?.builtin).toBe(false);
    });

    it('gives it an id built from its name', async () => {
      await tab.savePreset({ name: 'Compact date', format: 'yyyyMMdd', type: 'date' });

      expect(byId('user-compact-date')).toBeDefined();
    });

    it('stores nothing when the draft cannot be read', async () => {
      const avant = presets().length;

      await tab.savePreset({ name: 'Bancal', format: 'yyyy-VV-dd', type: 'date' });

      expect(presets()).toHaveLength(avant);
    });
  });

  describe('editing', () => {
    it('rewrites the preset in place, keeping its id', async () => {
      await tab.savePreset({ name: 'Compact', format: 'yyyyMMdd', type: 'date' });
      const cree = byId('user-compact') as FormatPreset;

      await tab.savePreset({ name: 'Compact', format: 'DD/MM/YYYY', type: 'date' }, cree);

      expect(byId('user-compact')?.format).toBe('dd/MM/yyyy');
      expect(presets().filter(preset => preset.name === 'Compact')).toHaveLength(1);
    });

    // The field is not in the draft, so an edit that carried a default for it
    // would unpin a preset the user had pinned — in silence, on a save they
    // asked for to change one letter of the format.
    it('leaves the popup pinning where the user put it', async () => {
      await tab.savePreset({ name: 'Compact', format: 'yyyyMMdd', type: 'date' });
      const cree = byId('user-compact') as FormatPreset;
      cree.showInSuggest = true;

      await tab.savePreset({ name: 'Compact', format: 'dd/MM/yyyy', type: 'date' }, cree);

      expect(byId('user-compact')?.showInSuggest).toBe(true);
      expect(byId('user-compact')?.format).toBe('dd/MM/yyyy');
    });

    // Changing the KIND of a referenced preset breaks the reference without
    // removing it: the validator only checks that the id exists, and the menu
    // that set it lists dates only — so the stored value stops appearing in the
    // very menu that chose it.
    it('refuses to change the kind of a preset something still names', async () => {
      await tab.savePreset({ name: 'Compact', format: 'yyyyMMdd', type: 'date' });
      plugin.settings.defaultDatePresetId = 'user-compact';
      const cree = byId('user-compact') as FormatPreset;

      await tab.savePreset({ name: 'Compact', format: 'HH:mm', type: 'time' }, cree);

      expect(byId('user-compact')?.type).toBe('date');
    });

    it('allows the kind to change while nothing names it', async () => {
      await tab.savePreset({ name: 'Compact', format: 'yyyyMMdd', type: 'date' });
      const cree = byId('user-compact') as FormatPreset;

      await tab.savePreset({ name: 'Compact', format: 'HH:mm', type: 'time' }, cree);

      expect(byId('user-compact')?.type).toBe('time');
    });

    // A built-in's format is shipped and re-applied on load, so an edit here
    // would be undone at the next start without a word.
    it('refuses to touch a built-in', async () => {
      const natif = presets().find(preset => preset.builtin) as FormatPreset;
      const avant = natif.format;

      await tab.savePreset({ name: 'Détourné', format: 'yyyyMMdd', type: 'date' }, natif);

      expect(byId(natif.id)?.format).toBe(avant);
      expect(byId(natif.id)?.name).toBeUndefined();
    });
  });

  describe('deleting', () => {
    it('removes a preset nothing names', async () => {
      await tab.savePreset({ name: 'Compact', format: 'yyyyMMdd', type: 'date' });

      await tab.removePreset(byId('user-compact') as FormatPreset);

      expect(byId('user-compact')).toBeUndefined();
    });

    it('refuses a built-in', async () => {
      const natif = presets().find(preset => preset.builtin) as FormatPreset;

      await tab.removePreset(natif);

      expect(byId(natif.id)).toBeDefined();
    });

    // One reference, not three: which ones block is decided by `blocksDeletion`
    // and pinned beside it. What is new here is only that `removePreset` asks.
    it('refuses a preset something still names', async () => {
      await tab.savePreset({ name: 'Compact', format: 'yyyyMMdd', type: 'date' });
      plugin.settings.defaultDatePresetId = 'user-compact';

      await tab.removePreset(byId('user-compact') as FormatPreset);

      expect(byId('user-compact')).toBeDefined();
    });
  });
});
