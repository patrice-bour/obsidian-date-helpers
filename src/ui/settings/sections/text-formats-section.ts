import type { SettingDefinitionControl, SettingDefinitionGroup } from 'obsidian';
import { FormatPreset } from '@/types/format-preset';
import { SettingsKey, SettingsSectionContext, descriptionRow } from '../section-context';
import { buildPresetOptions } from '../preset-dropdown';

/**
 * Text formatting section: default date / time / datetime presets.
 */
export function buildTextFormatsSection(
  ctx: SettingsSectionContext
): SettingDefinitionGroup<SettingsKey> {
  return {
    type: 'group',
    heading: ctx.t('settings.sections.text'),
    items: [
      descriptionRow(ctx.t('settings.text.description')),
      defaultFormatSetting(ctx, 'date', 'defaultDatePresetId', 'defaultDateFormat'),
      defaultFormatSetting(ctx, 'time', 'defaultTimePresetId', 'defaultTimeFormat'),
      defaultFormatSetting(ctx, 'datetime', 'defaultDateTimePresetId', 'defaultDateTimeFormat'),
    ],
  };
}

function defaultFormatSetting(
  ctx: SettingsSectionContext,
  presetType: FormatPreset['type'],
  key: SettingsKey,
  labelKey: 'defaultDateFormat' | 'defaultTimeFormat' | 'defaultDateTimeFormat'
): SettingDefinitionControl<SettingsKey> {
  const { plugin, t } = ctx;
  const presets = plugin.settings.formatPresets.filter(p => p.type === presetType);

  return {
    name: t(`settings.text.${labelKey}.name`),
    desc: t(`settings.text.${labelKey}.desc`),
    control: {
      type: 'dropdown',
      key,
      disabled: presets.length === 0,
      options: buildPresetOptions({
        presets,
        formatterService: plugin.formatterService,
        t,
      }),
    },
  };
}
