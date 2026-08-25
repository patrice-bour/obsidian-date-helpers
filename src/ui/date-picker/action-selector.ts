import { setIcon } from 'obsidian';
import { Translate, PlainTranslationKey } from '@/i18n/types';
import { DateAction } from './types';

/**
 * The i18n key naming each action, shared with the status row so that the tab
 * and the words under it can never name two different things.
 */
export const ACTION_LABEL_KEYS: Record<DateAction, PlainTranslationKey> = {
  'insert-text': 'picker.tabs.insertText',
  'insert-daily-note': 'picker.tabs.insertDailyNote',
  'open-daily-note': 'picker.tabs.openDailyNote',
};

/**
 * Render the 3-button action bar (insert text / link daily note / open
 * daily note). Click toggles the active class and notifies the owner,
 * which updates state and re-renders the modal.
 *
 * The buttons carry an icon and no text: the expression field beside them owns
 * the width of that row. The label is not lost — the status row under the tabs
 * names the armed action in words, and every button keeps its label as its
 * accessible name.
 *
 * No `title`: Obsidian already draws a tooltip for `aria-label`, and setting
 * both puts two tooltips on one button.
 *
 * The icons are stroke SVG, not emoji. An emoji draws differently on every
 * platform and cannot follow the theme colour.
 *
 * Labels are resolved on every render, so a locale change reaches them as soon
 * as the picker is reopened — no plugin reload, unlike the command palette.
 */
export function renderActionSelector(
  container: HTMLElement,
  selected: DateAction,
  onChange: (action: DateAction) => void,
  t: Translate
): void {
  const actionBar = container.createDiv({ cls: 'action-selector' });

  // Through ACTION_LABEL_KEYS, never through a second list of literals: it is
  // what makes the tab and the status row name the same action.
  const actions: Array<{ value: DateAction; icon: string }> = [
    { value: 'insert-text', icon: 'pencil' },
    { value: 'insert-daily-note', icon: 'link' },
    { value: 'open-daily-note', icon: 'external-link' },
  ];

  actions.forEach(action => {
    const button = actionBar.createEl('button', { cls: 'action-button' });
    button.setAttribute('aria-label', t(ACTION_LABEL_KEYS[action.value]));
    setIcon(button, action.icon);

    if (action.value === selected) {
      button.addClass('is-active');
    }

    // The owner re-renders the whole modal on change, which rebuilds the
    // bar with the correct active state — no manual class juggling needed.
    button.addEventListener('click', () => onChange(action.value));
  });
}
