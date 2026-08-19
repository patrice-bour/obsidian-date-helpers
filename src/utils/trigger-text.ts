import { TriggerConfig } from '@/types/settings';

/**
 * Is `text` exactly one configured trigger, and nothing else?
 *
 * The question both cancellation paths ask before giving a captured selection
 * back: a bare trigger is a gesture the user abandoned, while a trigger with
 * anything after it is what they meant to write. An equality test, never
 * `startsWith` — the range covers everything typed after the trigger.
 *
 * Shared so the two paths cannot drift: the popup reads the triggers it was
 * built with, the modal reads the live settings, and one rule stated twice
 * eventually becomes two rules.
 */
export function isBareTrigger(text: string, triggers: TriggerConfig[]): boolean {
  return triggers.some(({ sequence }) => text === sequence);
}
