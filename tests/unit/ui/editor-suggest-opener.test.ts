/**
 * Opening the suggestion popup after a write the user did not type.
 *
 * Obsidian re-evaluates its editor suggests when the user types. A write made
 * by plugin code does not wake them: the popup stays closed and the keystrokes
 * that follow go nowhere. The only way in is `workspace.editorSuggest.trigger`,
 * which the public typings do not declare — so it is reached here, in one
 * place, behind a shape check.
 */

import { openEditorSuggest } from '@/ui/editor-suggest-opener';
import { App, Editor, TFile } from 'obsidian';

const EDITOR = {} as Editor;
const FILE = { path: 'note.md' } as TFile;

/** An app whose workspace exposes whatever `editorSuggest` is given */
function appWith(editorSuggest: unknown): App {
  return { workspace: { editorSuggest } } as unknown as App;
}

describe('openEditorSuggest', () => {
  /**
   * The third argument is `manual`, and it is what makes the popup open on a
   * bare trigger. Without it the popup waits for something to be typed, and the
   * user sees the trigger land with no list under it.
   */
  it('asks the workspace to open the suggest for this editor and file', () => {
    const trigger = jest.fn();

    const opened = openEditorSuggest(appWith({ trigger }), EDITOR, FILE);

    expect(opened).toBe(true);
    expect(trigger).toHaveBeenCalledWith(EDITOR, FILE, true);
  });

  it('carries a null file rather than inventing one', () => {
    const trigger = jest.fn();

    openEditorSuggest(appWith({ trigger }), EDITOR, null);

    expect(trigger).toHaveBeenCalledWith(EDITOR, null, true);
  });

  /**
   * The fallback is the whole point of the shape check: a future Obsidian that
   * renames this leaves the trigger inert in the note. Nothing is destroyed,
   * because the selected text was never taken away.
   */
  it('stays silent when the workspace exposes no editorSuggest', () => {
    expect(() => openEditorSuggest(appWith(undefined), EDITOR, FILE)).not.toThrow();
    expect(openEditorSuggest(appWith(undefined), EDITOR, FILE)).toBe(false);
  });

  it('stays silent when editorSuggest is null', () => {
    // `typeof null === 'object'`, so a shape check that only asks for an object
    // walks straight into reading `.trigger` off null.
    expect(() => openEditorSuggest(appWith(null), EDITOR, FILE)).not.toThrow();
    expect(openEditorSuggest(appWith(null), EDITOR, FILE)).toBe(false);
  });

  it('stays silent when editorSuggest carries no trigger', () => {
    expect(openEditorSuggest(appWith({}), EDITOR, FILE)).toBe(false);
  });

  it('stays silent when trigger is not callable', () => {
    expect(openEditorSuggest(appWith({ trigger: 'nope' }), EDITOR, FILE)).toBe(false);
  });

  it('stays silent when the workspace itself is missing', () => {
    expect(openEditorSuggest({} as App, EDITOR, FILE)).toBe(false);
  });

  /**
   * Obsidian's own implementation gives up when the editor has lost focus. A
   * throw from it must not reach the keydown listener, which still has a
   * document to leave in a sane state.
   */
  it('swallows a throw from Obsidian rather than break the keystroke', () => {
    const trigger = jest.fn(() => {
      throw new Error('no focus');
    });

    expect(openEditorSuggest(appWith({ trigger }), EDITOR, FILE)).toBe(false);
  });
});
