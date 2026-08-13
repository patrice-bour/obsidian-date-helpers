import { Setting } from 'obsidian';
import { SettingsSectionContext } from '../section-context';

/**
 * Feature toggles section: date picker, NLP, and (when NLP is on)
 * auto-detect / strict mode / parsing warning sub-settings.
 */
export function renderFeaturesSection(containerEl: HTMLElement, ctx: SettingsSectionContext): void {
  const { plugin, t } = ctx;

  new Setting(containerEl).setName(t('settings.sections.features')).setHeading();

  // Enable date picker toggle
  new Setting(containerEl)
    .setName(t('settings.features.enableDatePicker.name'))
    .setDesc(t('settings.features.enableDatePicker.desc'))
    .addToggle(toggle =>
      toggle.setValue(plugin.settings.enableDatePicker).onChange(async value => {
        plugin.settings.enableDatePicker = value;
        await plugin.saveSettings();
      })
    );

  // Enable NLP toggle
  new Setting(containerEl)
    .setName(t('settings.features.enableNLP.name'))
    .setDesc(t('settings.features.enableNLP.desc'))
    .addToggle(toggle =>
      toggle.setValue(plugin.settings.enableNLP).onChange(async value => {
        plugin.settings.enableNLP = value;
        await plugin.saveSettings();
        ctx.refresh(); // Refresh to show/hide NLP sub-settings
      })
    );

  // NLP sub-settings (conditional on NLP enabled)
  if (plugin.settings.enableNLP) {
    // Auto-detect language
    new Setting(containerEl)
      .setName(t('settings.features.nlpAutoDetect.name'))
      .setDesc(t('settings.features.nlpAutoDetect.desc'))
      .addToggle(toggle =>
        toggle.setValue(plugin.settings.nlpAutoDetectLanguage).onChange(async value => {
          plugin.settings.nlpAutoDetectLanguage = value;
          await plugin.saveSettings();
        })
      );

    // NLP strict mode
    new Setting(containerEl)
      .setName(t('settings.features.nlpStrictMode.name'))
      .setDesc(t('settings.features.nlpStrictMode.desc'))
      .addDropdown(dropdown =>
        dropdown
          .addOption('false', t('settings.features.nlpStrictMode.casual'))
          .addOption('true', t('settings.features.nlpStrictMode.strict'))
          .setValue(String(plugin.settings.nlpStrictMode))
          .onChange(async value => {
            plugin.settings.nlpStrictMode = value === 'true';
            await plugin.saveSettings();
          })
      );

    // Show parsing warning toggle
    new Setting(containerEl)
      .setName(t('settings.features.nlpShowWarning.name'))
      .setDesc(t('settings.features.nlpShowWarning.desc'))
      .addToggle(toggle =>
        toggle.setValue(plugin.settings.showParsingWarning).onChange(async value => {
          plugin.settings.showParsingWarning = value;
          await plugin.saveSettings();
        })
      );
  }
}
