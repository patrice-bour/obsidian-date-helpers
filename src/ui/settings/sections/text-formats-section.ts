import { Setting } from 'obsidian';
import { SettingsSectionContext } from '../section-context';
import { addPresetDropdown } from '../preset-dropdown';

/**
 * Text formatting section: default date / time / datetime presets.
 */
export function renderTextFormatsSection(
  containerEl: HTMLElement,
  ctx: SettingsSectionContext
): void {
  const { plugin, t } = ctx;

  new Setting(containerEl).setName(t('settings.sections.text')).setHeading();
  containerEl.createEl('p', {
    text: t('settings.text.description'),
    cls: 'setting-item-description',
  });

  // Default date preset
  addPresetDropdown(
    new Setting(containerEl)
      .setName(t('settings.text.defaultDateFormat.name'))
      .setDesc(t('settings.text.defaultDateFormat.desc')),
    {
      presets: plugin.settings.formatPresets.filter(p => p.type === 'date'),
      formatterService: plugin.formatterService,
      value: plugin.settings.defaultDatePresetId,
      noPresetsLabel: t('settings.text.noPresetsAvailable'),
      onChange: async value => {
        plugin.settings.defaultDatePresetId = value;
        await plugin.saveSettings();
      },
    }
  );

  // Default time preset
  addPresetDropdown(
    new Setting(containerEl)
      .setName(t('settings.text.defaultTimeFormat.name'))
      .setDesc(t('settings.text.defaultTimeFormat.desc')),
    {
      presets: plugin.settings.formatPresets.filter(p => p.type === 'time'),
      formatterService: plugin.formatterService,
      value: plugin.settings.defaultTimePresetId,
      noPresetsLabel: t('settings.text.noPresetsAvailable'),
      onChange: async value => {
        plugin.settings.defaultTimePresetId = value;
        await plugin.saveSettings();
      },
    }
  );

  // Default datetime preset
  addPresetDropdown(
    new Setting(containerEl)
      .setName(t('settings.text.defaultDateTimeFormat.name'))
      .setDesc(t('settings.text.defaultDateTimeFormat.desc')),
    {
      presets: plugin.settings.formatPresets.filter(p => p.type === 'datetime'),
      formatterService: plugin.formatterService,
      value: plugin.settings.defaultDateTimePresetId,
      noPresetsLabel: t('settings.text.noPresetsAvailable'),
      onChange: async value => {
        plugin.settings.defaultDateTimePresetId = value;
        await plugin.saveSettings();
      },
    }
  );
}
