/**
 * @jest-environment jsdom
 *
 * Pins the add-trigger dialog: the validation rules it inherits from the
 * previous inline add row, and the fact that an invalid entry keeps the dialog
 * open so the user can correct it instead of losing what they typed.
 */

import { App } from 'obsidian';
import { createMockApp } from '../../../helpers/mock-app';
import { AddTriggerModal, validateTrigger } from '@/ui/settings/add-trigger-modal';
import { MAX_TRIGGER_LENGTH } from '@/utils/constants';

/** Identity translator: assertions then read as the key that was looked up. */
const t = (key: string): string => key;

describe('validateTrigger', () => {
  it('accepts a new, non-empty, short-enough trigger', () => {
    expect(validateTrigger(';;', ['@@'], t as never)).toBeUndefined();
  });

  it.each(['', '   '])('rejects %p as empty', value => {
    expect(validateTrigger(value, ['@@'], t as never)).toBe('settings.triggers.validation.empty');
  });

  it('rejects a trigger longer than the maximum', () => {
    const tooLong = 'x'.repeat(MAX_TRIGGER_LENGTH + 1);
    expect(validateTrigger(tooLong, [], t as never)).toBe('settings.triggers.validation.tooLong');
  });

  it('accepts a trigger of exactly the maximum length', () => {
    const atLimit = 'x'.repeat(MAX_TRIGGER_LENGTH);
    expect(validateTrigger(atLimit, [], t as never)).toBeUndefined();
  });

  it('rejects a duplicate', () => {
    expect(validateTrigger('@@', ['@@'], t as never)).toBe(
      'settings.triggers.validation.duplicate'
    );
  });
});

describe('AddTriggerModal', () => {
  let app: App;
  let onSubmit: jest.Mock;

  const openModal = (existing: string[] = ['@@']): AddTriggerModal => {
    const modal = new AddTriggerModal(app, {
      existing,
      t: t as never,
      onSubmit,
    });
    modal.onOpen();
    return modal;
  };

  const typeAndConfirm = (modal: AddTriggerModal, value: string): void => {
    const input = modal.contentEl.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));

    const confirm = Array.from(modal.contentEl.querySelectorAll('button')).find(
      button => button.textContent === 'settings.triggers.add'
    );
    if (!confirm) throw new Error('no confirm button rendered');
    confirm.click();
  };

  beforeEach(() => {
    app = createMockApp();
    onSubmit = jest.fn();
  });

  it('submits a valid trigger and closes', () => {
    const modal = openModal();
    const close = jest.spyOn(modal, 'close');

    typeAndConfirm(modal, ';;');

    expect(onSubmit).toHaveBeenCalledWith(';;');
    expect(close).toHaveBeenCalled();
  });

  it('trims surrounding whitespace before submitting', () => {
    const modal = openModal();
    typeAndConfirm(modal, '  ;;  ');
    expect(onSubmit).toHaveBeenCalledWith(';;');
  });

  it('shows the error and stays open on an invalid entry', () => {
    const modal = openModal(['@@']);
    const close = jest.spyOn(modal, 'close');

    typeAndConfirm(modal, '@@');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(modal.contentEl.textContent).toContain('settings.triggers.validation.duplicate');
  });

  it('clears a previous error once the entry becomes valid', () => {
    const modal = openModal(['@@']);
    typeAndConfirm(modal, '@@');
    expect(modal.contentEl.textContent).toContain('settings.triggers.validation.duplicate');

    typeAndConfirm(modal, ';;');

    expect(modal.contentEl.textContent).not.toContain('settings.triggers.validation.duplicate');
    expect(onSubmit).toHaveBeenCalledWith(';;');
  });

  it('closes without submitting when cancelled', () => {
    const modal = openModal();
    const close = jest.spyOn(modal, 'close');

    const cancel = Array.from(modal.contentEl.querySelectorAll('button')).find(
      button => button.textContent === 'picker.cancel'
    );
    if (!cancel) throw new Error('no cancel button rendered');
    cancel.click();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
