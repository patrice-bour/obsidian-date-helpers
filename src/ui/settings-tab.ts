import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import DateHelpersPlugin from '@/main';
import { isValidLocale, normalizeLocale } from '@/utils/locale';

export class DateHelpersSettingTab extends PluginSettingTab {
  plugin: DateHelpersPlugin;
  private localeDebounceTimer: NodeJS.Timeout | null = null;

  constructor(app: App, plugin: DateHelpersPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private t(key: Parameters<typeof this.plugin.i18n.t>[0]): string {
    return this.plugin.i18n.t(key);
  }

  display(): void {
    // Clear any pending timers from previous display to prevent memory leaks
    if (this.localeDebounceTimer) {
      clearTimeout(this.localeDebounceTimer);
      this.localeDebounceTimer = null;
    }

    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: this.t('settings.title') });

    containerEl.createEl('p', {
      text: this.t('settings.description'),
      cls: 'setting-item-description',
    });

    // ====================================================
    // 1. DAILY NOTES SETTINGS
    // ====================================================
    this.renderDailyNotesSettings(containerEl);

    // ====================================================
    // 2. TEXT FORMATTING SETTINGS
    // ====================================================
    this.renderTextModeSettings(containerEl);

    // ====================================================
    // 3. GENERAL SETTINGS
    // ====================================================
    containerEl.createEl('h3', { text: this.t('settings.sections.general') });

    // Locale setting
    new Setting(containerEl)
      .setName(this.t('settings.locale.name'))
      .setDesc(this.t('settings.locale.desc'))
      .addText(text =>
        text
          .setPlaceholder(this.t('settings.locale.placeholder'))
          .setValue(this.plugin.settings.locale)
          .onChange(value => {
            // Debounce locale changes to avoid validation on every keystroke
            if (this.localeDebounceTimer) {
              clearTimeout(this.localeDebounceTimer);
            }

            this.localeDebounceTimer = setTimeout(() => {
              void (async () => {
                const newLocale = value || 'auto';
                this.plugin.settings.locale = newLocale;
                await this.plugin.saveSettings();
                this.localeDebounceTimer = null;

                // Refresh UI to update examples, but ONLY if locale is valid
                if (newLocale === 'auto' || isValidLocale(normalizeLocale(newLocale))) {
                  this.display();
                }
              })();
            }, 500);
          })
      );

    // Week start setting
    new Setting(containerEl)
      .setName(this.t('settings.weekStart.name'))
      .setDesc(this.t('settings.weekStart.desc'))
      .addDropdown(dropdown =>
        dropdown
          .addOption('0', this.t('settings.weekStart.sunday'))
          .addOption('1', this.t('settings.weekStart.monday'))
          .addOption('6', this.t('settings.weekStart.saturday'))
          .setValue(String(this.plugin.settings.weekStart))
          .onChange(async value => {
            this.plugin.settings.weekStart = Number(value) as 0 | 1 | 6;
            await this.plugin.saveSettings();
          })
      );

    // ====================================================
    // 4. FEATURE TOGGLES
    // ====================================================
    containerEl.createEl('h3', { text: this.t('settings.sections.features') });

    // Enable date picker toggle
    new Setting(containerEl)
      .setName(this.t('settings.features.enableDatePicker.name'))
      .setDesc(this.t('settings.features.enableDatePicker.desc'))
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableDatePicker).onChange(async value => {
          this.plugin.settings.enableDatePicker = value;
          await this.plugin.saveSettings();
        })
      );

    // Enable NLP toggle
    new Setting(containerEl)
      .setName(this.t('settings.features.enableNLP.name'))
      .setDesc(this.t('settings.features.enableNLP.desc'))
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableNLP).onChange(async value => {
          this.plugin.settings.enableNLP = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide NLP sub-settings
        })
      );

    // NLP sub-settings (conditional on NLP enabled)
    if (this.plugin.settings.enableNLP) {
      // Auto-detect language
      new Setting(containerEl)
        .setName(this.t('settings.features.nlpAutoDetect.name'))
        .setDesc(this.t('settings.features.nlpAutoDetect.desc'))
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.nlpAutoDetectLanguage)
            .onChange(async value => {
              this.plugin.settings.nlpAutoDetectLanguage = value;
              await this.plugin.saveSettings();
            })
        );

      // NLP strict mode
      new Setting(containerEl)
        .setName(this.t('settings.features.nlpStrictMode.name'))
        .setDesc(this.t('settings.features.nlpStrictMode.desc'))
        .addDropdown(dropdown =>
          dropdown
            .addOption('false', this.t('settings.features.nlpStrictMode.casual'))
            .addOption('true', this.t('settings.features.nlpStrictMode.strict'))
            .setValue(String(this.plugin.settings.nlpStrictMode))
            .onChange(async value => {
              this.plugin.settings.nlpStrictMode = value === 'true';
              await this.plugin.saveSettings();
            })
        );

      // Show parsing warning toggle
      new Setting(containerEl)
        .setName(this.t('settings.features.nlpShowWarning.name'))
        .setDesc(this.t('settings.features.nlpShowWarning.desc'))
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.showParsingWarning)
            .onChange(async value => {
              this.plugin.settings.showParsingWarning = value;
              await this.plugin.saveSettings();
            })
        );
    }

    // ====================================================
    // 5. TRIGGER CHARACTERS
    // ====================================================
    this.renderTriggerSettings(containerEl);

    // ====================================================
    // 6. AVAILABLE FORMAT PRESETS (Read-only reference)
    // ====================================================
    this.renderFormatPresets(containerEl);
  }

  /**
   * Render Daily Notes settings
   */
  private renderDailyNotesSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: this.t('settings.sections.dailyNotes') });
    containerEl.createEl('p', {
      text: this.t('settings.dailyNotes.description'),
      cls: 'setting-item-description',
    });

    // Alias format header
    containerEl.createEl('p', {
      text: this.t('settings.dailyNotes.aliasFormat.name'),
      cls: 'setting-item-name date-helpers-alias-header',
    });
    containerEl.createEl('p', {
      text: this.t('settings.dailyNotes.aliasFormat.desc'),
      cls: 'setting-item-description',
    });

    const datePresets = this.plugin.settings.formatPresets.filter(p => p.type === 'date');

    // Alias format (with text) - includes "Original Text" option
    new Setting(containerEl)
      .setName(this.t('settings.dailyNotes.aliasFormat.withText'))
      .addDropdown(dropdown => {
        if (datePresets.length === 0) {
          dropdown.addOption('none', this.t('settings.text.noPresetsAvailable'));
          dropdown.setDisabled(true);
          return;
        }

        // Add "Original Text" as first option
        dropdown.addOption('original-text', this.t('settings.dailyNotes.aliasFormat.originalText'));

        // Add format presets
        datePresets.forEach(preset => {
          const example = this.plugin.formatterService.getFormatExample(preset.format);
          dropdown.addOption(preset.id, `${preset.name} (${example})`);
        });

        dropdown.setValue(this.plugin.settings.dailyNotesAliasPresetId);

        dropdown.onChange(async (value: string) => {
          this.plugin.settings.dailyNotesAliasPresetId = value;
          await this.plugin.saveSettings();
        });
      });

    // Alias format (no text - fallback) - excludes "Original Text" option
    new Setting(containerEl)
      .setName(this.t('settings.dailyNotes.aliasFormat.withoutText'))
      .addDropdown(dropdown => {
        if (datePresets.length === 0) {
          dropdown.addOption('none', this.t('settings.text.noPresetsAvailable'));
          dropdown.setDisabled(true);
          return;
        }

        // Only format presets (no "Original Text")
        datePresets.forEach(preset => {
          const example = this.plugin.formatterService.getFormatExample(preset.format);
          dropdown.addOption(preset.id, `${preset.name} (${example})`);
        });

        dropdown.setValue(this.plugin.settings.dailyNotesAliasFallbackPresetId);

        dropdown.onChange(async (value: string) => {
          this.plugin.settings.dailyNotesAliasFallbackPresetId = value;
          await this.plugin.saveSettings();
        });
      });

    // Create if missing
    new Setting(containerEl)
      .setName(this.t('settings.dailyNotes.createIfMissing.name'))
      .setDesc(this.t('settings.dailyNotes.createIfMissing.desc'))
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.dailyNotesCreateIfMissing)
          .onChange(async value => {
            this.plugin.settings.dailyNotesCreateIfMissing = value;
            await this.plugin.saveSettings();
          })
      );
  }

  /**
   * Render text formatting settings
   */
  private renderTextModeSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: this.t('settings.sections.text') });
    containerEl.createEl('p', {
      text: this.t('settings.text.description'),
      cls: 'setting-item-description',
    });

    // Default date preset
    new Setting(containerEl)
      .setName(this.t('settings.text.defaultDateFormat.name'))
      .setDesc(this.t('settings.text.defaultDateFormat.desc'))
      .addDropdown(dropdown => {
        const datePresets = this.plugin.settings.formatPresets.filter(p => p.type === 'date');

        if (datePresets.length === 0) {
          dropdown.addOption('none', this.t('settings.text.noPresetsAvailable'));
          dropdown.setDisabled(true);
          return;
        }

        datePresets.forEach(preset => {
          const example = this.plugin.formatterService.getFormatExample(preset.format);
          dropdown.addOption(preset.id, `${preset.name} (${example})`);
        });

        dropdown
          .setValue(this.plugin.settings.defaultDatePresetId)
          .onChange(async value => {
            this.plugin.settings.defaultDatePresetId = value;
            await this.plugin.saveSettings();
          });
      });

    // Default time preset
    new Setting(containerEl)
      .setName(this.t('settings.text.defaultTimeFormat.name'))
      .setDesc(this.t('settings.text.defaultTimeFormat.desc'))
      .addDropdown(dropdown => {
        const timePresets = this.plugin.settings.formatPresets.filter(p => p.type === 'time');

        if (timePresets.length === 0) {
          dropdown.addOption('none', this.t('settings.text.noPresetsAvailable'));
          dropdown.setDisabled(true);
          return;
        }

        timePresets.forEach(preset => {
          const example = this.plugin.formatterService.getFormatExample(preset.format);
          dropdown.addOption(preset.id, `${preset.name} (${example})`);
        });

        dropdown
          .setValue(this.plugin.settings.defaultTimePresetId)
          .onChange(async value => {
            this.plugin.settings.defaultTimePresetId = value;
            await this.plugin.saveSettings();
          });
      });

    // Default datetime preset
    new Setting(containerEl)
      .setName(this.t('settings.text.defaultDateTimeFormat.name'))
      .setDesc(this.t('settings.text.defaultDateTimeFormat.desc'))
      .addDropdown(dropdown => {
        const datetimePresets = this.plugin.settings.formatPresets.filter(p => p.type === 'datetime');

        if (datetimePresets.length === 0) {
          dropdown.addOption('none', this.t('settings.text.noPresetsAvailable'));
          dropdown.setDisabled(true);
          return;
        }

        datetimePresets.forEach(preset => {
          const example = this.plugin.formatterService.getFormatExample(preset.format);
          dropdown.addOption(preset.id, `${preset.name} (${example})`);
        });

        dropdown
          .setValue(this.plugin.settings.defaultDateTimePresetId)
          .onChange(async value => {
            this.plugin.settings.defaultDateTimePresetId = value;
            await this.plugin.saveSettings();
          });
      });
  }

  /**
   * Render trigger characters settings
   */
  private renderTriggerSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: this.t('settings.sections.triggers') });
    containerEl.createEl('p', {
      text: this.t('settings.triggers.description'),
      cls: 'setting-item-description',
    });

    // Display current triggers
    const triggersContainer = containerEl.createDiv({ cls: 'date-helpers-triggers-container' });
    this.renderTriggersList(triggersContainer);

    // Add new trigger input
    let newTriggerValue = '';
    new Setting(containerEl)
      .setName(this.t('settings.triggers.characters.name'))
      .setDesc(this.t('settings.triggers.characters.desc'))
      .addText(text =>
        text
          .setPlaceholder(this.t('settings.triggers.characters.placeholder'))
          .onChange(value => {
            newTriggerValue = value;
          })
      )
      .addButton(button =>
        button
          .setButtonText(this.t('settings.triggers.add'))
          .onClick(async () => {
            const validation = this.validateTrigger(newTriggerValue);
            if (validation) {
              new Notice(validation);
              return;
            }

            this.plugin.settings.triggerCharacters.push(newTriggerValue);
            await this.plugin.saveSettings();
            this.display(); // Refresh to show new trigger
          })
      );
  }

  /**
   * Render the list of current triggers with remove buttons
   */
  private renderTriggersList(container: HTMLElement): void {
    const triggers = this.plugin.settings.triggerCharacters;

    container.empty();

    if (triggers.length === 0) {
      container.createEl('p', {
        text: this.t('settings.triggers.validation.minRequired'),
        cls: 'setting-item-description mod-warning',
      });
      return;
    }

    const listEl = container.createDiv({ cls: 'date-helpers-triggers-list' });

    triggers.forEach((trigger, index) => {
      const triggerEl = listEl.createDiv({ cls: 'date-helpers-trigger-item' });

      triggerEl.createSpan({ text: trigger, cls: 'date-helpers-trigger-text' });

      const removeBtn = triggerEl.createEl('button', {
        text: '×',
        cls: 'date-helpers-trigger-remove',
        attr: {
          'aria-label': this.t('settings.triggers.remove'),
        },
      });

      // Disable remove if only one trigger
      if (triggers.length <= 1) {
        removeBtn.disabled = true;
        removeBtn.title = this.t('settings.triggers.validation.minRequired');
      } else {
        removeBtn.addEventListener('click', () => {
          void (async () => {
            this.plugin.settings.triggerCharacters.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          })();
        });
      }
    });
  }

  /**
   * Validate a new trigger value
   * @returns Error message if invalid, undefined if valid
   */
  private validateTrigger(value: string): string | undefined {
    if (!value || value.trim() === '') {
      return this.t('settings.triggers.validation.empty');
    }

    if (value.length > 5) {
      return this.t('settings.triggers.validation.tooLong');
    }

    if (this.plugin.settings.triggerCharacters.includes(value)) {
      return this.t('settings.triggers.validation.duplicate');
    }

    return undefined;
  }

  /**
   * Get translated preset name with fallback to default
   */
  private getPresetName(presetId: string, defaultName: string): string {
    const key = `settings.presets.formats.${presetId}.name` as Parameters<typeof this.plugin.i18n.t>[0];
    const translated = this.plugin.i18n.t(key);
    // If translation returns the key itself, use the default
    return translated === key ? defaultName : translated;
  }

  /**
   * Get translated preset description with fallback to default
   */
  private getPresetDesc(presetId: string, defaultDesc: string): string {
    const key = `settings.presets.formats.${presetId}.desc` as Parameters<typeof this.plugin.i18n.t>[0];
    const translated = this.plugin.i18n.t(key);
    // If translation returns the key itself, use the default
    return translated === key ? defaultDesc : translated;
  }

  /**
   * Render available format presets section
   */
  private renderFormatPresets(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: this.t('settings.sections.presets') });
    containerEl.createEl('p', {
      text: this.t('settings.presets.description'),
      cls: 'setting-item-description',
    });

    const presetsByType = {
      date: this.plugin.settings.formatPresets.filter(p => p.type === 'date'),
      time: this.plugin.settings.formatPresets.filter(p => p.type === 'time'),
      datetime: this.plugin.settings.formatPresets.filter(p => p.type === 'datetime'),
    };

    // Date presets
    if (presetsByType.date.length > 0) {
      containerEl.createEl('h4', { text: this.t('settings.presets.dateFormats') });
      presetsByType.date.forEach(preset => {
        const example = this.plugin.formatterService.getFormatExample(preset.format);
        const name = this.getPresetName(preset.id, preset.name);
        const desc = this.getPresetDesc(preset.id, preset.description || preset.format);
        new Setting(containerEl)
          .setName(name)
          .setDesc(`${desc} → ${this.t('settings.presets.example')}: ${example}`)
          .setClass('date-helpers-preset-info');
      });
    }

    // Time presets
    if (presetsByType.time.length > 0) {
      containerEl.createEl('h4', { text: this.t('settings.presets.timeFormats') });
      presetsByType.time.forEach(preset => {
        const example = this.plugin.formatterService.getFormatExample(preset.format);
        const name = this.getPresetName(preset.id, preset.name);
        const desc = this.getPresetDesc(preset.id, preset.description || preset.format);
        new Setting(containerEl)
          .setName(name)
          .setDesc(`${desc} → ${this.t('settings.presets.example')}: ${example}`)
          .setClass('date-helpers-preset-info');
      });
    }

    // Datetime presets
    if (presetsByType.datetime.length > 0) {
      containerEl.createEl('h4', { text: this.t('settings.presets.dateTimeFormats') });
      presetsByType.datetime.forEach(preset => {
        const example = this.plugin.formatterService.getFormatExample(preset.format);
        const name = this.getPresetName(preset.id, preset.name);
        const desc = this.getPresetDesc(preset.id, preset.description || preset.format);
        new Setting(containerEl)
          .setName(name)
          .setDesc(`${desc} → ${this.t('settings.presets.example')}: ${example}`)
          .setClass('date-helpers-preset-info');
      });
    }
  }
}
