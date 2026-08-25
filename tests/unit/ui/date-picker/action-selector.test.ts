/**
 * @jest-environment jsdom
 *
 * The action tabs: an icon and no text, the label kept as the accessible name,
 * a single tooltip, and no emoji anywhere.
 *
 * Ref: OpenSpec update-trigger-surfaces-layout
 */

import { renderActionSelector } from '@/ui/date-picker/action-selector';
import { I18nService } from '@/services/i18n-service';
import { Translate } from '@/i18n/types';

describe('renderActionSelector', () => {
  let container: HTMLElement;
  let t: Translate;
  let i18n: I18nService;

  beforeEach(() => {
    container = document.createElement('div');
    i18n = new I18nService('en');
    t = ((key, ...params) => i18n.t(key, ...params)) as Translate;
  });

  function buttons(): HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>('.action-button')];
  }

  it('draws three buttons carrying no visible label', () => {
    renderActionSelector(container, 'insert-text', () => {}, t);

    expect(buttons()).toHaveLength(3);
    expect(buttons().every(b => b.textContent === '')).toBe(true);
  });

  it('keeps each label as the accessible name, and draws one tooltip', () => {
    renderActionSelector(container, 'insert-text', () => {}, t);

    expect(buttons().map(b => b.getAttribute('aria-label'))).toEqual([
      i18n.t('picker.tabs.insertText'),
      i18n.t('picker.tabs.insertDailyNote'),
      i18n.t('picker.tabs.openDailyNote'),
    ]);
    // Obsidian draws a tooltip for `aria-label`; adding `title` would draw the
    // system's own on top of it.
    expect(buttons().every(b => b.getAttribute('title') === null)).toBe(true);
  });

  it('carries a stroke icon, never an emoji', () => {
    renderActionSelector(container, 'insert-text', () => {}, t);

    expect(buttons().map(b => b.getAttribute('data-icon'))).toEqual([
      'pencil',
      'link',
      'external-link',
    ]);
    // Emoji live outside the Basic Multilingual Plane, or in the symbol blocks
    // the old bar used: `📝`, `📅`, `🔗`.
    expect(container.innerHTML).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('marks the selected action, and only it', () => {
    renderActionSelector(container, 'insert-daily-note', () => {}, t);

    expect(buttons().map(b => b.classList.contains('is-active'))).toEqual([false, true, false]);
  });

  it('reports the action a click chose', () => {
    const onChange = jest.fn();
    renderActionSelector(container, 'insert-text', onChange, t);

    buttons()[2].click();

    expect(onChange).toHaveBeenCalledWith('open-daily-note');
  });

  it('follows the locale', () => {
    i18n = new I18nService('fr');
    t = ((key, ...params) => i18n.t(key, ...params)) as Translate;

    renderActionSelector(container, 'insert-text', () => {}, t);

    expect(buttons()[0].getAttribute('aria-label')).toBe(i18n.t('picker.tabs.insertText'));
    expect(buttons()[0].getAttribute('aria-label')).not.toBe('Insert as text');
  });
});
