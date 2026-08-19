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

import { App, Setting } from 'obsidian';
import { Modal } from '../../mocks/obsidian';
import type { SettingDefinitionGroup, SettingDefinitionList } from 'obsidian';
import { createMockApp } from '../../helpers/mock-app';
import {
  findControl,
  findGroup,
  findList,
  flattenDefinitions,
  groupHeadings,
  isDisabled,
  isVisible,
} from '../../helpers/setting-definitions';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettingTab } from '@/ui/settings-tab';
import { LOCALE_REFRESH_DEBOUNCE_MS, MAX_TRIGGER_LENGTH } from '@/utils/constants';
import { TriggerConfig } from '@/types/settings';
import { translateByName } from '../../helpers/translate';

/** A trigger opening the modal picker */
const picker = (sequence: string): TriggerConfig => ({ sequence, mode: 'picker' });
/** A trigger opening the inline suggestion popup */
const inline = (sequence: string): TriggerConfig => ({ sequence, mode: 'inline' });

/**
 * A row that draws itself: the description rows a section emits around its
 * list, and the trigger rows inside it. The `render` callback is what separates
 * them from the declarative controls and the groups beside them.
 */
type RenderRow = { render: (setting: unknown) => void };
const isRenderRow = <T>(item: T): item is T & RenderRow =>
  typeof (item as RenderRow | undefined)?.render === 'function';

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
  // Lazy: `plugin` is assigned in `beforeEach`, well after this line runs.
  const t = (key: string): string => translateByName(plugin.i18n)(key);

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
        'locale',
        'weekStart',
        'enableDatePicker',
        'enableNLP',
        'nlpAutoDetectLanguage',
        'nlpStrictMode',
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

      // Must be a key that still exists: setControlValue returns early on an
      // unknown one, which would make the assertions below true by vacuity.
      // A dropdown always hands over a string, so 'true' is the real path.
      await tab.setControlValue('nlpStrictMode', 'true');
      jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS * 2);

      expect(plugin.settings.nlpStrictMode).toBe(true);
      expect(update()).not.toHaveBeenCalled();
      expect(refreshDomState()).not.toHaveBeenCalled();
    });

    it('does not rebuild a tab disposed while a save was in flight', async () => {
      // clearLocaleRefresh() only cancels the timer. addTrigger/removeTrigger
      // call update() after an await, so unloading the plugin mid-save leaves a
      // rebuild that would read services onunload has already torn down.
      //
      // The guard is against unload, not against being hidden: a hidden tab is
      // still live, and Obsidian documents update() as the call a tab makes
      // when its data changes, on screen or not.
      jest.useRealTimers();
      plugin.settings.triggerCharacters = [picker('@@'), picker('##')];
      const list = findList(tab.getSettingDefinitions());
      update().mockClear();

      (list as SettingDefinitionList).onDelete?.(0);
      tab.dispose();
      await flush();

      expect(update()).not.toHaveBeenCalled();
    });

    it('keeps the pending rebuild when the tab is hidden', async () => {
      await tab.setControlValue('locale', 'de');
      update().mockClear();

      // Obsidian calls hide() whenever the user switches settings tab or closes
      // the window. Dropping the timer here reads as harmless — the value is
      // already persisted — but the display is what the rebuild was for, and
      // nothing else will run it: the definitions Obsidian renders on the next
      // open are the ones `update()` last stored. Closing the window inside the
      // debounce would otherwise leave the tab in the previous language for the
      // rest of the session.
      tab.hide();
      jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS * 2);

      expect(update()).toHaveBeenCalled();
      expect(plugin.settings.locale).toBe('de');
    });

    /**
     * The tab outlives being hidden. Obsidian calls `hide()` every time the
     * user closes settings or switches tab, but for a declarative tab it never
     * calls `getSettingDefinitions()` again: `display()` — the hook that would
     * trigger it — is documented as *not called* while `getSettingDefinitions()`
     * returns a non-empty array. Anything `hide()` latches is therefore latched
     * for the rest of the session, and every later rebuild is silently dropped.
     *
     * No re-display hook is invoked between the two halves of these tests on
     * purpose: calling `getSettingDefinitions()` here would paper over exactly
     * the bug they pin.
     */
    describe('after the tab has been hidden', () => {
      it('still rebuilds when a trigger is added', async () => {
        jest.useRealTimers();
        tab.hide();
        update().mockClear();

        await tab.addTrigger(inline('//d'));

        expect(plugin.settings.triggerCharacters).toContainEqual(inline('//d'));
        expect(update()).toHaveBeenCalled();
      });

      it('still rebuilds when a trigger is removed', async () => {
        jest.useRealTimers();
        plugin.settings.triggerCharacters = [picker('@@'), picker('##')];
        tab.hide();
        update().mockClear();

        await tab.removeTrigger('##');

        expect(plugin.settings.triggerCharacters).not.toContainEqual(picker('##'));
        expect(update()).toHaveBeenCalled();
      });

      it('still rebuilds when the locale changes', async () => {
        tab.hide();
        await tab.setControlValue('locale', 'de');
        update().mockClear();

        jest.advanceTimersByTime(LOCALE_REFRESH_DEBOUNCE_MS * 2);

        expect(update()).toHaveBeenCalled();
      });
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

  describe('pinned presets for the inline suggest', () => {
    /** The rows of the format-preset reference section that carry a toggle */
    function pinRows() {
      return flattenDefinitions(tab.getSettingDefinitions()).filter(
        (item): item is typeof item & { render: (setting: unknown) => void } =>
          'render' in item && typeof (item as { render?: unknown }).render === 'function'
      );
    }

    /** Render every preset row into a container and return its checkboxes */
    function renderPresetToggles(): HTMLInputElement[] {
      const container = document.createElement('div');
      document.body.appendChild(container);
      for (const row of pinRows()) {
        row.render(new Setting(container) as never);
      }
      return Array.from(container.querySelectorAll('input[type="checkbox"]'));
    }

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('gives every date and datetime preset a toggle, reflecting its stored state', () => {
      const pinnable = plugin.settings.formatPresets.filter(preset => preset.type !== 'time');
      const toggles = renderPresetToggles();

      expect(toggles).toHaveLength(pinnable.length);
      pinnable.forEach((preset, i) => {
        expect(toggles[i].checked).toBe(preset.showInSuggest === true);
      });
    });

    it('saves the flag with the preset when toggled', async () => {
      const pinnable = plugin.settings.formatPresets.filter(preset => preset.type !== 'time');
      const target = pinnable[0];
      const before = target.showInSuggest === true;

      const toggles = renderPresetToggles();
      toggles[0].checked = !before;
      toggles[0].dispatchEvent(new Event('change'));
      await flush();

      const stored = plugin.settings.formatPresets.find(preset => preset.id === target.id);
      expect(stored?.showInSuggest).toBe(!before);
      expect(plugin.saveData).toHaveBeenCalled();
    });

    it('leaves the preset order alone when the pinned set changes', async () => {
      const orderBefore = plugin.settings.formatPresets.map(preset => preset.id);

      const toggles = renderPresetToggles();
      toggles[0].checked = !toggles[0].checked;
      toggles[0].dispatchEvent(new Event('change'));
      await flush();

      expect(plugin.settings.formatPresets.map(preset => preset.id)).toEqual(orderBefore);
    });
  });

  describe('preset dropdowns', () => {
    it('offers both text alias sources on the alias format only', () => {
      const definitions = tab.getSettingDefinitions();
      const alias = findControl(definitions, 'dailyNotesAliasPresetId').control;
      const fallback = findControl(definitions, 'dailyNotesAliasFallbackPresetId').control;

      if (alias.type !== 'dropdown' || fallback.type !== 'dropdown') {
        throw new Error('preset settings must be dropdowns');
      }
      expect(Object.keys(alias.options).slice(0, 2)).toEqual(['selected-text', 'typed-text']);
      expect(alias.options['selected-text']).toBe('Selected text');
      expect(alias.options['typed-text']).toBe('Typed text');

      expect(Object.keys(fallback.options)).not.toContain('selected-text');
      expect(Object.keys(fallback.options)).not.toContain('typed-text');
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
    const nlpSubSettings = ['nlpAutoDetectLanguage', 'nlpStrictMode'];

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
    it('renders a preset row with its label, description and example', () => {
      const group = findGroup(tab.getSettingDefinitions(), t('settings.sections.presets'));
      const row = group?.items?.find(item => 'name' in item && item.name === 'ISO 8601');

      // The row is one interpolated translation. A context that dropped the
      // params would leave {{desc}} and {{example}} on screen, which no
      // assertion on the key alone would catch.
      expect(row).toBeDefined();
      expect((row as { desc: string }).desc).toBe(
        `Standard ISO format → Example: ${plugin.formatterService.getFormatExample('yyyy-MM-dd')}`
      );
    });

    it('labels the presets in the active locale', async () => {
      plugin.settings.locale = 'fr';
      await plugin.saveSettings();

      const group = findGroup(tab.getSettingDefinitions(), t('settings.sections.presets'));
      const names = (group?.items ?? []).map(item => ('name' in item ? item.name : ''));

      expect(names).toContain('Date courte');
      expect(names).not.toContain('Locale short');
    });

    it('keeps the read-only preset list out of settings search', () => {
      const group = findGroup(tab.getSettingDefinitions(), t('settings.sections.presets'));
      if (!group?.items) throw new Error('preset reference group not found');

      const searchable = group.items.filter(item => !('searchable' in item) || item.searchable);
      expect(searchable).toHaveLength(0);
    });
  });

  describe('trigger characters', () => {
    const triggerList = (): SettingDefinitionList => findList(tab.getSettingDefinitions());

    /** The group carrying the section heading, its prose, and the add button. */
    const triggerGroup = (): SettingDefinitionGroup => {
      const group = findGroup(tab.getSettingDefinitions(), t('settings.sections.triggers'));
      if (!group || group.type !== 'group') throw new Error('the triggers section has no group');
      return group;
    };

    /**
     * The add affordance, rendered. It rides the group's header rather than the
     * list: the list's own header is empty now that the title sits on the
     * group, and a `+` alone in it belongs to nothing. Reaching it means running
     * the `extraButtons` callback the group declares.
     */
    const addButton = (): HTMLElement => {
      const [declare] = triggerGroup().extraButtons ?? [];
      if (!declare) throw new Error('the triggers group declares no add affordance');

      const container = document.createElement('div');
      document.body.appendChild(container);
      new Setting(container).addExtraButton(declare as never);

      const button = container.querySelector('.extra-setting-button');
      if (!button) throw new Error('the add affordance rendered nothing');
      return button as HTMLElement;
    };

    /**
     * Render the trigger rows into a container and return their mode selects,
     * in row order.
     */
    function renderModeSelects(): HTMLSelectElement[] {
      const container = document.createElement('div');
      document.body.appendChild(container);
      for (const item of triggerList().items ?? []) {
        if (isRenderRow(item)) item.render(new Setting(container) as never);
      }
      return Array.from(container.querySelectorAll('select'));
    }

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('lists one item per configured trigger', () => {
      plugin.settings.triggerCharacters = [picker('@@'), inline('//d')];

      const names = (triggerList().items ?? []).map(item => ('name' in item ? item.name : ''));
      expect(names).toEqual(['@@', '//d']);
    });

    it('gives every row a mode control showing what that trigger opens', () => {
      plugin.settings.triggerCharacters = [picker('@@'), inline('//d')];

      const selects = renderModeSelects();

      expect(selects).toHaveLength(2);
      expect(selects.map(select => select.value)).toEqual(['picker', 'inline']);
      // Both modes are offered on every row: length decides nothing any more.
      for (const select of selects) {
        expect(Array.from(select.options).map(option => option.value)).toEqual([
          'picker',
          'inline',
        ]);
      }
    });

    it('labels the two modes, rather than showing their stored values', () => {
      plugin.settings.triggerCharacters = [picker('@@')];

      const [select] = renderModeSelects();

      expect(Array.from(select.options).map(option => option.text)).toEqual([
        t('settings.triggers.mode.picker'),
        t('settings.triggers.mode.inline'),
      ]);
    });

    it('persists a mode change on the row it was made', async () => {
      plugin.settings.triggerCharacters = [picker('@@'), inline('@')];
      const saveSettings = jest.spyOn(plugin, 'saveSettings');
      const [first] = renderModeSelects();

      first.value = 'inline';
      first.dispatchEvent(new Event('change'));
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual([inline('@@'), inline('@')]);
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    it('leaves the list alone when the mode is set to what it already is', async () => {
      plugin.settings.triggerCharacters = [picker('@@'), inline('@')];
      const saveSettings = jest.spyOn(plugin, 'saveSettings');
      const [first] = renderModeSelects();

      first.value = 'picker';
      first.dispatchEvent(new Event('change'));
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@'), inline('@')]);
      expect(saveSettings).not.toHaveBeenCalled();
    });

    it('ignores a mode change for a row that has since been deleted', async () => {
      // The rendered rows outlive the list they were built from: the mode
      // select of a row deleted by a quicker click must not resurrect it.
      plugin.settings.triggerCharacters = [picker('@@'), picker('##')];
      const [, second] = renderModeSelects();

      await tab.removeTrigger('##');
      second.value = 'inline';
      second.dispatchEvent(new Event('change'));
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@')]);
    });

    it('hands the add dialog the sequences, not the trigger objects', async () => {
      // The dialog's duplicate check compares against `existing`. Handing it
      // objects would make it always miss: the user types `@@`, sees no error,
      // the dialog closes — and `addTrigger` refuses in silence.
      plugin.settings.triggerCharacters = [picker('@@'), inline('@')];
      Modal.opened = [];
      addButton().click();

      // The mock records what `open()` was called on but does not render it.
      const dialog = Modal.opened.at(-1) as unknown as {
        onOpen: () => void;
        contentEl: HTMLElement;
      };
      dialog.onOpen();
      const input = dialog.contentEl.querySelector('input') as HTMLInputElement;
      input.value = '@@';
      input.dispatchEvent(new Event('input'));
      Array.from(dialog.contentEl.querySelectorAll('button'))
        .find(button => button.textContent === t('settings.triggers.add'))
        ?.click();
      await flush();

      expect(dialog.contentEl.textContent).toContain(t('settings.triggers.validation.duplicate'));
      expect(plugin.settings.triggerCharacters).toEqual([picker('@@'), inline('@')]);
    });

    it('stores the mode the add dialog collected, not a default', async () => {
      // The dialog collects a mode and `addTrigger` stores the one it is given
      // — both tested apart. The join between them was asserted nowhere, so
      // `onSubmit` could flatten every new trigger to `picker`: the user picks
      // Inline suggestions and the row appears as Date picker.
      plugin.settings.triggerCharacters = [picker('@@')];
      Modal.opened = [];
      addButton().click();

      const dialog = Modal.opened.at(-1) as unknown as {
        onOpen: () => void;
        contentEl: HTMLElement;
      };
      dialog.onOpen();
      const input = dialog.contentEl.querySelector('input') as HTMLInputElement;
      input.value = ';;';
      input.dispatchEvent(new Event('input'));
      const select = dialog.contentEl.querySelector('select') as HTMLSelectElement;
      select.value = 'inline';
      select.dispatchEvent(new Event('change'));
      Array.from(dialog.contentEl.querySelectorAll('button'))
        .find(button => button.textContent === t('settings.triggers.add'))
        ?.click();
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@'), inline(';;')]);
    });

    it('leaves no placeholder unresolved in the add dialog', async () => {
      // The compiler now forces the argument, but not the agreement between
      // `{{max}}` and the property feeding it. This is the only test that
      // renders the string through the real call site, with the real parameter
      // name, so `{{maxi}}` fed `{ max: 3 }` fails here and nowhere else — the
      // locale-file scan builds its parameters from the template itself, so it
      // always satisfies itself. The dialog's own tests translate with an
      // identity stub, which never interpolates anything.
      plugin.settings.triggerCharacters = [picker('@@')];
      Modal.opened = [];
      addButton().click();

      const dialog = Modal.opened.at(-1) as unknown as {
        onOpen: () => void;
        contentEl: HTMLElement;
      };
      dialog.onOpen();
      // Submitting an over-long sequence renders the second one, the error.
      const input = dialog.contentEl.querySelector('input') as HTMLInputElement;
      input.value = 'x'.repeat(MAX_TRIGGER_LENGTH + 1);
      input.dispatchEvent(new Event('input'));
      Array.from(dialog.contentEl.querySelectorAll('button'))
        .find(button => button.textContent === t('settings.triggers.add'))
        ?.click();
      await flush();

      expect(dialog.contentEl.textContent).not.toContain('{{');
      expect(dialog.contentEl.textContent).toContain(String(MAX_TRIGGER_LENGTH));
    });

    it('refuses an unknown mode at the mutation point', async () => {
      plugin.settings.triggerCharacters = [picker('@@')];

      await tab.setTriggerMode('@@', 'sideways' as never);

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@')]);
    });

    it('introduces the section under its heading, not above it', () => {
      // The intro says what the list below is for. It used to be emitted before
      // the heading — a list draws its heading above everything it holds — so
      // it read as a closing note on the previous section. The heading now sits
      // on a group, which draws it above the prose the group holds.
      const container = document.createElement('div');
      document.body.appendChild(container);

      const prose = (triggerGroup().items ?? []).filter(isRenderRow).map(row => {
        const el = container.createDiv();
        row.render(new Setting(el) as never);
        return el.textContent;
      });

      expect(prose).toEqual([
        t('settings.triggers.description'),
        t('settings.triggers.reloadNote'),
      ]);
    });

    it('puts the rows after the prose that introduces them', () => {
      // Two definitions, in this order: the group with the title and the prose,
      // then the list with the rows.
      const items = tab.getSettingDefinitions();
      const groupAt = items.findIndex(
        item => 'heading' in item && item.heading === t('settings.sections.triggers')
      );
      const listAt = items.findIndex(item => 'type' in item && item.type === 'list');

      expect(groupAt).toBeGreaterThanOrEqual(0);
      expect(groupAt).toBeLessThan(listAt);
    });

    it('warns once, at section level, that a change needs a reload', () => {
      // Triggers are read at plugin load: adding, removing or reassigning one
      // looks immediate and is not. Once above the list, not on every row —
      // repeated on each it reads as a property of that trigger.
      const container = document.createElement('div');
      document.body.appendChild(container);

      const section = flattenDefinitions(tab.getSettingDefinitions()).filter(isRenderRow);
      for (const row of section) row.render(new Setting(container) as never);

      const occurrences = container.textContent?.split(t('settings.triggers.reloadNote')).length;
      expect(occurrences).toBe(2); // one split point ⇒ exactly one occurrence
    });

    it('draws the add affordance as a button, not as a bare glyph', () => {
      // An extra-setting button renders as a muted glyph. Alone at the right of
      // a heading, with no row of controls to belong to, it reads as decoration.
      expect(addButton().classList.contains('settings-heading-action')).toBe(true);
    });

    it('names an icon the button can actually draw', () => {
      // An unknown icon name draws nothing at all: the button keeps its box and
      // its click target, and shows an empty square.
      expect(addButton().getAttribute('data-icon')).toBe('lucide-plus');
    });

    it('offers an add affordance beside the section title', () => {
      expect(addButton().getAttribute('aria-label')).toBe(t('settings.triggers.addTitle'));
      expect(triggerList().addItem).toBeUndefined();
    });

    it('offers deletion when more than one trigger remains', () => {
      plugin.settings.triggerCharacters = [picker('@@'), inline('//d')];
      expect(triggerList().onDelete).toBeDefined();
    });

    it('withholds deletion for the last remaining trigger', () => {
      // At least one trigger is required, so the affordance is absent rather
      // than present-and-failing.
      plugin.settings.triggerCharacters = [picker('@@')];
      expect(triggerList().onDelete).toBeUndefined();
    });

    it('shows the minimum-trigger explanation when only one remains', () => {
      plugin.settings.triggerCharacters = [picker('@@')];
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
      plugin.settings.triggerCharacters = [picker('@@'), picker('##'), picker('$$'), picker('%%')];
      const list = triggerList();

      list.onDelete?.(0);
      list.onDelete?.(1);
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual([picker('$$'), picker('%%')]);
    });

    it('never empties the list, whatever the click sequence', async () => {
      // An empty list passes validateSettings on every later load, and main.ts
      // then skips registerTriggerCharacters — the picker stays dead until the
      // user notices and re-adds a trigger by hand.
      plugin.settings.triggerCharacters = [picker('@@'), picker('##')];
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
      plugin.settings.triggerCharacters = [picker('@@'), picker('##'), picker('$$')];
      const list = triggerList();

      list.onDelete?.(1);
      await flush();
      list.onDelete?.(1); // same stale row, clicked twice
      await flush();

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@'), picker('$$')]);
    });

    it('refuses an invalid trigger at the mutation point, not only in the dialog', async () => {
      plugin.settings.triggerCharacters = [picker('@@')];

      await tab.addTrigger(inline('@@')); // the sequence is what makes it a duplicate
      await tab.addTrigger(picker(''));
      await tab.addTrigger(picker('x'.repeat(MAX_TRIGGER_LENGTH + 1)));
      await tab.addTrigger({ sequence: ';;', mode: 'sideways' } as unknown as TriggerConfig);

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@')]);
    });

    it('deletes the trigger at the given index and rebuilds', async () => {
      plugin.settings.triggerCharacters = [picker('@@'), inline('//d'), picker(';;')];
      const list = triggerList();
      update().mockClear();

      list.onDelete?.(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.settings.triggerCharacters).toEqual([picker('@@'), picker(';;')]);
      expect(update()).toHaveBeenCalled();
    });
  });
});
