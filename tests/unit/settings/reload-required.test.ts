/**
 * What the plugin freezes at load, and how a change to it is noticed.
 *
 * Three settings only take effect when the plugin loads, because
 * `registerCommands()` runs once and Obsidian publishes no `removeCommand()`.
 * The tab warns while the current value differs from the loaded one, so the
 * whole question is what "differs" means — and it is not deep equality: the
 * user may reorder presets without changing which commands exist.
 */

import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { needsReload, reloadSensitive } from '@/settings/reload-required';
import { DateHelpersSettings } from '@/types/settings';
import { resolveLocale } from '@/utils/locale';

/** The shipped settings, with `patch` applied on top */
function withSettings(patch: Partial<DateHelpersSettings>): DateHelpersSettings {
  return {
    ...DEFAULT_SETTINGS,
    triggerCharacters: DEFAULT_SETTINGS.triggerCharacters.map(t => ({ ...t })),
    formatPresets: DEFAULT_SETTINGS.formatPresets.map(p => ({ ...p })),
    ...patch,
  };
}

/** Whether the tab would warn, going from `before` to `after` */
function warns(before: DateHelpersSettings, after: DateHelpersSettings): boolean {
  return needsReload(reloadSensitive(before), reloadSensitive(after));
}

describe('reload-required projection', () => {
  const shipped = () => withSettings({});

  it('warns about nothing when nothing moved', () => {
    expect(warns(shipped(), shipped())).toBe(false);
  });

  describe('the trigger list', () => {
    it('warns when a trigger is added', () => {
      const after = shipped();
      after.triggerCharacters.push({ sequence: ';;', mode: 'inline' });

      expect(warns(shipped(), after)).toBe(true);
    });

    it('warns when a trigger is removed', () => {
      const after = shipped();
      after.triggerCharacters.pop();

      expect(warns(shipped(), after)).toBe(true);
    });

    it('warns when a trigger changes mode', () => {
      const after = shipped();
      after.triggerCharacters[0].mode =
        after.triggerCharacters[0].mode === 'inline' ? 'picker' : 'inline';

      expect(warns(shipped(), after)).toBe(true);
    });

    it('warns when a sequence is rewritten to another of the same length', () => {
      const after = shipped();
      after.triggerCharacters[0] = { ...after.triggerCharacters[0], sequence: '§§' };

      expect(warns(shipped(), after)).toBe(true);
    });
  });

  describe('the preset set', () => {
    it('warns when a preset is added', () => {
      const after = shipped();
      after.formatPresets.push({
        id: 'compact',
        format: 'yyyyMMdd',
        type: 'date',
        builtin: false,
        showInSuggest: false,
      });

      expect(warns(shipped(), after)).toBe(true);
    });

    it('warns when a preset is removed', () => {
      const after = shipped();
      after.formatPresets.pop();

      expect(warns(shipped(), after)).toBe(true);
    });

    // Order decides where the commands sit in the palette's own sorting, not
    // which commands exist — and reordering is an affordance the user has.
    // Warning here would cry reload over a change that needs none.
    it('stays quiet when presets are merely reordered', () => {
      const after = shipped();
      after.formatPresets.reverse();

      expect(warns(shipped(), after)).toBe(false);
    });

    // No command reads this field: it decides what the inline popup lists, and
    // the popup is rebuilt on every keystroke.
    it('stays quiet when a preset is pinned or unpinned', () => {
      const after = shipped();
      after.formatPresets[0].showInSuggest = !after.formatPresets[0].showInSuggest;

      expect(warns(shipped(), after)).toBe(false);
    });

    // `presetName` falls back to `name` for a preset with no i18n key, and the
    // command's prefix comes from `type`: both are baked into a name that is
    // frozen at load. No interface edits them yet — `add-custom-format-presets`
    // is what will.
    it('warns when a user preset is renamed', () => {
      const avant = shipped();
      avant.formatPresets.push({
        id: 'compact',
        format: 'yyyyMMdd',
        type: 'date',
        builtin: false,
        name: 'Compact',
        showInSuggest: false,
      });
      const apres = withSettings({
        formatPresets: avant.formatPresets.map(p =>
          p.id === 'compact' ? { ...p, name: 'Serré' } : { ...p }
        ),
      });

      expect(warns(avant, apres)).toBe(true);
    });

    it('warns when a preset changes type', () => {
      const apres = shipped();
      apres.formatPresets[0].type = apres.formatPresets[0].type === 'date' ? 'time' : 'date';

      expect(warns(shipped(), apres)).toBe(true);
    });

    // The format is what a preset writes, and every surface reads it live.
    it('stays quiet when a preset format is edited', () => {
      const after = shipped();
      after.formatPresets[0].format = 'yyyy/MM/dd';

      expect(warns(shipped(), after)).toBe(false);
    });
  });

  describe('the locale', () => {
    it.each([
      ['pinned to another language', withSettings({}), withSettings({ locale: 'fr-FR' })],
      ['back to following Obsidian', withSettings({ locale: 'fr-FR' }), withSettings({})],
    ])('warns when the locale is %s', (_cas, avant, apres) => {
      expect(warns(avant, apres)).toBe(true);
    });

    // `auto` with Obsidian in English resolves to the same locale as `en`, so
    // every command name is identical to the bit. Comparing the stored values
    // would warn about a rename that did not happen.
    it('stays quiet when a different stored value resolves to the same locale', () => {
      const auto = withSettings({ locale: 'auto' });
      const explicite = withSettings({ locale: resolveLocale('auto') });

      expect(warns(auto, explicite)).toBe(false);
    });
  });

  describe('the picker toggle, which is not symmetrical', () => {
    // Off at load means `registerTriggerCharacters()` returned early and no
    // suggest was ever registered: turning it on registers nothing until the
    // plugin reloads.
    it('warns when the picker is turned on', () => {
      expect(warns(withSettings({ enableDatePicker: false }), withSettings({}))).toBe(true);
    });

    // The other way round acts at once — `onTrigger` reads the setting live and
    // declines — so a warning here would be about a change that needs none.
    it('stays quiet when the picker is turned off', () => {
      expect(warns(withSettings({}), withSettings({ enableDatePicker: false }))).toBe(false);
    });

    it('stays quiet once the toggle is put back where it loaded', () => {
      const charge = withSettings({ enableDatePicker: false });

      expect(warns(charge, withSettings({ enableDatePicker: false }))).toBe(false);
    });
  });

  describe('settings that act at once', () => {
    it.each([
      ['enableNLP', { enableNLP: false }],
      ['nlpStrictMode', { nlpStrictMode: true }],
      ['weekStart', { weekStart: 0 as const }],
      ['defaultDatePresetId', { defaultDatePresetId: 'locale-long' }],
      ['dailyNotesCreateIfMissing', { dailyNotesCreateIfMissing: true }],
    ])('stays quiet for %s', (_nom, patch) => {
      expect(warns(shipped(), withSettings(patch))).toBe(false);
    });
  });

  // The projection is read at load and kept; the settings object it came from
  // goes on being mutated in place by the tab.
  it('does not follow later edits to the settings it was taken from', () => {
    const settings = shipped();
    const loaded = reloadSensitive(settings);

    settings.triggerCharacters.push({ sequence: ';;', mode: 'inline' });

    expect(needsReload(loaded, reloadSensitive(settings))).toBe(true);
  });
});
