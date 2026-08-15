import type { SettingDefinitionGroup } from 'obsidian';
import { SettingsKey, SettingsSectionContext, descriptionRow } from '../section-context';
import { buildPresetOptions } from '../preset-dropdown';

/**
 * Daily Notes section: alias formats (with/without text) and
 * create-if-missing toggle.
 */
export function buildDailyNotesSection(
  ctx: SettingsSectionContext
): SettingDefinitionGroup<SettingsKey> {
  const { plugin, t } = ctx;
  const datePresets = plugin.settings.formatPresets.filter(p => p.type === 'date');
  const noPresets = datePresets.length === 0;

  return {
    type: 'group',
    heading: t('settings.sections.dailyNotes'),
    items: [
      descriptionRow(t('settings.dailyNotes.description')),
      descriptionRow(t('settings.dailyNotes.aliasFormat.desc')),
      {
        name: t('settings.dailyNotes.aliasFormat.withText'),
        control: {
          type: 'dropdown',
          key: 'dailyNotesAliasPresetId',
          disabled: noPresets,
          options: buildPresetOptions({
            presets: datePresets,
            formatterService: plugin.formatterService,
            t,
            withOriginalText: true,
          }),
        },
      },
      {
        name: t('settings.dailyNotes.aliasFormat.withoutText'),
        control: {
          type: 'dropdown',
          key: 'dailyNotesAliasFallbackPresetId',
          disabled: noPresets,
          options: buildPresetOptions({
            presets: datePresets,
            formatterService: plugin.formatterService,
            t,
          }),
        },
      },
      {
        name: t('settings.dailyNotes.createIfMissing.name'),
        desc: t('settings.dailyNotes.createIfMissing.desc'),
        control: { type: 'toggle', key: 'dailyNotesCreateIfMissing' },
      },
    ],
  };
}
