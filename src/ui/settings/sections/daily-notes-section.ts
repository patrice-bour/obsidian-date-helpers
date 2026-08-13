import { Setting } from 'obsidian';
import { SettingsSectionContext } from '../section-context';
import { addPresetDropdown } from '../preset-dropdown';

/**
 * Daily Notes section: alias formats (with/without text) and
 * create-if-missing toggle.
 */
export function renderDailyNotesSection(
  containerEl: HTMLElement,
  ctx: SettingsSectionContext
): void {
  const { plugin, t } = ctx;

  new Setting(containerEl).setName(t('settings.sections.dailyNotes')).setHeading();
  containerEl.createEl('p', {
    text: t('settings.dailyNotes.description'),
    cls: 'setting-item-description',
  });

  // Alias format header
  containerEl.createEl('p', {
    text: t('settings.dailyNotes.aliasFormat.name'),
    cls: 'setting-item-name date-helpers-alias-header',
  });
  containerEl.createEl('p', {
    text: t('settings.dailyNotes.aliasFormat.desc'),
    cls: 'setting-item-description',
  });

  const datePresets = plugin.settings.formatPresets.filter(p => p.type === 'date');

  // Alias format (with text) - includes "Original Text" option
  addPresetDropdown(
    new Setting(containerEl).setName(t('settings.dailyNotes.aliasFormat.withText')),
    {
      presets: datePresets,
      formatterService: plugin.formatterService,
      value: plugin.settings.dailyNotesAliasPresetId,
      noPresetsLabel: t('settings.text.noPresetsAvailable'),
      originalTextLabel: t('settings.dailyNotes.aliasFormat.originalText'),
      onChange: async value => {
        plugin.settings.dailyNotesAliasPresetId = value;
        await plugin.saveSettings();
      },
    }
  );

  // Alias format (no text - fallback) - excludes "Original Text" option
  addPresetDropdown(
    new Setting(containerEl).setName(t('settings.dailyNotes.aliasFormat.withoutText')),
    {
      presets: datePresets,
      formatterService: plugin.formatterService,
      value: plugin.settings.dailyNotesAliasFallbackPresetId,
      noPresetsLabel: t('settings.text.noPresetsAvailable'),
      onChange: async value => {
        plugin.settings.dailyNotesAliasFallbackPresetId = value;
        await plugin.saveSettings();
      },
    }
  );

  // Create if missing
  new Setting(containerEl)
    .setName(t('settings.dailyNotes.createIfMissing.name'))
    .setDesc(t('settings.dailyNotes.createIfMissing.desc'))
    .addToggle(toggle =>
      toggle.setValue(plugin.settings.dailyNotesCreateIfMissing).onChange(async value => {
        plugin.settings.dailyNotesCreateIfMissing = value;
        await plugin.saveSettings();
      })
    );
}
