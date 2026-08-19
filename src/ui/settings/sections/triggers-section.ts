import type {
  SettingDefinitionItem,
  SettingDefinitionList,
  SettingDefinitionRender,
} from 'obsidian';
import { SettingsKey, SettingsSectionContext, descriptionRow } from '../section-context';
import { TriggerConfig, TriggerMode } from '@/types/settings';

export interface TriggerListActions {
  /** Open the add-trigger dialog. */
  onAdd: () => void;
  /**
   * Remove this trigger. Identified by sequence rather than by index: the rows
   * carry the indices they were built with until the tree is rebuilt, and that
   * happens after an `await`.
   */
  onDelete: (sequence: string) => void;
  /** Reassign what this trigger opens. Identified by sequence, for the same reason. */
  onModeChange: (sequence: string, mode: TriggerMode) => void;
}

/**
 * Triggers section: the configured sequences as a mutable list, each row
 * carrying the mode that says what it opens.
 *
 * The section description is emitted as a sibling row rather than as the list's
 * first item on purpose — every item of a list carries the delete affordance
 * and counts towards the indices handed to `onDelete`, so a prose row inside it
 * would both offer a nonsensical delete button and shift every trigger index by
 * one.
 *
 * The section is therefore two definitions, not one. A group carries the
 * heading and the prose; the list carries the rows. Putting the heading on the
 * list instead drew it above everything the list holds — the intro included,
 * which then read as a closing note on the previous section. And a heading a
 * group does not own is drawn inside the tinted card rather than above it,
 * which made this section's title look like the sub-headings of a card.
 *
 * The add affordance rides the group's header, beside the title, as
 * `extraButtons`. It was the list's `addItem`, which draws it in the list's own
 * header — empty once the title moved, so the `+` floated there alone. The cost
 * is the mobile rendering `addItem` would have chosen: a `+ Add` row under the
 * list rather than a button. The button is tappable either way, but it is a
 * smaller target, and it is the only way to add a trigger.
 *
 * The reload note sits beside it, once: repeated on every row it would read as
 * a property of that particular trigger rather than of the list.
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
    emptyState: t('settings.triggers.validation.minRequired'),
    items: rendered.map(trigger => modeRow(trigger)),
    // At least one trigger must remain, so the affordance is withheld rather
    // than offered and then refused. This is decided at build time, so the
    // mutation side enforces the same rule again.
    ...(isLastTrigger
      ? {}
      : { onDelete: (index: number) => actions.onDelete(rendered[index].sequence) }),
  };

  return [
    {
      type: 'group',
      heading: t('settings.sections.triggers'),
      extraButtons: [
        button =>
          button
            .setIcon('lucide-plus')
            .setTooltip(t('settings.triggers.addTitle'))
            .onClick(() => actions.onAdd())
            .extraSettingsEl.addClass('settings-heading-action'),
      ],
      items: [
        descriptionRow(t('settings.triggers.description')),
        descriptionRow(t('settings.triggers.reloadNote')),
      ],
    },
    list,
  ];

  /**
   * One row: the sequence, and a dropdown for what it opens.
   *
   * Rendered imperatively rather than declared as a `control`, because a
   * declarative control binds to a top-level settings key and this one edits an
   * entry inside an array. Persisting is therefore ours to do — `onModeChange`
   * does it, and re-asserts the invariants the way `onDelete` does.
   */
  function modeRow(trigger: TriggerConfig): SettingDefinitionRender {
    return {
      name: trigger.sequence,
      // Explains why the row offers no delete affordance.
      ...(isLastTrigger ? { desc: t('settings.triggers.validation.minRequired') } : {}),
      render: setting => {
        setting.addDropdown(dropdown =>
          dropdown
            .addOption('picker', t('settings.triggers.mode.picker'))
            .addOption('inline', t('settings.triggers.mode.inline'))
            .setValue(trigger.mode)
            .onChange(value => actions.onModeChange(trigger.sequence, value as TriggerMode))
        );
      },
    };
  }
}
