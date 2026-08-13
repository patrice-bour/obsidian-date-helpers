import { Setting } from 'obsidian';
import { isValidLocale, normalizeLocale } from '@/utils/locale';
import { LOCALE_INPUT_DEBOUNCE_MS, WeekStart } from '@/utils/constants';
import { SettingsSectionContext } from '../section-context';

/**
 * General section: locale (debounced validation) and week start.
 *
 * Returns a dispose function the tab must call before re-rendering, so a
 * pending locale debounce timer never fires against a stale DOM.
 */
export function renderGeneralSection(
  containerEl: HTMLElement,
  ctx: SettingsSectionContext
): (flush?: boolean) => void {
  const { plugin, t } = ctx;
  let localeDebounceTimer: number | null = null;
  /** Value typed but not yet persisted, kept outside the timer so it can be flushed. */
  let pendingLocale: string | null = null;
  /**
   * Set once the section is torn down. `clearTimeout` is a no-op on a timer that
   * already fired, so a callback suspended on the `await` inside `saveSettings()`
   * would otherwise resume after teardown and refresh a container that is gone.
   */
  let disposed = false;

  /** Persist the pending locale. Never touches the DOM — callers may be tearing it down. */
  const persistPendingLocale = async (): Promise<string | null> => {
    if (pendingLocale === null) return null;
    const newLocale = pendingLocale || 'auto';
    pendingLocale = null;
    plugin.settings.locale = newLocale;
    await plugin.saveSettings();
    return newLocale;
  };

  new Setting(containerEl).setName(t('settings.sections.general')).setHeading();

  // Locale setting
  new Setting(containerEl)
    .setName(t('settings.locale.name'))
    .setDesc(t('settings.locale.desc'))
    .addText(text =>
      text
        .setPlaceholder(t('settings.locale.placeholder'))
        .setValue(plugin.settings.locale)
        .onChange(value => {
          // Debounce locale changes to avoid validation on every keystroke
          if (localeDebounceTimer !== null) {
            window.clearTimeout(localeDebounceTimer);
          }
          pendingLocale = value;

          localeDebounceTimer = window.setTimeout(() => {
            void (async () => {
              const newLocale = await persistPendingLocale();
              // Deliberately not guarded by `disposed`: this closure is private
              // and a re-render builds a fresh one, so writing it after teardown
              // is a no-op. Revisit if the variable ever gains a reader that
              // outlives the section.
              localeDebounceTimer = null;
              // Re-check after the await: the section may have been torn down
              // while the save was in flight.
              if (newLocale === null || disposed) return;

              // Refresh UI to update examples, but ONLY if locale is valid
              if (newLocale === 'auto' || isValidLocale(normalizeLocale(newLocale))) {
                ctx.refresh();
              }
            })();
          }, LOCALE_INPUT_DEBOUNCE_MS);
        })
    );

  // Week start setting
  new Setting(containerEl)
    .setName(t('settings.weekStart.name'))
    .setDesc(t('settings.weekStart.desc'))
    .addDropdown(dropdown =>
      dropdown
        .addOption('0', t('settings.weekStart.sunday'))
        .addOption('1', t('settings.weekStart.monday'))
        .addOption('6', t('settings.weekStart.saturday'))
        .setValue(String(plugin.settings.weekStart))
        .onChange(async value => {
          plugin.settings.weekStart = Number(value) as WeekStart;
          await plugin.saveSettings();
        })
    );

  /**
   * Tear down the section.
   *
   * `flush` distinguishes the two callers. A re-render (`display()`) is itself
   * triggered by a save that already happened, so there is nothing worth keeping
   * and dropping the timer is right. Hiding the tab is different: Obsidian calls
   * `hide()` whenever the user navigates to *another* settings tab, which is an
   * ordinary thing to do mid-typing — discarding there would silently lose what
   * the user just entered. So we persist instead, without refreshing, since the
   * DOM this section rendered into is on its way out.
   */
  return (flush = false) => {
    disposed = true;
    if (localeDebounceTimer !== null) {
      window.clearTimeout(localeDebounceTimer);
      localeDebounceTimer = null;
    }
    if (flush) {
      void persistPendingLocale();
    } else {
      pendingLocale = null;
    }
  };
}
