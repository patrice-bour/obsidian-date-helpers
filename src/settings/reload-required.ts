import { DateHelpersSettings } from '@/types/settings';
import { resolveLocale } from '@/utils/locale';

/**
 * The settings whose effect is fixed when the plugin loads.
 *
 * `registerCommands()` is guarded by `commandsRegistered` and runs once, and
 * Obsidian publishes no `removeCommand()`, so the command set — and the names
 * on it — is whatever the plugin built on load. `registerTriggerCharacters()`
 * runs once too, and returns early when the picker is off.
 *
 * Declared in one place rather than warned about one prose line at a time: the
 * tab compares this against the same projection taken at load, so a fourth
 * reload-sensitive setting is a line here and nothing else.
 */
export interface ReloadSensitive {
  /**
   * Everything whose every change needs a reload, as one comparable string.
   *
   * A JSON tuple rather than a joined string: a separator has to be a character
   * no value can contain, and the one that qualified — NUL — made git read the
   * whole module as binary, so the file appeared in no diff at all.
   */
  frozen: string;
  /**
   * Whether the trigger surfaces were registered.
   *
   * Apart on purpose, because this one is not symmetrical. Off at load means no
   * suggest was ever registered, so turning it on needs a reload; the other way
   * round needs none, `onTrigger` reading the setting live and declining at
   * once. Folded into `frozen`, turning it OFF would raise a warning about a
   * change that acts immediately.
   */
  pickerEnabled: boolean;
}

/** Read the reload-sensitive part of `settings`, detached from it. */
export function reloadSensitive(settings: DateHelpersSettings): ReloadSensitive {
  return {
    frozen: JSON.stringify([
      // In order: the list offers no reordering, so any difference is real.
      settings.triggerCharacters.map(({ sequence, mode }) => [sequence, mode]),
      // Sorted, and only what a command's NAME is built from. Reordering
      // presets is something the user can do and it changes no command, only
      // where they sort; a preset's format is read live by every surface. The
      // name and type are in because `presetName` falls back to `name` for a
      // user preset, and the command prefix comes from `type`.
      settings.formatPresets
        .map(({ id, type, name }) => [id, type, name ?? ''])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
      // Resolved, not stored: with the setting on `auto` and Obsidian in
      // English, storing `en` renames nothing — the raw values differ and the
      // effective locale does not.
      resolveLocale(settings.locale),
    ]),
    pickerEnabled: settings.enableDatePicker,
  };
}

/**
 * Whether the plugin has to reload for `current` to take effect.
 *
 * Compared value by value against what was loaded, never a flag raised on the
 * first edit: putting a setting back is not a reload, and the warning has to go
 * when it does.
 */
export function needsReload(loaded: ReloadSensitive, current: ReloadSensitive): boolean {
  return loaded.frozen !== current.frozen || (!loaded.pickerEnabled && current.pickerEnabled);
}
