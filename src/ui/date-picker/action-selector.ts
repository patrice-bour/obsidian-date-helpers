import { DateAction } from './types';

/**
 * Render the 3-button action bar (insert text / link daily note / open
 * daily note). Click toggles the active class and notifies the owner,
 * which updates state and re-renders the modal.
 */
export function renderActionSelector(
  container: HTMLElement,
  selected: DateAction,
  onChange: (action: DateAction) => void
): void {
  const actionBar = container.createDiv({ cls: 'action-selector' });

  const actions: Array<{ value: DateAction; label: string; icon: string }> = [
    { value: 'insert-text', label: 'Insert as Text', icon: '📝' },
    { value: 'insert-daily-note', label: 'Link to Daily Note', icon: '📅' },
    { value: 'open-daily-note', label: 'Open Daily Note', icon: '🔗' },
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
