import { Translate } from '@/i18n/types';
import { DateAction } from './types';

/**
 * Render the 3-button action bar (insert text / link daily note / open
 * daily note). Click toggles the active class and notifies the owner,
 * which updates state and re-renders the modal.
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

  const actions: Array<{ value: DateAction; label: string; icon: string }> = [
    { value: 'insert-text', label: t('picker.tabs.insertText'), icon: '📝' },
    { value: 'insert-daily-note', label: t('picker.tabs.insertDailyNote'), icon: '📅' },
    { value: 'open-daily-note', label: t('picker.tabs.openDailyNote'), icon: '🔗' },
  ];

  actions.forEach(action => {
    const button = actionBar.createEl('button', {
      cls: 'action-button',
      text: `${action.icon} ${action.label}`,
    });

    if (action.value === selected) {
      button.addClass('is-active');
    }

    // The owner re-renders the whole modal on change, which rebuilds the
    // bar with the correct active state — no manual class juggling needed.
    button.addEventListener('click', () => onChange(action.value));
  });
}
