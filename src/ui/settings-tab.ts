import { App, Notice, PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import DateHelpersPlugin from '@/main';
import { DEFAULT_SETTINGS } from '@/settings/defaults';
import { normalizeLocale } from '@/utils/locale';
import { LOCALE_REFRESH_DEBOUNCE_MS, MAX_TRIGGER_LENGTH } from '@/utils/constants';
import { SettingsKey, SettingsSectionContext } from './settings/section-context';
import { TriggerConfig, TriggerMode, isTriggerMode } from '@/types/settings';
import { AddTriggerModal } from './settings/add-trigger-modal';
import { buildDailyNotesSection } from './settings/sections/daily-notes-section';
import { buildTextFormatsSection } from './settings/sections/text-formats-section';
import { buildGeneralSection } from './settings/sections/general-section';
import { buildFeaturesSection } from './settings/sections/features-section';
import { buildTriggersSection } from './settings/sections/triggers-section';
import { buildPresetsListSection } from './settings/sections/presets-list-section';

/**
 * Dropdown controls hand back strings; these settings are not stored as such.
 *
 * `locale` normalizes here rather than only in the control's `validate` hook:
 * validation accepts a value if its *normalized* form is a known locale, so
 * `fr_CA` passes. Storing the raw form would then hand `fr_CA` to Luxon, which
 * throws on it — every format example and every inserted date would read
 * "[Invalid format: …]" until the next restart, where the loader normalizes.
 * What is validated must be what is stored.
 */
const CONTROL_COERCIONS: Partial<Record<SettingsKey, (raw: string) => unknown>> = {
  // Options are keyed '0' | '1' | '6', the three WeekStart values.
  weekStart: raw => Number(raw),
  nlpStrictMode: raw => raw === 'true',
  // An emptied field means "follow Obsidian", which is stored as `auto`.
  locale: raw => (raw.trim() === '' ? 'auto' : normalizeLocale(raw.trim())),
};

/**
 * The read side of the same funnel. Dropdown controls are typed
 * `SettingControlBase<string>`, so a stored number or boolean has to be handed
 * back as the string its options are keyed by — today the DOM stringifies it
 * anyway, but `validate` and `defaultValue` would not.
 */
const CONTROL_DECODERS: Partial<Record<SettingsKey, (value: unknown) => unknown>> = {
  weekStart: value => String(value),
  nlpStrictMode: value => String(value),
};

/** True when `key` names an actual setting, which also rules out `__proto__`. */
function isSettingsKey(key: string): key is SettingsKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
}

/**
 * Settings tab: declares its settings, Obsidian renders and indexes them.
 *
 * Persistence is routed through `plugin.saveSettings()` instead of the
 * inherited `saveData()` write, because saving is not just a write here — it
 * re-resolves the locale into the i18n, date, formatter, NLP and Daily Notes
 * services. That override is also the only hook a declarative control offers
 * for reacting to a change, so the side effects are dispatched from it.
 */
export class DateHelpersSettingTab extends PluginSettingTab {
  plugin: DateHelpersPlugin;
  /** Pending rebuild after a locale edit. Holds no user data. */
  private localeRefreshTimer: number | null = null;
  /**
   * Set once the plugin unloads. Every rebuild scheduled across an `await` has
   * to check it: cancelling the timer is not enough, because a continuation
   * already parked on `saveSettings()` resumes afterwards and would rebuild
   * against services that no longer exist.
   *
   * Hiding the tab must not set this. `getSettingDefinitions()` does clear it,
   * and `update()` does call it — but `update()` is exactly what the latch
   * blocks, so the reset is unreachable once set. Obsidian itself calls the
   * hook only when the tab is registered: `display()`, which would call it
   * again, never runs while the definitions are non-empty.
   */
  private disposed = false;

  constructor(app: App, plugin: DateHelpersPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem<SettingsKey>[] {
    const ctx: SettingsSectionContext = {
      plugin: this.plugin,
      // Bound per rebuild, not once: `initializeServices()` replaces
      // `plugin.i18n`, so a binding captured earlier would translate against a
      // dead instance. `main.ts` uses an arrow for the same reason.
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
    };

    return [
      buildDailyNotesSection(ctx),
      buildTextFormatsSection(ctx),
      buildGeneralSection(ctx),
      buildFeaturesSection(ctx),
      ...buildTriggersSection(ctx, {
        onAdd: () => this.openAddTriggerDialog(),
        onDelete: sequence => void this.removeTrigger(sequence),
        onModeChange: (sequence, mode) => void this.setTriggerMode(sequence, mode),
      }),
      buildPresetsListSection(ctx),
    ];
  }

  getControlValue(key: string): unknown {
    if (!isSettingsKey(key)) return undefined;

    const stored = this.plugin.settings[key];
    const decode = CONTROL_DECODERS[key];
    return decode ? decode(stored) : stored;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    // Definitions are typed against `keyof DateHelpersSettings`, so a bad key
    // cannot come from our own tree. This guards the framework's side of the
    // contract: an unknown key would otherwise be written into `settings` and
    // then carried forward by every later load, invisibly.
    if (!isSettingsKey(key)) return;

    const coerce = CONTROL_COERCIONS[key];
    const stored = coerce && typeof value === 'string' ? coerce(value) : value;
    const previous = this.plugin.settings[key];

    (this.plugin.settings as Record<SettingsKey, unknown>)[key] = stored;

    try {
      await this.plugin.saveSettings();
    } catch (error) {
      // Nothing reached disk and the services were never updated, so keeping
      // the new value in memory would leave the tab disagreeing with both.
      (this.plugin.settings as Record<SettingsKey, unknown>)[key] = previous;
      this.reportFailure(error);
      return;
    }

    this.applySideEffect(key, previous, stored);
  }

  // No `hide()` override. Cancelling the pending rebuild there looks free —
  // the value is already persisted — but the rebuild exists for the *display*,
  // and nothing else would run it: what Obsidian renders on the next open is
  // whatever `update()` last stored. Closing the window inside the debounce
  // would leave the tab in the previous language for the rest of the session,
  // which is the defect this class was just fixed for, one door over.
  //
  // Letting the timer fire against a hidden tab is safe: `update()` is what
  // Obsidian documents for a tab whose data changed, on screen or not.

  /**
   * Retire the tab for good. Called from the plugin's `onunload` — a BRAT
   * update or a "reload plugins" would otherwise leave a timer that fires
   * against unloaded services, and a continuation parked on `saveSettings()`
   * that rebuilds from them.
   *
   * Not called when the tab is merely hidden: see the note on `disposed`.
   */
  dispose(): void {
    this.disposed = true;
    this.clearLocaleRefresh();
  }

  private applySideEffect(key: SettingsKey, previous: unknown, stored: unknown): void {
    // Changing the locale changes rendered *content* — translated labels and the
    // format examples baked into dropdown option labels — so predicates are not
    // enough and the definitions must be rebuilt.
    if (key === 'locale') {
      // A keystroke that lands on the same stored value (typing over a selection,
      // re-entering what was already there) must not re-arm the rebuild, or the
      // field is refilled under a user who is still editing.
      if (previous !== stored) this.scheduleLocaleRefresh();
      return;
    }

    // Toggling NLP only flips `visible` on its sub-settings. Re-evaluating the
    // predicates in place avoids rebuilding the tab under the user's cursor.
    if (key === 'enableNLP') {
      this.refreshDomState();
    }
  }

  /**
   * Defer the rebuild: a control that reports on every keystroke would otherwise
   * tear down the very field being typed into.
   *
   * Timers are armed on `window`, never `activeWindow`, which follows focus and
   * would let a timer be armed on one window and cleared on another.
   */
  private scheduleLocaleRefresh(): void {
    // A continuation parked on `saveSettings()` can resume after `onunload`,
    // and would otherwise arm a timer no `dispose()` will ever clear.
    if (this.disposed) return;
    this.clearLocaleRefresh();
    this.localeRefreshTimer = window.setTimeout(() => {
      this.localeRefreshTimer = null;
      this.refresh();
    }, LOCALE_REFRESH_DEBOUNCE_MS);
  }

  private clearLocaleRefresh(): void {
    if (this.localeRefreshTimer !== null) {
      window.clearTimeout(this.localeRefreshTimer);
      this.localeRefreshTimer = null;
    }
  }

  /** Rebuild, unless the tab was torn down while the work was in flight. */
  private refresh(): void {
    if (!this.disposed) this.update();
  }

  private openAddTriggerDialog(): void {
    new AddTriggerModal(this.app, {
      existing: this.plugin.settings.triggerCharacters.map(({ sequence }) => sequence),
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
      onSubmit: trigger => void this.addTrigger(trigger),
    }).open();
  }

  /**
   * Append a trigger.
   *
   * The invariants are re-asserted here and not left to the dialog: the dialog
   * validates against a list captured when it opened, and validation that lives
   * only in a dialog is validation the next caller can bypass.
   */
  async addTrigger(trigger: TriggerConfig): Promise<void> {
    const triggers = this.plugin.settings.triggerCharacters;
    const { sequence, mode } = trigger;

    if (
      sequence === '' ||
      sequence.length > MAX_TRIGGER_LENGTH ||
      !isTriggerMode(mode) ||
      triggers.some(existing => existing.sequence === sequence)
    ) {
      return;
    }

    triggers.push({ sequence, mode });
    await this.persistTriggers();
  }

  /**
   * Remove a trigger by sequence.
   *
   * By value, not by index: the rendered rows keep their original indices until
   * `update()` rebuilds the tree, which only happens after an `await`. A second
   * click — or the Delete key repeating — lands in that window carrying an index
   * that has since come to mean a different trigger.
   */
  async removeTrigger(sequence: string): Promise<void> {
    const triggers = this.plugin.settings.triggerCharacters;
    // At least one trigger must remain. The list withholds the affordance when
    // only one is left, but that is decided when the tree is built; two quick
    // deletes on a two-item list would otherwise empty it — and an empty list
    // survives `validateSettings`, silently disabling the picker for good.
    if (triggers.length <= 1) return;

    const at = triggers.findIndex(trigger => trigger.sequence === sequence);
    if (at === -1) return; // already removed by an earlier click

    triggers.splice(at, 1);
    await this.persistTriggers();
  }

  /**
   * Reassign what a trigger opens.
   *
   * By sequence for the same reason `removeTrigger` is: the dropdown of a row
   * deleted by a quicker click is still on screen until the rebuild, and must
   * not put the trigger back. Writing the same mode again is a no-op rather
   * than a save — the rebuild that follows would otherwise steal focus from the
   * dropdown the user has just used.
   */
  async setTriggerMode(sequence: string, mode: TriggerMode): Promise<void> {
    if (!isTriggerMode(mode)) return;

    const trigger = this.plugin.settings.triggerCharacters.find(
      candidate => candidate.sequence === sequence
    );
    if (!trigger || trigger.mode === mode) return;

    trigger.mode = mode;
    await this.persistTriggers();
  }

  private async persistTriggers(): Promise<void> {
    try {
      await this.plugin.saveSettings();
    } catch (error) {
      this.reportFailure(error);
      return;
    }
    // A row was added or removed: the definitions themselves changed, so
    // predicates are not enough — the tree has to be rebuilt.
    this.refresh();
  }

  private reportFailure(error: unknown): void {
    console.error('Date Helpers: failed to save settings', error);
    new Notice(this.plugin.i18n.t('settings.saveFailed'));
  }
}
