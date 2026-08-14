import type { SettingDefinitionItem, SettingDefinitionList } from 'obsidian';
import { SettingsKey, SettingsSectionContext, descriptionRow } from '../section-context';

export interface TriggerListActions {
  /** Open the add-trigger dialog. */
  onAdd: () => void;
  /**
   * Remove this trigger. Identified by value rather than by index: the rows
   * carry the indices they were built with until the tree is rebuilt, and that
   * happens after an `await`.
   */
  onDelete: (trigger: string) => void;
}

/**
 * Trigger characters section: the configured sequences as a mutable list.
 *
 * The section description is emitted as a sibling row rather than as the list's
 * first item on purpose — every item of a list carries the delete affordance
 * and counts towards the indices handed to `onDelete`, so a prose row inside it
 * would both offer a nonsensical delete button and shift every trigger index by
 * one.
 */
export function buildTriggersSection(
  ctx: SettingsSectionContext,
  actions: TriggerListActions
): SettingDefinitionItem<SettingsKey>[] {
  const { plugin, t } = ctx;
  // The row order this list is built with, frozen. Obsidian hands `onDelete` an
  // index into *these* rows, and the live array may already have moved on.
  const rendered = [...plugin.settings.triggerCharacters];
  const isLastTrigger = rendered.length <= 1;

  const list: SettingDefinitionList<SettingsKey> = {
    type: 'list',
    heading: t('settings.sections.triggers'),
    emptyState: t('settings.triggers.validation.minRequired'),
    items: rendered.map(trigger => ({
      name: trigger,
      // Explains why the row offers no delete affordance.
      ...(isLastTrigger ? { desc: t('settings.triggers.validation.minRequired') } : {}),
    })),
    addItem: {
      name: t('settings.triggers.addTitle'),
      action: () => actions.onAdd(),
    },
    // At least one trigger must remain, so the affordance is withheld rather
    // than offered and then refused. This is decided at build time, so the
    // mutation side enforces the same rule again.
    ...(isLastTrigger
      ? {}
      : { onDelete: (index: number) => actions.onDelete(rendered[index]) }),
  };

  return [descriptionRow(t('settings.triggers.description')), list];
}
