/**
 * @jest-environment jsdom
 *
 * Pins the declarative settings tab: the shape of the definition tree, the
 * persistence funnel, and the side effects dispatched on change.
 *
 * Definitions are plain data, so these assertions are about *what the tab
 * declares*. That the framework renders those declarations correctly is
 * Obsidian's contract, verified in the manual test plan — not here.
 */

import { App } from 'obsidian';
import type { SettingDefinitionList } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import {
  findControl,
  findGroup,
  flattenDefinitions,
  groupHeadings,
  isDisabled,
  isVisible,
} from '../../helpers/setting-definitions';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettingTab } from '@/ui/settings-tab';
import { LOCALE_REFRESH_DEBOUNCE_MS, MAX_TRIGGER_LENGTH } from '@/utils/constants';

/** Drain the microtask queue so post-await continuations have run. */
const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('DateHelpersSettingTab', () => {
  let app: App;
  let plugin: DateHelpersPlugin & { saveData: jest.Mock; loadData: jest.Mock };
  let tab: DateHelpersSettingTab;
  const t = (key: string): string => plugin.i18n.t(key as never);

  /**
   * `update()` and `refreshDomState()` belong to Obsidian, not to us: the mock
   * exposes them as spies so tests can assert *which* refresh path a change
   * takes, without asserting on what Obsidian draws.
   */
  const update = (): jest.Mock => tab.update as unknown as jest.Mock;
  const refreshDomState = (): jest.Mock => tab.refreshDomState as unknown as jest.Mock;

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
    plugin.loadData.mockResolvedValue({});
    await plugin.onload();

    tab = new DateHelpersSettingTab(app, plugin);
  });

  describe('definition tree', () => {
    it('declares the six sections in order', () => {
      expect(groupHeadings(tab.getSettingDefinitions())).toEqual([
        t('settings.sections.dailyNotes'),
        t('settings.sections.text'),
        t('settings.sections.general'),
        t('settings.sections.features'),
        t('settings.sections.triggers'),
        t('settings.sections.presets'),
      ]);
    });

    it('does not implement the deprecated display() hook', () => {
      // The whole point of the migration: display() is not called at all when
      // getSettingDefinitions() returns items, and its presence re-arms both
      // lint warnings.
      expect(Object.getOwnPropertyNames(DateHelpersSettingTab.prototype)).not.toContain('display');
    });

    it('binds every control to an existing settings key', () => {
      const keys = [
        'dailyNotesAliasPresetId',
        'dailyNotesAliasFallbackPresetId',
        'dailyNotesCreateIfMissing',
        'defaultDatePresetId',
        'defaultTimePresetId',
        'defaultDateTimePresetId',
        'locale',
        'weekStart',
        'enableDatePicker',
        'enableNLP',
        'nlpAutoDetectLanguage',
        'nlpStrictMode',
        'showParsingWarning',
      ];
      const definitions = tab.getSettingDefinitions();

      for (const key of keys) {
        expect(findControl(definitions, key).control.key).toBe(key);
        expect(plugin.settings).toHaveProperty(key);
      }
    });
  });

  describe('persistence funnel', () => {
    it('reads control values from the live settings object', () => {
      plugin.settings.locale = 'fr';
      expect(tab.getControlValue('locale')).toBe('fr');
    });

    it('persists through saveSettings, so services observe the change', async () => {
      // The inherited implementation writes with saveData(), which would skip
      // the locale propagation to i18n / date / formatter / NLP / Daily Notes.
      const saveSettings = jest.spyOn(plugin, 'saveSettings');

      await tab.setControlValue('enableDatePicker', false);

      expect(plugin.settings.enableDatePicker).toBe(false);
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    it('coerces the week-start dropdown string to a number', async () => {
      await tab.setControlValue('weekStart', '6');

      expect(plugin.settings.weekStart).toBe(6);
      expect(typeof plugin.settings.weekStart).toBe('number');
    });

    it('coerces the NLP mode dropdown string to a boolean', async () => {
      await tab.setControlValue('nlpStrictMode', 'true');
      expect(plugin.settings.nlpStrictMode).toBe(true);

      await tab.setControlValue('nlpStrictMode', 'false');
      expect(plugin.settings.nlpStrictMode).toBe(false);
    });

    it('stores an emptied locale field as "auto"', async () => {
      await tab.setControlValue('locale', '  ');
      expect(plugin.settings.locale).toBe('auto');
    });

    it('normalizes the locale it stores, not just the one it validates', async () => {
      // isAcceptedLocale() validates normalizeLocale(value), so `fr_CA` passes.
      // Storing it raw would hand `fr_CA` to Luxon, which throws on it: every
      // format example and every inserted date becomes "[Invalid format: …]"
      // until the next restart, where the loader normalizes it.
      await tab.setControlValue('locale', 'fr_CA');

      expect(plugin.settings.locale).toBe('fr-CA');
      expect(plugin.formatterService.getFormatExample('yyyy-MM-dd')).not.toMatch(/Invalid/);
    });

    it('refuses a key that is not a setting', async () => {
      await tab.setControlValue('totallyBogusKey', 'x');

      expect(plugin.settings).not.toHaveProperty('totallyBogusKey');
    });

    it('reads dropdown-backed values back as the strings their options use', () => {
      plugin.settings.weekStart = 6;
      plugin.settings.nlpStrictMode = true;

      // Dropdown controls are typed `SettingControlBase<string>`; returning a
      // number or a boolean happens to work only because the DOM stringifies.
      expect(tab.getControlValue('weekStart')).toBe('6');
      expect(tab.getControlValue('nlpStrictMode')).toBe('true');
    });

    it('restores the previous value when persisting throws', async () => {
      plugin.settings.enableDatePicker = true;
      jest.spyOn(plugin, 'saveSettings').mockRejectedValueOnce(new Error('disk full'));

      await expect(tab.setControlValue('enableDatePicker', false)).resolves.toBeUndefined();

      // Leaving the new value in memory while nothing reached disk makes the tab
      // disagree with both the services and data.json.
      expect(plugin.settings.enableDatePicker).toBe(true);
    });
  });

  describe('side effects', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('rebuilds the tab after a locale change, once the user stops typing', async () => {
      await tab.setControlValue('locale', 'fr');
      update().mockClear();

      jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS - 1);
      expect(update()).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(update()).toHaveBeenCalledTimes(1);
    });

    it('collapses rapid locale keystrokes into a single rebuild', async () => {
      await tab.setControlValue('locale', 'f');
      await tab.setControlValue('locale', 'fr');
      await tab.setControlValue('locale', 'fr-CA');
      update().mockClear();

      jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS * 2);

      expect(update()).toHaveBeenCalledTimes(1);
    });

    it('toggling NLP re-evaluates predicates in place, without a rebuild', async () => {
      update().mockClear();
      refreshDomState().mockClear();

      await tab.setControlValue('enableNLP', false);

      // A rebuild would steal focus from the toggle the user just clicked.
      expect(refreshDomState()).toHaveBeenCalledTimes(1);
      expect(update()).not.toHaveBeenCalled();
    });

    it('leaves ordinary settings alone', async () => {
      update().mockClear();
      refreshDomState().mockClear();

      await tab.setControlValue('showParsingWarning', false);
      jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS * 2);

      expect(update()).not.toHaveBeenCalled();
      expect(refreshDomState()).not.toHaveBeenCalled();
    });

    it('does not rebuild a tab that was hidden while a save was in flight', async () => {
      // clearLocaleRefresh() only cancels the timer. addTrigger/removeTrigger
      // call update() after an await, so hiding the tab mid-save leaves a
      // rebuild aimed at a container super.hide() has already torn down.
      jest.useRealTimers();
      plugin.settings.triggerCharacters = ['@@', '##'];
      const list = findGroup(tab.getSettingDefinitions(), t('settings.sections.triggers'));
      update().mockClear();

      (list as SettingDefinitionList).onDelete?.(0);
      tab.hide();
      await flush();

      expect(update()).not.toHaveBeenCalled();
    });

    it('disarms the pending rebuild when the tab is hidden', async () => {
      await tab.setControlValue('locale', 'de');
      update().mockClear();

      // Obsidian calls hide() whenever the user switches settings tab. The
      // value is already persisted, so dropping the timer costs nothing.
      tab.hide();
      jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS * 2);

      expect(update()).not.toHaveBeenCalled();
      expect(plugin.settings.locale).toBe('de');
    });
  });

  describe('locale validation', () => {
    const validate = (value: string): string | void | Promise<string | void> => {
      const control = findControl(tab.getSettingDefinitions(), 'locale').control;
      if (!control.validate) throw new Error('locale control declares no validate hook');
      return control.validate(value as never);
    };

    it.each(['auto', '', '  ', 'fr', 'en-GB'])('accepts %p', value => {
      expect(validate(value)).toBeUndefined();
    });

    // Validation is structural (BCP 47 shape, then a Luxon formatting probe),
    // inherited unchanged from the previous implementation: a well-formed but
    // unassigned code such as "zzz" is accepted, and that is not this change's
    // call to make.
    it.each(['e', 'not a locale', '123', 'fr-'])('rejects %p with a message', value => {
      expect(typeof validate(value)).toBe('string');
      expect(validate(value)).not.toBe('');
    });
  });

  describe('preset dropdowns', () => {
    it('offers the original-text option on the alias format only', () => {
      const definitions = tab.getSettingDefinitions();
      const alias = findControl(definitions, 'dailyNotesAliasPresetId').control;
      const fallback = findControl(definitions, 'dailyNotesAliasFallbackPresetId').control;

      if (alias.type !== 'dropdown' || fallback.type !== 'dropdown') {
        throw new Error('preset settings must be dropdowns');
      }
      expect(Object.keys(alias.options)[0]).toBe('original-text');
      expect(Object.keys(fallback.options)).not.toContain('original-text');
    });

    it('labels each preset with a rendered example', () => {
      const control = findControl(tab.getSettingDefinitions(), 'defaultDatePresetId').control;
      if (control.type !== 'dropdown') throw new Error('expected a dropdown');

      expect(Object.values(control.options).every(label => /\(.+\)$/.test(label))).toBe(true);
    });

    it('disables the dropdown when no preset of that type exists', () => {
      plugin.settings.formatPresets = [];

      const definition = findControl(tab.getSettingDefinitions(), 'defaultDatePresetId');
      const control = definition.control;
      if (control.type !== 'dropdown') throw new Error('expected a dropdown');

      expect(isDisabled(definition)).toBe(true);
      expect(Object.values(control.options)).toEqual([t('settings.text.noPresetsAvailable')]);
    });
  });

  describe('conditional NLP sub-settings', () => {
    const nlpSubSettings = ['nlpAutoDetectLanguage', 'nlpStrictMode', 'showParsingWarning'];

    it('shows them when NLP is enabled', () => {
      plugin.settings.enableNLP = true;
      const definitions = tab.getSettingDefinitions();

      for (const key of nlpSubSettings) {
        expect(isVisible(findControl(definitions, key))).toBe(true);
      }
    });

    it('hides them when NLP is disabled', () => {
      plugin.settings.enableNLP = false;
      const definitions = tab.getSettingDefinitions();

      for (const key of nlpSubSettings) {
        expect(isVisible(findControl(definitions, key))).toBe(false);
      }
    });

    it('re-evaluates the predicate against current state, not build-time state', () => {
      // The predicate must be a function closing over the settings object. A
      // boolean snapshot would freeze the answer at build time, and
      // refreshDomState() would have nothing to re-evaluate.
      plugin.settings.enableNLP = true;
      const definition = findControl(tab.getSettingDefinitions(), 'nlpStrictMode');

      plugin.settings.enableNLP = false;

      expect(isVisible(definition)).toBe(false);
    });
  });

  describe('section intro text', () => {
    it('renders section intros through a render callback, never an empty-name row', () => {
      // Obsidian renders nothing for a definition whose name is empty. The first
      // migration used one for every section intro, and six user-facing texts
      // silently disappeared — invisible to unit tests, which assert what is
      // declared rather than what gets drawn.
      const emptyNamed = flattenDefinitions(tab.getSettingDefinitions()).filter(
        item => 'name' in item && item.name === ''
      );

      expect(emptyNamed.length).toBeGreaterThan(0);
      for (const item of emptyNamed) {
        expect(typeof (item as { render?: unknown }).render).toBe('function');
      }
    });
  });

  describe('reference content', () => {
    it('keeps the read-only preset list out of settings search', () => {
      const group = findGroup(tab.getSettingDefinitions(), t('settings.sections.presets'));
      if (!group?.items) throw new Error('preset reference group not found');

      const searchable = group.items.filter(item => !('searchable' in item) || item.searchable);
      expect(searchable).toHaveLength(0);
    });
  });

  describe('trigger characters', () => {
    const triggerList = (): SettingDefinitionList => {
      const group = findGroup(tab.getSettingDefinitions(), t('settings.sections.triggers'));
      if (!group || group.type !== 'list') throw new Error('triggers must be a list definition');
      return group as SettingDefinitionList;
    };

    it('lists one item per configured trigger', () => {
      plugin.settings.triggerCharacters = ['@@', '//d'];

      const names = (triggerList().items ?? []).map(item => ('name' in item ? item.name : ''));
      expect(names).toEqual(['@@', '//d']);
    });

    it('offers an add affordance', () => {
      expect(triggerList().addItem).toBeDefined();
    });

    it('offers deletion when more than one trigger remains', () => {
      plugin.settings.triggerCharacters = ['@@', '//d'];
      expect(triggerList().onDelete).toBeDefined();
    });

    it('withholds deletion for the last remaining trigger', () => {
      // At least one trigger is required, so the affordance is absent rather
      // than present-and-failing.
      plugin.settings.triggerCharacters = ['@@'];
      expect(triggerList().onDelete).toBeUndefined();
    });

    it('shows the minimum-trigger explanation when only one remains', () => {
      plugin.settings.triggerCharacters = ['@@'];
      const items = triggerList().items ?? [];

      const explains = items.some(
        item => 'desc' in item && item.desc === t('settings.triggers.validation.minRequired')
      );
      expect(explains).toBe(true);
    });

    it('deletes the triggers the user pointed at, even when clicks outrun the rebuild', async () => {
      // The rendered rows keep their original indices until update() rebuilds
      // the tree, and that only happens after an await. A second click landing
      // in that window carries an index that no longer means what it meant.
      plugin.settings.triggerCharacters = ['@@', '##', '$$', '%%'];
      const list = triggerList();

      list.onDelete?.(0);
      list.onDelete?.(1);
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual(['$$', '%%']);
    });

    it('never empties the list, whatever the click sequence', async () => {
      // An empty list passes validateSettings on every later load, and main.ts
      // then skips registerTriggerCharacters — the picker stays dead until the
      // user notices and re-adds a trigger by hand.
      plugin.settings.triggerCharacters = ['@@', '##'];
      const list = triggerList();

      // Two *different* rows, both clicked before the rebuild. Resolving by
      // value is not enough here — each click names a trigger that really is
      // still in the list, so only a guard at the mutation point stops the
      // second one from emptying it.
      list.onDelete?.(0);
      list.onDelete?.(1);
      await flush();

      expect(plugin.settings.triggerCharacters.length).toBeGreaterThanOrEqual(1);
    });

    it('ignores a delete for a trigger that is already gone', async () => {
      plugin.settings.triggerCharacters = ['@@', '##', '$$'];
      const list = triggerList();

      list.onDelete?.(1);
      await flush();
      list.onDelete?.(1); // same stale row, clicked twice
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual(['@@', '$$']);
    });

    it('refuses an invalid trigger at the mutation point, not only in the dialog', async () => {
      plugin.settings.triggerCharacters = ['@@'];

      await tab.addTrigger('@@');
      await tab.addTrigger('');
      await tab.addTrigger('x'.repeat(MAX_TRIGGER_LENGTH + 1));

      expect(plugin.settings.triggerCharacters).toEqual(['@@']);
    });

    it('deletes the trigger at the given index and rebuilds', async () => {
      plugin.settings.triggerCharacters = ['@@', '//d', ';;'];
      const list = triggerList();
      update().mockClear();

      list.onDelete?.(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.settings.triggerCharacters).toEqual(['@@', ';;']);
      expect(update()).toHaveBeenCalled();
    });
  });
});
