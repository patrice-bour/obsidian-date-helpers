import type {
  SettingDefinition,
  SettingDefinitionControl,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingDefinitionList,
} from 'obsidian';

/**
 * Walk helpers for the declarative settings tree returned by
 * `getSettingDefinitions()`.
 *
 * Definitions are plain data, so tests can assert on them directly. These
 * helpers exist so assertions read as "the locale control validates X" rather
 * than as index arithmetic into a nested array, which would silently target the
 * wrong row the day a setting is inserted above it.
 */

/** A container in the tree: group, list, or page — anything carrying `items`. */
interface WithItems {
  items?: SettingDefinitionItem[];
}

function hasItems(item: SettingDefinitionItem): item is SettingDefinitionItem & WithItems {
  return 'items' in item && Array.isArray((item as WithItems).items);
}

/** Depth-first flattening of every definition in the tree, containers included. */
export function flattenDefinitions(items: SettingDefinitionItem[]): SettingDefinitionItem[] {
  return items.flatMap(item =>
    hasItems(item) ? [item, ...flattenDefinitions(item.items ?? [])] : [item]
  );
}

function isControl(item: SettingDefinitionItem): item is SettingDefinitionControl {
  return 'control' in item && (item as SettingDefinitionControl).control !== undefined;
}

/**
 * Find the control definition bound to a settings key.
 * @throws when absent, so a renamed or dropped key fails loudly instead of
 *   silently turning every following assertion into a no-op on `undefined`.
 */
export function findControl(items: SettingDefinitionItem[], key: string): SettingDefinitionControl {
  const found = flattenDefinitions(items)
    .filter(isControl)
    .find(item => item.control.key === key);

  if (!found) {
    throw new Error(`No control definition bound to key "${key}"`);
  }
  return found;
}

/** Find a group or list by its heading. Returns undefined when absent. */
export function findGroup(
  items: SettingDefinitionItem[],
  heading: string
): (SettingDefinitionGroup | SettingDefinitionList) | undefined {
  return flattenDefinitions(items).find(
    (item): item is SettingDefinitionGroup | SettingDefinitionList =>
      'heading' in item && item.heading === heading
  );
}

/**
 * The one list in the tree — the trigger characters.
 *
 * It carries no `heading` of its own: a list draws its heading above
 * everything it holds, which would put the section's intro above the title
 * that introduces it. Its heading lives on the group beside it, so the list is
 * reached by its type.
 * @throws when absent, so a restructured section fails loudly instead of
 *   turning every following assertion into a no-op on `undefined`.
 */
export function findList(items: SettingDefinitionItem[]): SettingDefinitionList {
  const found = flattenDefinitions(items).find(
    (item): item is SettingDefinitionList => 'type' in item && item.type === 'list'
  );

  if (!found) {
    throw new Error('No list definition in the settings tree');
  }
  return found;
}

/** The headings of the top-level groups, in render order. */
export function groupHeadings(items: SettingDefinitionItem[]): string[] {
  return items
    .filter((item): item is SettingDefinitionGroup => 'heading' in item)
    .map(item => item.heading ?? '');
}

/** Resolve a `visible` / `disabled` predicate to its boolean value. */
function resolvePredicate(
  predicate: boolean | (() => boolean) | undefined,
  fallback: boolean
): boolean {
  if (predicate === undefined) return fallback;
  return typeof predicate === 'function' ? predicate() : predicate;
}

export function isVisible(item: SettingDefinition | SettingDefinitionGroup): boolean {
  return resolvePredicate(item.visible, true);
}

export function isDisabled(item: SettingDefinitionControl): boolean {
  return resolvePredicate(item.control.disabled, false);
}
