import type { SettingDefinitionGroup } from 'obsidian';
import { SettingsKey, SettingsSectionContext, descriptionRow } from '../section-context';
import { buildPresetOptions } from '../preset-dropdown';

/**
 * Text formatting section: the default date preset. Time and datetime have no
 * equivalent — each preset command carries its own preset.
 *
 * The translation keys are spelled out rather than built from a variable: a
 * template lookup makes `unused-translation-keys` accept any
 * `settings.text.*.name`, so an orphan key would go unnoticed.
 */
export function buildTextFormatsSection(
  ctx: SettingsSectionContext
): SettingDefinitionGroup<SettingsKey> {
  const { plugin, t } = ctx;
  const datePresets = plugin.settings.formatPresets.filter(p => p.type === 'date');

  return {
    type: 'group',
    heading: t('settings.sections.text'),
    items: [
      descriptionRow(t('settings.text.description')),
      {
        name: t('settings.text.defaultDateFormat.name'),
        desc: t('settings.text.defaultDateFormat.desc'),
        control: {
          type: 'dropdown',
          key: 'defaultDatePresetId',
          disabled: datePresets.length === 0,
          options: buildPresetOptions({
            presets: datePresets,
            formatterService: plugin.formatterService,
            t,
          }),
        },
      },
    ],
  };
}
