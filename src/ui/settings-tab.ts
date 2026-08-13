import { App, PluginSettingTab, Setting } from 'obsidian';
import DateHelpersPlugin from '@/main';
import { SettingsSectionContext } from './settings/section-context';
import { renderDailyNotesSection } from './settings/sections/daily-notes-section';
import { renderTextFormatsSection } from './settings/sections/text-formats-section';
import { renderGeneralSection } from './settings/sections/general-section';
import { renderFeaturesSection } from './settings/sections/features-section';
import { renderTriggersSection } from './settings/sections/triggers-section';
import { renderPresetsListSection } from './settings/sections/presets-list-section';

/**
 * Settings tab orchestrator: builds the section context and renders the
 * sections in order. Each section lives in src/ui/settings/sections/.
 */
export class DateHelpersSettingTab extends PluginSettingTab {
  plugin: DateHelpersPlugin;
  /** Cleanup for the previous render (pending debounce timers, etc.) */
  private disposeSections: ((flush?: boolean) => void) | null = null;

  constructor(app: App, plugin: DateHelpersPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    // Clear any pending timers from previous display to prevent memory leaks
    this.disposeSections?.();
    this.disposeSections = null;

    const { containerEl } = this;
    containerEl.empty();

    const ctx: SettingsSectionContext = {
      plugin: this.plugin,
      t: key => this.plugin.i18n.t(key),
      refresh: () => this.display(),
    };

    new Setting(containerEl).setName(ctx.t('settings.title')).setHeading();
    containerEl.createEl('p', {
      text: ctx.t('settings.description'),
      cls: 'setting-item-description',
    });

    renderDailyNotesSection(containerEl, ctx);
    renderTextFormatsSection(containerEl, ctx);
    this.disposeSections = renderGeneralSection(containerEl, ctx);
    renderFeaturesSection(containerEl, ctx);
    renderTriggersSection(containerEl, ctx);
    renderPresetsListSection(containerEl, ctx);
  }

  /**
   * Obsidian's teardown hook: "Any registered components should be unloaded
   * when the view is hidden."
   *
   * Without this, a pending debounce survives the tab being hidden and is only
   * cleaned up by the *next* display() — which may never come. Since the timer
   * is scoped to `window` it outlives a popped-out settings window, so its
   * callback would then refresh a containerEl whose document is gone.
   *
   * Flushes rather than discards. Obsidian calls hide() whenever the user
   * switches to another settings tab, so discarding would silently drop a
   * locale the user had just typed — a common path, unlike the popout close
   * this teardown was added for.
   */
  hide(): void {
    this.disposeSections?.(true);
    this.disposeSections = null;
    super.hide();
  }
}
