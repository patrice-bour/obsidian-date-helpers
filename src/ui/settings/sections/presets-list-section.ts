import type { SettingDefinitionGroup, SettingGroupItem } from 'obsidian';
import { TranslationKey } from '@/i18n/types';
import { FormatPreset } from '@/types/format-preset';
import { SettingsKey, SettingsSectionContext, descriptionRow, headingRow } from '../section-context';

/**
 * Read-only reference section listing the available format presets by type,
 * with localized names/descriptions falling back to the preset's own metadata.
 *
 * Every row is `searchable: false`: these are documentation, not settings, and
 * would otherwise fill Obsidian's settings search with entries that lead to
 * nothing the user can change.
 *
 * The per-type sub-headings are description rows rather than nested groups —
 * a group's items may only be settings or pages, not further groups.
 */
export function buildPresetsListSection(ctx: SettingsSectionContext): SettingDefinitionGroup<SettingsKey> {
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
  headingKey: TranslationKey
): SettingGroupItem<SettingsKey>[] {
  const { plugin, t } = ctx;
  const ofType = presets.filter(preset => preset.type === type);
  if (ofType.length === 0) return [];

  return [
    headingRow(t(headingKey)),
    ...ofType.map(preset => {
      const example = plugin.formatterService.getFormatExample(preset.format);
      const desc = translatedOr(ctx, `${preset.id}.desc`, preset.description || preset.format);

      return {
        name: translatedOr(ctx, `${preset.id}.name`, preset.name),
        desc: `${desc} → ${t('settings.presets.example')}: ${example}`,
        searchable: false,
      };
    }),
  ];
}

/**
 * Presets are user-extensible, so most have no translation entry. A missing key
 * comes back as the key itself, which is the signal to fall back to the
 * preset's own metadata.
 */
function translatedOr(ctx: SettingsSectionContext, suffix: string, fallback: string): string {
  const key = `settings.presets.formats.${suffix}` as TranslationKey;
  const translated = ctx.t(key);
  return translated === key ? fallback : translated;
}
