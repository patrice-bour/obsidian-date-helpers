import { Notice, Setting } from 'obsidian';
import { MAX_TRIGGER_LENGTH } from '@/utils/constants';
import { SettingsSectionContext } from '../section-context';

/**
 * Trigger characters section: current trigger list with remove buttons
 * and the add-new-trigger input with validation.
 */
export function renderTriggersSection(containerEl: HTMLElement, ctx: SettingsSectionContext): void {
  const { plugin, t } = ctx;

  new Setting(containerEl).setName(t('settings.sections.triggers')).setHeading();
  containerEl.createEl('p', {
    text: t('settings.triggers.description'),
    cls: 'setting-item-description',
  });

  // Display current triggers
  const triggersContainer = containerEl.createDiv({ cls: 'date-helpers-triggers-container' });
  renderTriggersList(triggersContainer, ctx);

  // Add new trigger input
  let newTriggerValue = '';
  new Setting(containerEl)
    .setName(t('settings.triggers.characters.name'))
    .setDesc(t('settings.triggers.characters.desc'))
    .addText(text =>
      text.setPlaceholder(t('settings.triggers.characters.placeholder')).onChange(value => {
        newTriggerValue = value;
      })
    )
    .addButton(button =>
      button.setButtonText(t('settings.triggers.add')).onClick(async () => {
        const validation = validateTrigger(newTriggerValue, ctx);
        if (validation) {
          new Notice(validation);
          return;
        }

        plugin.settings.triggerCharacters.push(newTriggerValue);
        await plugin.saveSettings();
        ctx.refresh(); // Refresh to show new trigger
      })
    );
}

/**
 * Render the list of current triggers with remove buttons
 */
function renderTriggersList(container: HTMLElement, ctx: SettingsSectionContext): void {
  const { plugin, t } = ctx;
  const triggers = plugin.settings.triggerCharacters;

  container.empty();

  if (triggers.length === 0) {
    container.createEl('p', {
      text: t('settings.triggers.validation.minRequired'),
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
        'aria-label': t('settings.triggers.remove'),
      },
    });

    // Disable remove if only one trigger
    if (triggers.length <= 1) {
      removeBtn.disabled = true;
      removeBtn.title = t('settings.triggers.validation.minRequired');
    } else {
      removeBtn.addEventListener('click', () => {
        void (async () => {
          plugin.settings.triggerCharacters.splice(index, 1);
          await plugin.saveSettings();
          ctx.refresh();
        })();
      });
    }
  });
}

/**
 * Validate a new trigger value
 * @returns Error message if invalid, undefined if valid
 */
function validateTrigger(value: string, ctx: SettingsSectionContext): string | undefined {
  if (!value || value.trim() === '') {
    return ctx.t('settings.triggers.validation.empty');
  }

  if (value.length > MAX_TRIGGER_LENGTH) {
    return ctx.t('settings.triggers.validation.tooLong');
  }

  if (ctx.plugin.settings.triggerCharacters.includes(value)) {
    return ctx.t('settings.triggers.validation.duplicate');
  }

  return undefined;
}
