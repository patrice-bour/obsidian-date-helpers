import { Setting } from 'obsidian';
import { TranslationKey } from '@/i18n/types';
import { FormatPreset } from '@/types/format-preset';
import { SettingsSectionContext } from '../section-context';

/**
 * Read-only reference section listing the available format presets by
 * type, with localized names/descriptions falling back to the preset's
 * own metadata.
 */
export function renderPresetsListSection(
  containerEl: HTMLElement,
  ctx: SettingsSectionContext
): void {
  const { plugin, t } = ctx;

  new Setting(containerEl).setName(t('settings.sections.presets')).setHeading();
  containerEl.createEl('p', {
    text: t('settings.presets.description'),
    cls: 'setting-item-description',
  });

  const presetsByType = {
    date: plugin.settings.formatPresets.filter(p => p.type === 'date'),
    time: plugin.settings.formatPresets.filter(p => p.type === 'time'),
    datetime: plugin.settings.formatPresets.filter(p => p.type === 'datetime'),
  };

  renderPresetGroup(containerEl, ctx, presetsByType.date, 'settings.presets.dateFormats');
  renderPresetGroup(containerEl, ctx, presetsByType.time, 'settings.presets.timeFormats');
  renderPresetGroup(containerEl, ctx, presetsByType.datetime, 'settings.presets.dateTimeFormats');
}

function renderPresetGroup(
  containerEl: HTMLElement,
  ctx: SettingsSectionContext,
  presets: FormatPreset[],
  headingKey: TranslationKey
): void {
  if (presets.length === 0) return;

  const { plugin, t } = ctx;

  new Setting(containerEl).setName(t(headingKey)).setHeading();
  presets.forEach(preset => {
    const example = plugin.formatterService.getFormatExample(preset.format);
    const name = getPresetName(ctx, preset.id, preset.name);
    const desc = getPresetDesc(ctx, preset.id, preset.description || preset.format);
    new Setting(containerEl)
      .setName(name)
      .setDesc(`${desc} → ${t('settings.presets.example')}: ${example}`)
      .setClass('date-helpers-preset-info');
  });
}

/**
 * Get translated preset name with fallback to default
 */
function getPresetName(ctx: SettingsSectionContext, presetId: string, defaultName: string): string {
  const key = `settings.presets.formats.${presetId}.name` as TranslationKey;
  const translated = ctx.t(key);
  // If translation returns the key itself, use the default
  return translated === key ? defaultName : translated;
}

/**
 * Get translated preset description with fallback to default
 */
function getPresetDesc(ctx: SettingsSectionContext, presetId: string, defaultDesc: string): string {
  const key = `settings.presets.formats.${presetId}.desc` as TranslationKey;
  const translated = ctx.t(key);
  // If translation returns the key itself, use the default
  return translated === key ? defaultDesc : translated;
}
