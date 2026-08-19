import type { SettingDefinitionRender } from 'obsidian';
import DateHelpersPlugin from '@/main';
import { DateHelpersSettings } from '@/types/settings';
import { Translate } from '@/i18n/types';

/**
 * Every control binds to a real setting. Typing the definition tree with this
 * turns a mistyped or renamed key into a compile error — otherwise it writes a
 * new property into `settings`, which every later load then carries forward.
 */
export type SettingsKey = keyof DateHelpersSettings;

/**
 * Shared context handed to every settings section builder.
 *
 * Sections build declarative definitions and never touch the DOM, so there is
 * no refresh hook here: rebuilding is the settings tab's business, triggered
 * from `setControlValue` when a change warrants it.
 */
export interface SettingsSectionContext {
  plugin: DateHelpersPlugin;
  /** Translate a key with the plugin's i18n service */
  t: Translate;
}

/**
 * A description-only row for section intros.
 *
 * Uses a `render` callback rather than an empty-name `SettingDefinitionEmpty`:
 * Obsidian renders nothing at all for a definition whose name is empty, which
 * silently dropped every section intro when this was first migrated. `render`
 * is the documented escape hatch for what no declarative control expresses; the
 * usual pitfall — it does not auto-persist — does not apply, since prose has
 * nothing to save.
 *
 * Kept out of the settings search: prose is not something the user can act on.
 */
export function descriptionRow(text: string): SettingDefinitionRender {
  return {
    name: '',
    searchable: false,
    render: setting => {
      setting.setDesc(text);
    },
  };
}

/**
 * A sub-heading inside a group. Groups cannot nest, so the per-type headings of
 * the format-preset reference are rendered as headings on a plain row.
 *
 * `name` is required on every definition and is what the framework matches a
 * row to across a rebuild, so it carries the title the callback writes rather
 * than an empty string. Search skips the row regardless.
 */
export function headingRow(text: string): SettingDefinitionRender {
  return {
    name: text,
    searchable: false,
    render: setting => {
      setting.setName(text).setHeading();
    },
  };
}
