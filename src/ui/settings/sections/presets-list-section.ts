import type { Setting, SettingDefinitionGroup, SettingGroupItem } from 'obsidian';
import { PlainTranslationKey } from '@/i18n/types';
import { presetDescription, presetName } from '@/i18n/preset-labels';
import { FormatPreset } from '@/types/format-preset';
import {
  SettingsKey,
  SettingsSectionContext,
  descriptionRow,
  headingRow,
} from '../section-context';

/**
 * Reference section listing the available format presets by type, with
 * localized names/descriptions falling back to the preset's own metadata.
 *
 * Date and datetime rows carry one control: whether the preset appears in the
 * inline suggestion popup. Time presets do not — the popup inserts dates, and
 * a bare time is not one.
 *
 * The rows are `searchable: false`: they read as documentation, and the toggle
 * means nothing without the format it sits beside.
 *
 * The per-type sub-headings are description rows rather than nested groups —
 * a group's items may only be settings or pages, not further groups.
 */
export function buildPresetsListSection(
  ctx: SettingsSectionContext
): SettingDefinitionGroup<SettingsKey> {
  const { plugin, t } = ctx;
  const presets = plugin.settings.formatPresets;

  return {
    type: 'group',
    heading: t('settings.sections.presets'),
    items: [
      descriptionRow(t('settings.presets.description')),
      ...presetGroup(ctx, presets, 'date', 'settings.presets.dateFormats'),
      ...presetGroup(ctx, presets, 'time', 'settings.presets.timeFormats'),
      ...presetGroup(ctx, presets, 'datetime', 'settings.presets.dateTimeFormats'),
    ],
  };
}

function presetGroup(
  ctx: SettingsSectionContext,
  presets: FormatPreset[],
  type: FormatPreset['type'],
  headingKey: PlainTranslationKey
): SettingGroupItem<SettingsKey>[] {
  const { plugin, t } = ctx;
  const ofType = presets.filter(preset => preset.type === type);
  if (ofType.length === 0) return [];

  return [
    headingRow(t(headingKey)),
    ...ofType.map(preset => {
      const example = plugin.formatterService.getFormatExample(preset.format);
      const name = presetName(preset, t);
      // The whole row is one translation: French puts a space before the colon
      const desc = t('settings.presets.exampleRow', {
        desc: presetDescription(preset, t),
        example,
      });

      if (type === 'time') {
        return { name, desc, searchable: false };
      }

      return {
        // Declared *and* applied in `render`: the declaration is what the tab's
        // own tree exposes, and a `render` row draws itself.
        name,
        desc,
        searchable: false,
        render: (setting: Setting) => {
          setting
            .setName(name)
            .setDesc(desc)
            .addToggle(toggle =>
              toggle
                .setValue(preset.showInSuggest === true)
                .setTooltip(t('settings.presets.showInSuggest'))
                .onChange(async (value: boolean) => {
                  // Written on the preset in place: the pinned set is a property
                  // of each preset, so reordering the list cannot disturb it.
                  const stored = plugin.settings.formatPresets.find(p => p.id === preset.id);
                  if (!stored) return;
                  stored.showInSuggest = value;
                  await plugin.saveSettings();
                })
            );
        },
      };
    }),
  ];
}
